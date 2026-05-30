import React, { useState, useEffect, useRef, useCallback } from 'react';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { useP2PSync } from '../hooks/useP2PSync';
import { useLANSync } from '../hooks/useLANSync';
import { exportToJSON } from '../utils/exportHelpers';
import { db } from '../data/db';

// ─── Shared sub-components ───────────────────────────────────

function QRImg({ dataUrl, label }) {
  if (!dataUrl) return (
    <div className="w-[200px] h-[200px] rounded-2xl flex items-center justify-center mx-auto"
      style={{ backgroundColor: 'var(--bg-raised)' }}>
      <span className="text-[10px] font-black uppercase tracking-widest animate-pulse"
        style={{ color: 'var(--text-on-raised-muted)' }}>Generating…</span>
    </div>
  );
  return (
    <div className="mx-auto w-fit">
      <img src={dataUrl} alt="QR Code" className="rounded-2xl w-[200px] h-[200px]" />
      {label && (
        <p className="text-center text-[9px] font-black uppercase tracking-widest mt-2"
          style={{ color: 'var(--text-dim)' }}>{label}</p>
      )}
    </div>
  );
}

function PinDisplay({ pin, label }) {
  return (
    <div className="rounded-2xl px-6 py-3 mx-auto w-fit text-center"
      style={{ backgroundColor: 'var(--bg-raised)' }}>
      <p className="text-[9px] font-black uppercase tracking-widest mb-1"
        style={{ color: 'var(--text-on-raised-muted)' }}>{label || 'Security PIN'}</p>
      <p className="text-4xl font-black tracking-[0.25em]" style={{ color: 'var(--text-on-raised)' }}>
        {pin}
      </p>
    </div>
  );
}

function StatusRow({ icon, text }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <span className="text-lg shrink-0">{icon}</span>
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{text}</p>
    </div>
  );
}

function DonePanel({ result, onClose }) {
  const total = (result?.events || 0) + (result?.medications || 0) + (result?.logs || 0);
  return (
    <div className="space-y-4 text-center">
      <div className="text-5xl mb-2">✓</div>
      <p className="text-lg font-black" style={{ color: 'var(--text-primary)' }}>Sync complete</p>
      {total === 0
        ? <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Both devices were already up to date — no new records added.</p>
        : <div className="space-y-1">
            {result.events > 0 && <StatusRow icon="📋" text={`${result.events} new event(s) added`} />}
            {result.medications > 0 && <StatusRow icon="💊" text={`${result.medications} new medication(s) added`} />}
            {result.logs > 0 && <StatusRow icon="🗓" text={`${result.logs} new dose log(s) added`} />}
          </div>
      }
      <button onClick={onClose}
        className="w-full py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest active:scale-95 transition-all"
        style={{ backgroundColor: 'var(--accent)', color: '#fff' }}>
        Close
      </button>
    </div>
  );
}

function ErrorPanel({ error, onRetry, onClose }) {
  return (
    <div className="space-y-4 text-center">
      <div className="text-4xl mb-2">⚠</div>
      <p className="text-sm font-bold" style={{ color: 'var(--status-missed-text)' }}>{error}</p>
      <div className="flex gap-3">
        {onRetry && (
          <button onClick={onRetry}
            className="flex-1 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest active:scale-95 transition-all"
            style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-on-raised)' }}>
            Try again
          </button>
        )}
        <button onClick={onClose}
          className="flex-1 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest active:scale-95 transition-all"
          style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-on-raised-muted)' }}>
          Close
        </button>
      </div>
    </div>
  );
}

// ─── In-app QR scanner (for Phase 3 answer scan) ─────────────

function QRScanner({ onScan, onCancel }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const [camError, setCamError] = useState(null);

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (!mounted) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        const video = videoRef.current;
        video.srcObject = stream;
        await video.play();

        const scan = () => {
          if (!mounted || !videoRef.current) return;
          const canvas = canvasRef.current;
          const ctx = canvas.getContext('2d');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code?.data) {
            stopCamera();
            onScan(code.data);
          } else {
            rafRef.current = requestAnimationFrame(scan);
          }
        };
        rafRef.current = requestAnimationFrame(scan);
      } catch (e) {
        if (mounted) setCamError(e.name === 'NotAllowedError'
          ? 'Camera access denied. Allow camera permission and try again.'
          : `Camera error: ${e.message}`);
      }
    })();
    return () => { mounted = false; stopCamera(); };
  }, [onScan, stopCamera]);

  if (camError) return (
    <div className="space-y-4 text-center">
      <p className="text-sm" style={{ color: 'var(--status-missed-text)' }}>{camError}</p>
      <button onClick={onCancel}
        className="w-full py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest"
        style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-on-raised)' }}>
        Go back
      </button>
    </div>
  );

  return (
    <div className="space-y-3">
      <p className="text-[10px] font-black uppercase tracking-widest text-center"
        style={{ color: 'var(--text-dim)' }}>Point camera at Device B's QR code</p>
      <div className="relative rounded-2xl overflow-hidden aspect-square w-full max-w-[240px] mx-auto"
        style={{ backgroundColor: '#000' }}>
        <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
        <canvas ref={canvasRef} className="hidden" />
        <div className="absolute inset-0 border-[3px] rounded-2xl pointer-events-none"
          style={{ borderColor: 'var(--accent)' }} />
      </div>
      <button onClick={onCancel}
        className="w-full py-2 rounded-xl text-[10px] font-black uppercase tracking-widest"
        style={{ color: 'var(--text-dim)' }}>
        Cancel
      </button>
    </div>
  );
}

