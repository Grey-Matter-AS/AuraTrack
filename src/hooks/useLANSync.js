import { useState, useRef, useCallback } from 'react';
import QRCode from 'qrcode';
import { exportLocalData, mergeRemoteData, compressSDP, decompressSDP } from '../utils/syncHelpers';
import { MAX_SYNC_PAYLOAD_CHARS } from '../utils/importSanitizer';

const CHUNK_SIZE = 15000;
const MAX_CHUNKS = Math.ceil(MAX_SYNC_PAYLOAD_CHARS / CHUNK_SIZE);

function generatePin() {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return String(100000 + (values[0] % 900000));
}

function chunkString(str) {
  if (str.length > MAX_SYNC_PAYLOAD_CHARS) throw new Error('Sync payload is too large.');
  const out = [];
  for (let i = 0; i < str.length; i += CHUNK_SIZE) out.push(str.slice(i, i + CHUNK_SIZE));
  return out.length ? out : [''];
}

function appURL(hash) {
  return `${window.location.origin}${window.location.pathname}${hash}`;
}

async function gatherICE(pc) {
  if (pc.iceGatheringState === 'complete') return;
  return new Promise((resolve) => {
    const done = () => { pc.onicecandidate = null; pc.onicegatheringstatechange = null; resolve(); };
    pc.onicecandidate = (ev) => { if (!ev.candidate) done(); };
    pc.onicegatheringstatechange = () => { if (pc.iceGatheringState === 'complete') done(); };
    setTimeout(resolve, 4000); // hard timeout
  });
}

async function sdpToQR(sdp, hashPrefix) {
  const compressed = await compressSDP(sdp);
  const url = appURL(`${hashPrefix}${compressed}`);
  return QRCode.toDataURL(url, { width: 260, margin: 2, errorCorrectionLevel: 'M' });
}

