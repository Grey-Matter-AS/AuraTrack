import { useState, useRef, useCallback } from 'react';
import Peer from 'peerjs';
import { exportLocalData, mergeRemoteData } from '../utils/syncHelpers';

const CHUNK_SIZE = 15000;

function generatePin() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function chunkString(str) {
  const out = [];
  for (let i = 0; i < str.length; i += CHUNK_SIZE) out.push(str.slice(i, i + CHUNK_SIZE));
  return out.length ? out : [''];
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
  const rxRef = useRef({ chunks: [], expected: 0 });
  const timeoutRef = useRef(null);
  const phaseRef = useRef('idle');

  const go = (p) => { phaseRef.current = p; setPhase(p); };

  const cleanup = useCallback(() => {
    clearTimeout(timeoutRef.current);
    try { connRef.current?.close(); } catch {}
    try { peerRef.current?.destroy(); } catch {}
    connRef.current = null;
    peerRef.current = null;
  }, []);

  const reset = useCallback(() => {
    cleanup();
    go('idle');
    setPeerId(null); setPin(null); setRemotePin(null); setResult(null); setError(null);
    rxRef.current = { chunks: [], expected: 0 };
  }, [cleanup]);

  const sendLocalData = useCallback(async () => {
    const json = JSON.stringify(await exportLocalData());
    const chunks = chunkString(json);
    connRef.current.send({ type: 'meta', total: chunks.length });
    chunks.forEach((d, i) => connRef.current.send({ type: 'chunk', index: i, data: d }));
  }, []);

  const handleData = useCallback(async (data) => {
    if (!data || typeof data !== 'object') return;

    if (data.type === 'pin') {
      setRemotePin(data.pin);
      go('pin_confirm');
      return;
    }

    if (data.type === 'pin_ok') {
      go('transferring');
      await sendLocalData();
      return;
    }

    if (data.type === 'meta') {
      if (typeof data.total !== 'number' || data.total < 1 || data.total > 2000) return;
      rxRef.current = { chunks: new Array(data.total), expected: data.total };
      return;
    }

    if (data.type === 'chunk') {
      if (phaseRef.current !== 'transferring' && phaseRef.current !== 'merging') return;
      rxRef.current.chunks[data.index] = data.data;
      const filled = rxRef.current.chunks.filter(c => c !== undefined).length;
      if (filled === rxRef.current.expected) {
        try {
          go('merging');
          const mergeResult = await mergeRemoteData(JSON.parse(rxRef.current.chunks.join('')));
          setResult(mergeResult);
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

  const startAsHost = useCallback(() => {
    go('generating');
    const newPin = generatePin();
    pinRef.current = newPin;
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
      connRef.current = conn;
      conn.on('open', () => {
        go('pin_confirm');
        conn.send({ type: 'pin', pin: pinRef.current });
      });
      conn.on('data', handleData);
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
    const peer = new Peer();
    peerRef.current = peer;

    peer.on('open', () => {
      const conn = peer.connect(targetId, { reliable: true });
      connRef.current = conn;
      conn.on('data', handleData);
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

  const confirmPin = useCallback(async () => {
    if (!connRef.current) return;
    go('transferring');
    connRef.current.send({ type: 'pin_ok' });
    await sendLocalData();
  }, [sendLocalData]);

  return { phase, peerId, pin, remotePin, result, error, startAsHost, connectToPeer, confirmPin, reset };
}
