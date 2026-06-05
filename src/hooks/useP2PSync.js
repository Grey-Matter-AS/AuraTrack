import { useState, useRef, useCallback } from 'react';
import Peer from 'peerjs';
import { exportLocalData, mergeRemoteData } from '../utils/syncHelpers';
import { MAX_SYNC_PAYLOAD_CHARS } from '../utils/importSanitizer';

const CHUNK_SIZE = 4000;
const MAX_CHUNKS = Math.ceil(MAX_SYNC_PAYLOAD_CHARS / CHUNK_SIZE);
const BUFFER_HIGH_WATER = 64 * 1024;
const BUFFER_WAIT_MS = 750;
const CONNECT_TIMEOUT_MS = 30000;

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

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function getDataChannel(conn) {
  return conn?.dataChannel || conn?._dc || null;
}

async function waitForWritable(conn) {
  const channel = getDataChannel(conn);
  if (!channel || typeof channel.bufferedAmount !== 'number' || channel.bufferedAmount < BUFFER_HIGH_WATER) return;
  channel.bufferedAmountLowThreshold = Math.floor(BUFFER_HIGH_WATER / 2);
  await Promise.race([
    new Promise(resolve => {
      const onLow = () => {
        channel.removeEventListener?.('bufferedamountlow', onLow);
        resolve();
      };
      channel.addEventListener?.('bufferedamountlow', onLow, { once: true });
    }),
    delay(BUFFER_WAIT_MS),
  ]);
}

