import { useState, useEffect, useRef, useCallback } from 'react';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { useP2PSync } from '../hooks/useP2PSync';
import { useLANSync } from '../hooks/useLANSync';
import { CloseIcon, DownloadIcon, UploadIcon } from './AppIcons';
import { exportToJSON } from '../utils/exportHelpers';
import { db } from '../data/db';
import { assertImportFileSafe } from '../utils/importSanitizer';

// ─── Shared sub-components ───────────────────────────────────

function QRImg({ dataUrl, label }) {
  if (!dataUrl) return (
    <div className="w-[280px] h-[280px] rounded-2xl flex items-center justify-center mx-auto"
      style={{ backgroundColor: 'var(--bg-raised)' }}>
      <span className="text-[10px] font-black uppercase tracking-widest animate-pulse"
        style={{ color: 'var(--text-on-raised-muted)' }}>Generating…</span>
    </div>
  );
  return (
    <div className="mx-auto w-fit">
      <img src={dataUrl} alt="QR Code" className="rounded-2xl w-[280px] h-[280px] max-w-full" />
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

function RoleBadge({ role }) {
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full"
      style={{ backgroundColor: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)' }}>
      <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: '#60a5fa' }}>
        {role === 'sender' ? 'Sender Profile' : 'Receiver Profile'}
      </span>
    </div>
  );
}