// ─── Easy Sync (PeerJS) panel ─────────────────────────────────

function EasySyncPanel({ connectToken, onDone }) {
  const p2p = useP2PSync();
  const [qrUrl, setQrUrl] = useState(null);

  // Guest: auto-connect when opened with a token from scanned QR
  useEffect(() => {
    if (connectToken) p2p.connectToPeer(connectToken);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectToken]);

  // Host: generate QR once peer ID is known
  useEffect(() => {
    if (p2p.peerId) {
      const url = `${window.location.origin}${window.location.pathname}#sync=${p2p.peerId}`;
      QRCode.toDataURL(url, { width: 220, margin: 2, errorCorrectionLevel: 'M' })
        .then(setQrUrl);
    }
  }, [p2p.peerId]);

  const phase = p2p.phase;

  if (phase === 'done') return <DonePanel result={p2p.result} onClose={onDone} />;
  if (phase === 'error' || phase === 'timeout') return (
    <ErrorPanel error={p2p.error} onRetry={p2p.reset} onClose={onDone} />
  );

  if (phase === 'idle') return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        Sync over the internet between any two devices. Device A shows a QR code — Device B scans it with its camera to connect. Works across different networks (mobile data, WiFi).
      </p>
      <StatusRow icon="🔒" text="Data travels peer-to-peer, encrypted with DTLS. A PIN confirms both devices are yours." />
      <StatusRow icon="🌐" text="Uses PeerJS relay for signaling only — your health data never passes through any server." />
      <button onClick={p2p.startAsHost}
        className="w-full py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest active:scale-95 transition-all"
        style={{ backgroundColor: 'var(--accent)', color: '#fff' }}>
        Start — Show QR Code
      </button>
    </div>
  );

  if (phase === 'generating') return (
    <StatusRow icon="⏳" text="Connecting to relay server…" />
  );

  if (phase === 'waiting') return (
    <div className="space-y-4">
      <QRImg dataUrl={qrUrl} label="Scan with Device B's camera" />
      <PinDisplay pin={p2p.pin} label="Security PIN — verify on both screens" />
      <StatusRow icon="⏳" text="Waiting for Device B to connect… (90s)" />
    </div>
  );

  if (phase === 'connecting') return (
    <StatusRow icon="⏳" text="Connecting to Device A…" />
  );

  if (phase === 'pin_confirm') {
    const isGuest = !!connectToken;
    if (isGuest) return (
      <div className="space-y-4">
        <p className="text-sm font-black text-center" style={{ color: 'var(--text-primary)' }}>
          Does this PIN match Device A's screen?
        </p>
        <PinDisplay pin={p2p.remotePin} />
        <button onClick={p2p.confirmPin}
          className="w-full py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest active:scale-95 transition-all"
          style={{ backgroundColor: 'var(--accent)', color: '#fff' }}>
          ✓ PINs Match — Start Sync
        </button>
        <button onClick={p2p.reset}
          className="w-full py-2 text-[10px] font-black uppercase tracking-widest"
          style={{ color: 'var(--text-dim)' }}>
          PINs don't match — Cancel
        </button>
      </div>
    );
    // Host: waiting for guest to confirm
    return (
      <div className="space-y-4">
        <PinDisplay pin={p2p.pin} label="Verify this PIN on Device B" />
        <StatusRow icon="⏳" text="Waiting for Device B to confirm the PIN…" />
      </div>
    );
  }

  if (phase === 'transferring' || phase === 'merging') return (
    <StatusRow icon="⏳" text={phase === 'merging' ? 'Merging records…' : 'Transferring data…'} />
  );

  return null;
}

// ─── Private Sync (LAN) panel ─────────────────────────────────