export function useP2PSync() {
  const [phase, setPhase] = useState('idle');
  const [peerId, setPeerId] = useState(null);
  const [pin, setPin] = useState(null);
  const [remotePin, setRemotePin] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const peerRef = useRef(null);
  const connRef = useRef(null);
  const pinRef = useRef(null);
  const verifiedRef = useRef(false);
  const rxRef = useRef({ chunks: [], expected: 0 });
  const timeoutRef = useRef(null);
  const connectTimeoutRef = useRef(null);
  const phaseRef = useRef('idle');
  const isHostRef = useRef(false);
  const sentLocalRef = useRef(false);

  const go = (p) => { phaseRef.current = p; setPhase(p); };

  const cleanup = useCallback(() => {
    clearTimeout(timeoutRef.current);
    clearTimeout(connectTimeoutRef.current);
    try { connRef.current?.close(); } catch { /* connection already closed */ }
    try { peerRef.current?.destroy(); } catch { /* peer already destroyed */ }
    connRef.current = null;
    peerRef.current = null;
    verifiedRef.current = false;
    sentLocalRef.current = false;
  }, []);

  const reset = useCallback(() => {
    cleanup();
    go('idle');
    setPeerId(null); setPin(null); setRemotePin(null); setResult(null); setError(null);
    pinRef.current = null;
    rxRef.current = { chunks: [], expected: 0 };
    isHostRef.current = false;
  }, [cleanup]);

  const sendLocalData = useCallback(async () => {
    try {
      const conn = connRef.current;
      if (!conn?.open) throw new Error('Connection is not ready for sync.');
      const json = JSON.stringify(await exportLocalData());
      const chunks = chunkString(json);
      conn.send({ type: 'meta', total: chunks.length });
      for (let i = 0; i < chunks.length; i += 1) {
        if (!connRef.current?.open) throw new Error('Connection closed during sync.');
        conn.send({ type: 'chunk', index: i, data: chunks[i] });
        if (i < chunks.length - 1) {
          await waitForWritable(conn);
          if (i % 8 === 7) await delay(0);
        }
      }
      sentLocalRef.current = true;
    } catch (err) {
      setError(err.message || 'Sync payload is too large.');
      go('error');
      cleanup();
    }
  }, [cleanup]);

  const handleData = useCallback(async (data) => {
    if (!data || typeof data !== 'object') return;

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
        try { connRef.current?.close(); } catch { /* connection already closed */ }
        connRef.current = null;
        verifiedRef.current = false;
        return;
      }
      verifiedRef.current = true;
      go('transferring');
      await sendLocalData();
      return;
    }

    if (data.type === 'done') {
      go('done');
      cleanup();
      return;
    }

    if (!verifiedRef.current) {
      setError('Unverified connection rejected.');
      go('error');
      try { connRef.current?.close(); } catch { /* connection already closed */ }
      connRef.current = null;
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
          const mergeResult = await mergeRemoteData(JSON.parse(payload));
          setResult(mergeResult);
          if (isHostRef.current) {
            connRef.current?.send({ type: 'done' });
            go('done');
            cleanup();
          } else if (!sentLocalRef.current) {
            go('transferring');
            await sendLocalData();
          }
        } catch {
          setError('Received data could not be parsed.');
          go('error');
          cleanup();
        }
      }
    }
  }, [cleanup, sendLocalData]);

  const startAsHost = useCallback(() => {
    go('generating');
    isHostRef.current = true;
    const newPin = generatePin();
    pinRef.current = newPin;
    verifiedRef.current = false;
    setPin(newPin);

    const peer = new Peer();
    peerRef.current = peer;

    peer.on('open', (id) => {
      setPeerId(id);
      go('waiting');
      timeoutRef.current = setTimeout(() => {
        if (phaseRef.current === 'waiting') {
          setError('No device connected within 90 seconds.');
          go('timeout');
          cleanup();
        }
      }, 90000);
    });

    peer.on('connection', (conn) => {
      clearTimeout(timeoutRef.current);
      verifiedRef.current = false;
      connRef.current = conn;
      conn.on('open', () => {
        clearTimeout(connectTimeoutRef.current);
        go('pin_confirm');
        conn.send({ type: 'pin', pin: pinRef.current });
      });
      conn.on('data', handleData);
      conn.on('close', () => {
        if (phaseRef.current !== 'done' && phaseRef.current !== 'error' && phaseRef.current !== 'idle') {
          setError('Connection closed unexpectedly.');
          go('error');
        }
      });
      conn.on('error', (err) => {
        setError(err.message || 'Connection lost.');
        go('error');
        cleanup();
      });
    });

    peer.on('error', (err) => {
      const msg = err.type === 'network'
        ? 'No internet — try Private Sync on the same WiFi instead.'
        : (err.message || 'Relay error.');
      setError(msg);
      go('error');
    });
  }, [cleanup, handleData]);

  const connectToPeer = useCallback((targetId) => {
    go('connecting');
    isHostRef.current = false;
    verifiedRef.current = false;
    const peer = new Peer();
    peerRef.current = peer;

    peer.on('open', () => {
      connectTimeoutRef.current = setTimeout(() => {
        setError('Timed out waiting for the sender device.');
        go('timeout');
        cleanup();
      }, CONNECT_TIMEOUT_MS);
      const conn = peer.connect(targetId, { reliable: true });
      connRef.current = conn;
      conn.on('open', () => {
        clearTimeout(connectTimeoutRef.current);
      });
      conn.on('data', handleData);
      conn.on('close', () => {
        if (phaseRef.current !== 'done' && phaseRef.current !== 'error' && phaseRef.current !== 'idle') {
          setError('Connection closed unexpectedly.');
          go('error');
        }
      });
      conn.on('error', (err) => {
        setError(err.message || 'Connection lost.');
        go('error');
        cleanup();
      });
    });

    peer.on('error', (err) => {
      setError(err.message || 'Could not connect to peer.');
      go('error');
    });
  }, [cleanup, handleData]);

  const confirmPin = useCallback(() => {
    if (!connRef.current || typeof pinRef.current !== 'string') return;
    verifiedRef.current = true;
    connRef.current.send({ type: 'pin_ok', pin: pinRef.current });
    go('transferring');
  }, []);

  return { phase, peerId, pin, remotePin, result, error, startAsHost, connectToPeer, confirmPin, reset };
}