function RoleSelector({ role, onChange, locked = false }) {
  const options = [
    { id: 'sender', label: 'Sender', sub: 'This device sends data out' },
    { id: 'receiver', label: 'Receiver', sub: 'This device receives data in' },
  ];

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>
        Device Role
      </p>
      <div className="grid grid-cols-2 gap-2">
        {options.map(option => {
          const selected = role === option.id;
          return (
            <button
              key={option.id}
              onClick={() => !locked && onChange(option.id)}
              disabled={locked}
              className="rounded-2xl px-3 py-3 text-left transition-all disabled:opacity-90"
              style={selected
                ? { backgroundColor: 'color-mix(in srgb, var(--accent) 18%, var(--bg-raised))', border: '1px solid var(--accent)' }
                : { backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)' }}
            >
              <p className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--text-primary)' }}>
                {option.label}
              </p>
              <p className="text-[10px] mt-1" style={{ color: 'var(--text-secondary)' }}>
                {option.sub}
              </p>
            </button>
          );
        })}
      </div>
      {locked && (
        <p className="text-[10px]" style={{ color: 'var(--text-dim)' }}>
          Role locked because this page was opened from a sync QR code.
        </p>
      )}
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

function QRScanner({ onScan, onCancel, prompt = "Point camera at the QR code" }) {
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
        style={{ color: 'var(--text-dim)' }}>{prompt}</p>
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

function EasySyncPanel({ connectToken, role, onDone, onScanSenderQR }) {
  const p2p = useP2PSync();
  const [qrUrl, setQrUrl] = useState(null);

  // Guest: auto-connect when opened with a token from scanned QR
  useEffect(() => {
    if (connectToken && p2p.phase === 'idle') p2p.connectToPeer(connectToken);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectToken, p2p.phase]);

  // Host: generate QR once peer ID is known
  useEffect(() => {
    if (p2p.peerId) {
      const url = `${window.location.origin}${window.location.pathname}#sync=${p2p.peerId}`;
      QRCode.toDataURL(url, { width: 320, margin: 2, errorCorrectionLevel: 'L' })
        .then(setQrUrl);
    }
  }, [p2p.peerId]);

  const phase = p2p.phase;
  const retry = connectToken
    ? () => p2p.reset()
    : () => { p2p.reset(); setTimeout(() => p2p.startAsHost(), 0); };

  if (phase === 'done') return <DonePanel result={p2p.result} onClose={onDone} />;
  if (phase === 'error' || phase === 'timeout') return (
    <ErrorPanel error={p2p.error} onRetry={retry} onClose={onDone} />
  );

  if (phase === 'idle') return (
    <div className="space-y-4">
      <RoleBadge role={role} />
      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        {role === 'sender'
          ? 'This device will send its AuraTrack data to another device over the internet. Start here, then let the receiving device scan the QR code.'
          : 'This device will receive AuraTrack data from another device over the internet. On the sender device, open Easy Sync and scan its QR code with this device.'}
      </p>
      <StatusRow icon="🔒" text="Data travels peer-to-peer over a browser-encrypted connection. A PIN confirms both devices are yours." />
      <StatusRow icon="🌐" text="PeerJS is used for connection signaling only; sync still shares metadata such as connection IDs." />
      {role === 'sender' ? (
        <button onClick={p2p.startAsHost}
          className="w-full py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest active:scale-95 transition-all"
          style={{ backgroundColor: 'var(--accent)', color: '#fff' }}>
          Start Sender Setup
        </button>
      ) : (
        <>
          <button onClick={onScanSenderQR}
            className="w-full py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest active:scale-95 transition-all"
            style={{ backgroundColor: 'var(--accent)', color: '#fff' }}>
            Scan Sender QR in App
          </button>
          <div className="rounded-2xl p-4" style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
            <p className="text-[11px] font-bold" style={{ color: 'var(--text-primary)' }}>
              Receiver steps
            </p>
            <p className="text-[10px] mt-2" style={{ color: 'var(--text-secondary)' }}>
              1. Open Easy Sync on the sender device.
            </p>
            <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
              2. Scan the sender QR with this device.
            </p>
            <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
              3. Compare the PINs and press Start Sync on this receiving device.
            </p>
          </div>
        </>
      )}
    </div>
  );

  if (phase === 'generating') return (
    <div className="space-y-3">
      <RoleBadge role={role} />
      <StatusRow icon="⏳" text="Connecting to relay server…" />
    </div>
  );

  if (phase === 'waiting') return (
    <div className="space-y-4">
      <RoleBadge role={role} />
      <QRImg dataUrl={qrUrl} label="Receiver: scan this QR code" />
      <PinDisplay pin={p2p.pin} label="Security PIN — verify on both screens" />
      <StatusRow icon="⏳" text="Waiting for the receiver device to connect… (90s)" />
    </div>
  );

  if (phase === 'connecting') return (
    <div className="space-y-3">
      <RoleBadge role={role} />
      <StatusRow icon="⏳" text="Connecting to the sender device…" />
    </div>
  );

  if (phase === 'pin_confirm') {
    const isGuest = !!connectToken;
    if (isGuest) return (
      <div className="space-y-4">
        <RoleBadge role="receiver" />
        <p className="text-sm font-black text-center" style={{ color: 'var(--text-primary)' }}>
          Does this PIN match the sender device?
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
        <RoleBadge role="sender" />
        <PinDisplay pin={p2p.pin} label="Verify this PIN on the receiver device" />
        <StatusRow icon="⏳" text="Waiting for the receiver device to confirm the PIN…" />
      </div>
    );
  }

  if (phase === 'transferring' || phase === 'merging') return (
    <div className="space-y-3">
      <RoleBadge role={role} />
      <StatusRow icon="⏳" text={phase === 'merging' ? 'Merging records…' : 'Transferring data…'} />
    </div>
  );

  return null;
}

// ─── Private Sync (LAN) panel ─────────────────────────────────

function PrivateSyncPanel({ offerSDP, role, onDone, onScanSenderQR }) {
  const lan = useLANSync();
  const [scanning, setScanning] = useState(false);

  // Guest: auto-process offer when opened with encoded SDP
  useEffect(() => {
    if (offerSDP && lan.phase === 'idle') lan.startAsGuest(offerSDP);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offerSDP, lan.phase]);

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
  const retry = offerSDP
    ? () => lan.reset()
    : () => { lan.reset(); setTimeout(() => lan.startAsHost(), 0); };

  if (phase === 'done') return <DonePanel result={lan.result} onClose={onDone} />;
  if (phase === 'error') return <ErrorPanel error={lan.error} onRetry={retry} onClose={onDone} />;

  if (scanning) return (
    <QRScanner
      onScan={handleAnswerScanned}
      onCancel={() => setScanning(false)}
    />
  );

  if (phase === 'idle') return (
    <div className="space-y-4">
      <RoleBadge role={role} />
      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        {role === 'sender'
          ? 'This device will send its AuraTrack data directly over the same WiFi network. No relay server is used after setup.'
          : 'This device will receive AuraTrack data directly over the same WiFi network. Start on the sender device, then scan its connection QR from this device.'}
      </p>
      <StatusRow icon="🔒" text="Signaling travels via QR codes only — no relay server. Your data and metadata stay on your local network." />
      <StatusRow icon="📶" text="Requires two QR scans: receiver scans sender offer QR, then sender scans receiver answer QR." />
      {role === 'sender' ? (
        <button onClick={lan.startAsHost}
          className="w-full py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest active:scale-95 transition-all"
          style={{ backgroundColor: 'var(--accent)', color: '#fff' }}>
          Start Sender Setup
        </button>
      ) : (
        <>
          <button onClick={onScanSenderQR}
            className="w-full py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest active:scale-95 transition-all"
            style={{ backgroundColor: 'var(--accent)', color: '#fff' }}>
            Scan Sender QR in App
          </button>
          <div className="rounded-2xl p-4" style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
            <p className="text-[11px] font-bold" style={{ color: 'var(--text-primary)' }}>
              Receiver steps
            </p>
            <p className="text-[10px] mt-2" style={{ color: 'var(--text-secondary)' }}>
              1. Open Private Sync on the sender device.
            </p>
            <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
              2. Scan the sender connection QR with this device.
            </p>
            <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
              3. Show the answer QR back to the sender device.
            </p>
          </div>
        </>
      )}
    </div>
  );

  if (phase === 'generating_offer') return <div className="space-y-3"><RoleBadge role="sender" /><StatusRow icon="⏳" text="Generating secure connection code…" /></div>;
  if (phase === 'generating_answer') return <div className="space-y-3"><RoleBadge role="receiver" /><StatusRow icon="⏳" text="Processing sender connection code…" /></div>;

  if (phase === 'waiting_scan') return (
    <div className="space-y-4">
      <RoleBadge role="sender" />
      <QRImg dataUrl={lan.offerQR} label="Step 1: Receiver scans this QR code" />
      <PinDisplay pin={lan.pin} label="Security PIN — verify on both screens" />
      <p className="text-[10px] text-center" style={{ color: 'var(--text-dim)' }}>
        After the receiver scans this, it will show an answer QR
      </p>
      <button onClick={() => setScanning(true)}
        className="w-full py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest active:scale-95 transition-all"
        style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-on-raised)' }}>
        Step 2: Scan Receiver Answer QR
      </button>
    </div>
  );

  if (phase === 'waiting_answer') return (
    <div className="space-y-4">
      <RoleBadge role="receiver" />
      <QRImg dataUrl={lan.answerQR} label="Show this to the sender device to scan" />
      <StatusRow icon="⏳" text="Waiting for the sender device to scan this QR code…" />
    </div>
  );

  if (phase === 'connecting') return <div className="space-y-3"><RoleBadge role={lan.isHost ? 'sender' : 'receiver'} /><StatusRow icon="⏳" text="Establishing direct connection…" /></div>;

  if (phase === 'pin_confirm') return (
    <div className="space-y-4">
      <RoleBadge role={lan.isHost ? 'sender' : 'receiver'} />
      <p className="text-sm font-black text-center" style={{ color: 'var(--text-primary)' }}>
        {lan.isHost ? 'Verify this PIN on the receiver device' : 'Does this PIN match the sender device?'}
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
      {lan.isHost && <StatusRow icon="⏳" text="Waiting for the receiver device to confirm the PIN…" />}
    </div>
  );

  if (phase === 'transferring' || phase === 'merging') return (
    <div className="space-y-3">
      <RoleBadge role={lan.isHost ? 'sender' : 'receiver'} />
      <StatusRow icon="⏳" text={phase === 'merging' ? 'Merging records…' : 'Transferring data…'} />
    </div>
  );

  return null;
}

// ─── Manual File panel ────────────────────────────────────────

function ManualFilePanel({ role, onDone }) {
  const [status, setStatus] = useState(null);
  const fileRef = useRef(null);

  const handleExport = async () => {
    try {
      const events = await db.events.toArray();
      const settingsRows = await db.settings.toArray().catch(() => []);
      const medications = await db.medications.toArray().catch(() => []);
      const medicationLogs = await db.medicationLogs.toArray().catch(() => []);
      const eegSessions = await db.eegSessions.toArray().catch(() => []);
      const eegActivities = await db.eegActivities.toArray().catch(() => []);
      if (!events.length && !medications.length) { setStatus('No data to export.'); return; }
      const result = await exportToJSON({
        settings: settingsRows,
        events,
        medications,
        medicationLogs,
        eegSessions,
        eegActivities,
      });
      if (result?.ok) setStatus(`Exported ${events.length} event(s).`);
      else if (!result?.cancelled) setStatus('Export failed.');
    } catch { setStatus('Export failed.'); }
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      assertImportFileSafe(file);
      const { mergeRemoteData } = await import('../utils/syncHelpers');
      const parsed = JSON.parse(await file.text());
      const r = await mergeRemoteData(parsed);
      const total = r.settings + r.events + r.medications + r.logs + r.eegSessions + r.eegActivities;
      setStatus(total
        ? `Added ${r.events} event(s), ${r.medications} medication(s), ${r.logs} dose log(s), ${r.eegSessions} EEG session(s), and ${r.eegActivities} EEG activity record(s).${r.conflicts?.length ? ` ${r.conflicts.length} conflict(s) kept local records.` : ''}`
        : 'Already up to date — no new records.');
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
      <RoleBadge role={role} />
      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        {role === 'sender'
          ? 'Export a full JSON backup from this device and send that file to the receiving device by AirDrop, Files, email, or cloud storage.'
          : 'Import a JSON backup that was exported from the sender device. Safe to repeat — duplicates are automatically skipped.'}
      </p>
      <div className="space-y-2">
        <button onClick={handleExport}
          className="w-full py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2"
          style={role === 'sender'
            ? { backgroundColor: 'var(--accent)', color: '#fff' }
            : { backgroundColor: 'var(--bg-raised)', color: 'var(--text-on-raised)' }}>
          <DownloadIcon className="w-4 h-4" /> Export Backup (JSON)
        </button>
        <button onClick={handleImportClick}
          className="w-full py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2"
          style={role === 'receiver'
            ? { backgroundColor: 'var(--accent)', color: '#fff' }
            : { backgroundColor: 'var(--bg-raised)', color: 'var(--text-on-raised)' }}>
          <UploadIcon className="w-4 h-4" /> Import Backup (JSON)
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
  const defaultRole = connectToken || offerSDP ? 'receiver' : 'sender';
  const [mode, setMode] = useState(defaultMode);
  const [role, setRole] = useState(defaultRole);
  const [scanningReceiverQR, setScanningReceiverQR] = useState(false);
  const [scanError, setScanError] = useState('');
  const [scannedConnectToken, setScannedConnectToken] = useState(null);
  const [scannedOfferSDP, setScannedOfferSDP] = useState(null);
  const effectiveConnectToken = connectToken ?? scannedConnectToken;
  const effectiveOfferSDP = offerSDP ?? scannedOfferSDP;
  const isLinked = !!(connectToken || offerSDP); // came from external QR/app link — lock the mode
  const isReceiverLocked = isLinked || !!(scannedConnectToken || scannedOfferSDP);

  const clearScannedRouting = useCallback(() => {
    setScannedConnectToken(null);
    setScannedOfferSDP(null);
    setScanError('');
  }, []);

  // Reset mode when opened fresh (no link)
  useEffect(() => {
    if (!isOpen || connectToken || offerSDP) return;
    const id = setTimeout(() => {
      setMode(null);
      setRole('sender');
      setScanningReceiverQR(false);
      clearScannedRouting();
    }, 0);
    return () => clearTimeout(id);
  }, [isOpen, connectToken, offerSDP, clearScannedRouting]);

  useEffect(() => {
    if (!isOpen) return;
    if (!(connectToken || offerSDP)) return;
    const id = setTimeout(() => setRole('receiver'), 0);
    return () => clearTimeout(id);
  }, [isOpen, connectToken, offerSDP]);

  const startReceiverScan = useCallback(() => {
    setScanError('');
    setScanningReceiverQR(true);
  }, []);

  const handleReceiverScan = useCallback((rawValue) => {
    setScanningReceiverQR(false);
    setScanError('');

    const value = String(rawValue || '').trim();
    const syncMatch = value.match(/#sync=([^&]+)/);
    const offerMatch = value.match(/#sdp=([^&]+)/);

    if (syncMatch) {
      clearScannedRouting();
      setScannedConnectToken(syncMatch[1]);
      setRole('receiver');
      setMode('easy');
      return;
    }

    if (offerMatch) {
      clearScannedRouting();
      setScannedOfferSDP(offerMatch[1]);
      setRole('receiver');
      setMode('private');
      return;
    }

    setScanError('That QR code is not a valid AuraTrack sync code.');
  }, [clearScannedRouting]);

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
              <button onClick={() => {
                setMode(null);
                setScanningReceiverQR(false);
                clearScannedRouting();
              }}
                className="text-[10px] font-bold mt-0.5"
                style={{ color: 'var(--text-dim)' }}>
                ← Back
              </button>
            )}
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-xl text-sm font-black flex items-center justify-center active:scale-95 transition-all"
            style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-on-raised)' }}>
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Mode selector */}
        {!mode && !scanningReceiverQR && (
          <div className="p-4 space-y-4">
            <RoleSelector role={role} onChange={setRole} locked={false} />
            {role === 'receiver' && (
              <button onClick={startReceiverScan}
                className="w-full py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest active:scale-95 transition-all"
                style={{ backgroundColor: 'var(--accent)', color: '#fff' }}>
                Scan Sender QR in App
              </button>
            )}
            {scanError && (
              <p className="text-[11px] font-bold text-center" style={{ color: 'var(--status-missed-text)' }}>
                {scanError}
              </p>
            )}
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
        {scanningReceiverQR && (
          <div className="p-5 pb-8">
            <QRScanner
              onScan={handleReceiverScan}
              onCancel={() => setScanningReceiverQR(false)}
              prompt="Point camera at the sender device QR code"
            />
          </div>
        )}
        {mode && (
          !scanningReceiverQR && <div className="p-5 pb-8 space-y-5">
            <RoleSelector role={role} onChange={(nextRole) => {
              setRole(nextRole);
              if (nextRole !== 'receiver') clearScannedRouting();
            }} locked={isReceiverLocked} />
            {scanError && (
              <p className="text-[11px] font-bold text-center" style={{ color: 'var(--status-missed-text)' }}>
                {scanError}
              </p>
            )}
            {mode === 'easy'    && <EasySyncPanel connectToken={effectiveConnectToken} role={role} onDone={onClose} onScanSenderQR={startReceiverScan} />}
            {mode === 'private' && <PrivateSyncPanel offerSDP={effectiveOfferSDP} role={role} onDone={onClose} onScanSenderQR={startReceiverScan} />}
            {mode === 'manual'  && <ManualFilePanel role={role} onDone={onClose} />}
          </div>
        )}
      </div>
    </div>
  );
}