function PrivateSyncPanel({ offerSDP, onDone }) {
  const lan = useLANSync();
  const [scanning, setScanning] = useState(false);

  // Guest: auto-process offer when opened with encoded SDP
  useEffect(() => {
    if (offerSDP) lan.startAsGuest(offerSDP);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offerSDP]);

  const handleAnswerScanned = useCallback((url) => {
    setScanning(false);
    const match = url.match(/#sdp-answer=(.+)/);
    if (match) {
      lan.applyAnswer(match[1]);
    } else {
      // Not an answer QR — ignore and let user try again
    }
  }, [lan]);

  const phase = lan.phase;

  if (phase === 'done') return <DonePanel result={lan.result} onClose={onDone} />;
  if (phase === 'error') return <ErrorPanel error={lan.error} onRetry={lan.reset} onClose={onDone} />;

  if (scanning) return (
    <QRScanner
      onScan={handleAnswerScanned}
      onCancel={() => setScanning(false)}
    />
  );

  if (phase === 'idle') return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        Direct device-to-device sync with zero third-party involvement. Both devices must be on the same WiFi network. No internet required after setup.
      </p>
      <StatusRow icon="🔒" text="Signaling travels via QR codes only — no relay server. Your data and metadata stay on your local network." />
      <StatusRow icon="📶" text="Requires two QR scans: Device B scans Device A's offer QR, then Device A scans Device B's answer QR." />
      <button onClick={lan.startAsHost}
        className="w-full py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest active:scale-95 transition-all"
        style={{ backgroundColor: 'var(--accent)', color: '#fff' }}>
        Start — Generate Connection QR
      </button>
    </div>
  );

  if (phase === 'generating_offer') return <StatusRow icon="⏳" text="Generating secure connection code…" />;
  if (phase === 'generating_answer') return <StatusRow icon="⏳" text="Processing connection code…" />;

  if (phase === 'waiting_scan') return (
    <div className="space-y-4">
      <QRImg dataUrl={lan.offerQR} label="Step 1: Scan this with Device B's camera" />
      <PinDisplay pin={lan.pin} label="Security PIN — verify on both screens" />
      <p className="text-[10px] text-center" style={{ color: 'var(--text-dim)' }}>
        After Device B scans, it will show an answer QR
      </p>
      <button onClick={() => setScanning(true)}
        className="w-full py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest active:scale-95 transition-all"
        style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-on-raised)' }}>
        Step 2: Scan Device B's Answer QR
      </button>
    </div>
  );

  if (phase === 'waiting_answer') return (
    <div className="space-y-4">
      <QRImg dataUrl={lan.answerQR} label="Show this to Device A — it will scan it" />
      <StatusRow icon="⏳" text="Waiting for Device A to scan this QR code…" />
    </div>
  );

  if (phase === 'connecting') return <StatusRow icon="⏳" text="Establishing direct connection…" />;

  if (phase === 'pin_confirm') return (
    <div className="space-y-4">
      <p className="text-sm font-black text-center" style={{ color: 'var(--text-primary)' }}>
        {lan.isHost ? 'Verify this PIN on Device B' : 'Does this PIN match Device A\'s screen?'}
      </p>
      <PinDisplay pin={lan.isHost ? lan.pin : lan.remotePin} />
      {!lan.isHost && (
        <>
          <button onClick={lan.confirmPin}
            className="w-full py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest active:scale-95 transition-all"
            style={{ backgroundColor: 'var(--accent)', color: '#fff' }}>
            ✓ PINs Match — Start Sync
          </button>
          <button onClick={lan.reset}
            className="w-full py-2 text-[10px] font-black uppercase tracking-widest"
            style={{ color: 'var(--text-dim)' }}>
            PINs don't match — Cancel
          </button>
        </>
      )}
      {lan.isHost && <StatusRow icon="⏳" text="Waiting for Device B to confirm the PIN…" />}
    </div>
  );

  if (phase === 'transferring' || phase === 'merging') return (
    <StatusRow icon="⏳" text={phase === 'merging' ? 'Merging records…' : 'Transferring data…'} />
  );

  return null;
}

// ─── Manual File panel ────────────────────────────────────────