export function useLANSync() {
  const [phase, setPhase] = useState('idle');
  const [offerQR, setOfferQR] = useState(null);
  const [answerQR, setAnswerQR] = useState(null);
  const [pin, setPin] = useState(null);
  const [remotePin, setRemotePin] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [isHost, setIsHost] = useState(true);

  const pcRef = useRef(null);
  const chRef = useRef(null);
  const pinRef = useRef(null);
  const verifiedRef = useRef(false);
  const rxRef = useRef({ chunks: [], expected: 0 });
  const phaseRef = useRef('idle');

  const go = (p) => { phaseRef.current = p; setPhase(p); };

  const cleanup = useCallback(() => {
    try { chRef.current?.close(); } catch { /* channel already closed */ }
    try { pcRef.current?.close(); } catch { /* peer connection already closed */ }
    chRef.current = null;
    pcRef.current = null;
    verifiedRef.current = false;
  }, []);

  const reset = useCallback(() => {
    cleanup();
    go('idle');
    setOfferQR(null); setAnswerQR(null); setPin(null); setRemotePin(null);
    setResult(null); setError(null);
    pinRef.current = null;
    rxRef.current = { chunks: [], expected: 0 };
  }, [cleanup]);

  const sendLocalData = useCallback(async () => {
    try {
      const json = JSON.stringify(await exportLocalData());
      const chunks = chunkString(json);
      chRef.current.send(JSON.stringify({ type: 'meta', total: chunks.length }));
      chunks.forEach((d, i) => chRef.current.send(JSON.stringify({ type: 'chunk', index: i, data: d })));
    } catch (err) {
      setError(err.message || 'Sync payload is too large.');
      go('error');
      cleanup();
    }
  }, [cleanup]);

  const onChannelMessage = useCallback(async (ev) => {
    let data;
    try { data = JSON.parse(ev.data); } catch { return; }

    if (data.type === 'pin') {
      pinRef.current = data.pin;
      setRemotePin(data.pin);
      go('pin_confirm');
      return;
    }
    if (data.type === 'pin_ok') {
      if (typeof data.pin !== 'string' || data.pin !== pinRef.current) {
        setError('PIN mismatch. Connection rejected.');
        go('error');
        try { chRef.current?.close(); } catch { /* channel already closed */ }
        try { pcRef.current?.close(); } catch { /* peer connection already closed */ }
        chRef.current = null;
        pcRef.current = null;
        verifiedRef.current = false;
        return;
      }
      verifiedRef.current = true;
      go('transferring');
      await sendLocalData();
      return;
    }
    if (!verifiedRef.current) {
      setError('Unverified connection rejected.');
      go('error');
      try { chRef.current?.close(); } catch { /* channel already closed */ }
      try { pcRef.current?.close(); } catch { /* peer connection already closed */ }
      chRef.current = null;
      pcRef.current = null;
      return;
    }
    if (data.type === 'meta') {
      if (!Number.isInteger(data.total) || data.total < 1 || data.total > MAX_CHUNKS) return;
      rxRef.current = { chunks: new Array(data.total), expected: data.total };
      return;
    }
    if (data.type === 'chunk') {
      if (phaseRef.current !== 'transferring' && phaseRef.current !== 'merging') return;
      if (!Number.isInteger(data.index) || data.index < 0 || data.index >= rxRef.current.expected) return;
      if (typeof data.data !== 'string' || data.data.length > CHUNK_SIZE) return;
      rxRef.current.chunks[data.index] = data.data;
      const filled = rxRef.current.chunks.filter(c => c !== undefined).length;
      if (filled === rxRef.current.expected) {
        try {
          go('merging');
          const payload = rxRef.current.chunks.join('');
          if (payload.length > MAX_SYNC_PAYLOAD_CHARS) throw new Error('Received data is too large.');
          const r = await mergeRemoteData(JSON.parse(payload));
          setResult(r);
          go('done');
          cleanup();
        } catch {
          setError('Received data could not be parsed.');
          go('error');
          cleanup();
        }
      }
    }
  }, [cleanup, sendLocalData]);

  const wireChannel = useCallback((ch, host) => {
    chRef.current = ch;
    ch.onmessage = onChannelMessage;
    ch.onopen = () => {
      if (host) {
        go('pin_confirm');
        ch.send(JSON.stringify({ type: 'pin', pin: pinRef.current }));
      }
    };
    ch.onclose = () => {
      if (phaseRef.current !== 'done' && phaseRef.current !== 'error') {
        setError('Connection closed unexpectedly.');
        go('error');
      }
    };
  }, [onChannelMessage]);

  const startAsHost = useCallback(async () => {
    setIsHost(true);
    go('generating_offer');
    const newPin = generatePin();
    pinRef.current = newPin;
    verifiedRef.current = false;
    setPin(newPin);
    try {
      const pc = new RTCPeerConnection({ iceServers: [], iceTransportPolicy: 'all' });
      pcRef.current = pc;
      wireChannel(pc.createDataChannel('sync', { ordered: true }), true);

      await pc.setLocalDescription(await pc.createOffer());
      await gatherICE(pc);

      setOfferQR(await sdpToQR(pc.localDescription.sdp, '#sdp='));
      go('waiting_scan');

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed') {
          setError('Direct connection failed. Make sure both devices are on the same WiFi network.');
          go('error');
          cleanup();
        }
      };
    } catch (e) {
      setError(e.message || 'Failed to generate connection code.');
      go('error');
    }
  }, [cleanup, wireChannel]);

  const startAsGuest = useCallback(async (encodedOffer) => {
    setIsHost(false);
    go('generating_answer');
    verifiedRef.current = false;
    try {
      const offerSDP = await decompressSDP(encodedOffer);
      const pc = new RTCPeerConnection({ iceServers: [], iceTransportPolicy: 'all' });
      pcRef.current = pc;
      pc.ondatachannel = (ev) => wireChannel(ev.channel, false);

      await pc.setRemoteDescription({ type: 'offer', sdp: offerSDP });
      await pc.setLocalDescription(await pc.createAnswer());
      await gatherICE(pc);

      setAnswerQR(await sdpToQR(pc.localDescription.sdp, '#sdp-answer='));
      go('waiting_answer');
    } catch (e) {
      setError(e.message || 'Failed to process connection code.');
      go('error');
    }
  }, [wireChannel]);

  const applyAnswer = useCallback(async (encodedAnswer) => {
    try {
      await pcRef.current.setRemoteDescription({
        type: 'answer',
        sdp: await decompressSDP(encodedAnswer),
      });
      go('connecting');
    } catch {
      setError('Invalid answer QR code.');
      go('error');
    }
  }, []);

  const confirmPin = useCallback(async () => {
    if (!chRef.current || typeof pinRef.current !== 'string') return;
    verifiedRef.current = true;
    go('transferring');
    chRef.current.send(JSON.stringify({ type: 'pin_ok', pin: pinRef.current }));
    await sendLocalData();
  }, [sendLocalData]);

  return {
    phase, offerQR, answerQR, pin, remotePin, result, error, isHost,
    startAsHost, startAsGuest, applyAnswer, confirmPin, reset,
  };
}