function ManualFilePanel({ onDone }) {
  const [status, setStatus] = useState(null);
  const fileRef = useRef(null);

  const handleExport = async () => {
    try {
      const events = await db.events.toArray();
      const medications = await db.medications.toArray().catch(() => []);
      const medicationLogs = await db.medicationLogs.toArray().catch(() => []);
      if (!events.length && !medications.length) { setStatus('No data to export.'); return; }
      await exportToJSON(events, medications, medicationLogs);
      setStatus(`Exported ${events.length} event(s).`);
    } catch { setStatus('Export failed.'); }
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { mergeRemoteData } = await import('../utils/syncHelpers');
      const parsed = JSON.parse(await file.text());
      const r = await mergeRemoteData(parsed);
      const total = r.events + r.medications + r.logs;
      setStatus(total ? `Added ${r.events} event(s), ${r.medications} medication(s), ${r.logs} dose log(s).` : 'Already up to date — no new records.');
    } catch { setStatus('Import failed — invalid or corrupted file.'); }
    e.target.value = '';
  };

  const handleImportClick = async () => {
    if ('showOpenFilePicker' in window) {
      try {
        const [h] = await window.showOpenFilePicker({
          types: [{ description: 'AuraTrack Backup', accept: { 'application/json': ['.json'] } }],
          multiple: false,
        });
        const file = await h.getFile();
        const fakeEvent = { target: { files: [file], value: '' } };
        await handleImport(fakeEvent);
        return;
      } catch (e) { if (e.name === 'AbortError') return; }
    }
    fileRef.current?.click();
  };

  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        Export a full JSON backup from this device, share it via AirDrop, Files, email, or cloud storage, then import it on the other device. Safe to repeat — duplicates are automatically skipped.
      </p>
      <div className="space-y-2">
        <button onClick={handleExport}
          className="w-full py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2"
          style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-on-raised)' }}>
          <span>⬇</span> Export Backup (JSON)
        </button>
        <button onClick={handleImportClick}
          className="w-full py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2"
          style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-on-raised)' }}>
          <span>⬆</span> Import Backup (JSON)
        </button>
        <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
      </div>
      {status && (
        <p className="text-[11px] font-bold text-center py-1" style={{ color: 'var(--text-secondary)' }}>
          {status}
        </p>
      )}
      <button onClick={onDone}
        className="w-full py-2 text-[10px] font-black uppercase tracking-widest"
        style={{ color: 'var(--text-dim)' }}>
        Done
      </button>
    </div>
  );
}

// ─── Root SyncModal ───────────────────────────────────────────

const MODES = [
  { id: 'easy',    label: 'Easy Sync',     sub: 'Internet' },
  { id: 'private', label: 'Private Sync',  sub: 'Same WiFi' },
  { id: 'manual',  label: 'Manual File',   sub: 'Export / Import' },
];

export default function SyncModal({ isOpen, onClose, connectToken, offerSDP }) {
  // If opened via URL hash, jump straight to the right mode
  const defaultMode = connectToken ? 'easy' : offerSDP ? 'private' : null;
  const [mode, setMode] = useState(defaultMode);
  const isLinked = !!(connectToken || offerSDP); // came from QR scan — lock the mode

  // Reset mode when opened fresh (no link)
  useEffect(() => {
    if (isOpen && !connectToken && !offerSDP) setMode(null);
  }, [isOpen, connectToken, offerSDP]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl overflow-hidden"
        style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div>
            <h2 className="text-[11px] font-black uppercase tracking-widest"
              style={{ color: 'var(--text-primary)' }}>Sync to Another Device</h2>
            {mode && !isLinked && (
              <button onClick={() => setMode(null)}
                className="text-[10px] font-bold mt-0.5"
                style={{ color: 'var(--text-dim)' }}>
                ← Back
              </button>
            )}
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-xl text-sm font-black flex items-center justify-center active:scale-95 transition-all"
            style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-on-raised)' }}>
            ✕
          </button>
        </div>

        {/* Mode selector */}
        {!mode && (
          <div className="p-4 space-y-2">
            {MODES.map(m => (
              <button key={m.id} onClick={() => setMode(m.id)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-2xl active:scale-95 transition-all"
                style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
                <div className="text-left">
                  <p className="text-[11px] font-black uppercase tracking-widest"
                    style={{ color: 'var(--text-on-raised)' }}>{m.label}</p>
                  <p className="text-[10px]" style={{ color: 'var(--text-on-raised-muted)' }}>{m.sub}</p>
                </div>
                <span style={{ color: 'var(--text-on-raised-muted)' }}>›</span>
              </button>
            ))}
          </div>
        )}

        {/* Mode content */}
        {mode && (
          <div className="p-5 pb-8">
            {mode === 'easy'    && <EasySyncPanel connectToken={connectToken} onDone={onClose} />}
            {mode === 'private' && <PrivateSyncPanel offerSDP={offerSDP} onDone={onClose} />}
            {mode === 'manual'  && <ManualFilePanel onDone={onClose} />}
          </div>
        )}
      </div>
    </div>
  );
}
