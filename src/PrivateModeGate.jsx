import { useState } from 'react';

function PrivateModeGate({ blockedFeatures, onContinueAnyway }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  return (
    <div style={{
      backgroundColor: '#0f172a',
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem',
      fontFamily: 'system-ui, sans-serif',
      boxSizing: 'border-box',
    }}>
      <div style={{ maxWidth: '400px', width: '100%' }}>

        {/* Icon + Title */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{
            fontSize: '2.5rem',
            marginBottom: '0.75rem',
            color: '#d97706',
          }}>⚠</div>
          <h1 style={{
            color: '#fff',
            fontSize: '1.15rem',
            fontWeight: 900,
            letterSpacing: '0.05em',
            margin: '0 0 0.5rem',
            textTransform: 'uppercase',
          }}>
            Some Features Are Unavailable
          </h1>
          <p style={{
            color: '#9ca3af',
            fontSize: '0.85rem',
            lineHeight: 1.6,
            margin: 0,
          }}>
            AuraTrack detected that your browser is blocking features it needs to work.
            This usually happens in <strong style={{ color: '#e2e8f0' }}>private or incognito mode</strong>.
          </p>
        </div>

        {/* Blocked features list */}
        <div style={{
          backgroundColor: '#1e293b',
          borderRadius: '1rem',
          padding: '1rem',
          marginBottom: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
        }}>
          {blockedFeatures.map((f) => (
            <div key={f.name} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{
                  color: '#fff',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                }}>
                  {f.name}
                </span>
                <span style={{
                  fontSize: '0.6rem',
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  padding: '0.1rem 0.4rem',
                  borderRadius: '0.3rem',
                  backgroundColor: f.critical ? '#7f1d1d' : '#78350f',
                  color: f.critical ? '#fca5a5' : '#fde68a',
                }}>
                  {f.critical ? 'Required' : 'Recommended'}
                </span>
              </div>
              <p style={{
                color: '#94a3b8',
                fontSize: '0.75rem',
                lineHeight: 1.5,
                margin: 0,
              }}>
                {f.detail}
              </p>
            </div>
          ))}
        </div>

        {/* How to fix */}
        <div style={{
          backgroundColor: '#0f2744',
          border: '1px solid #1e3a5f',
          borderRadius: '1rem',
          padding: '1rem',
          marginBottom: '1.5rem',
        }}>
          <p style={{
            color: '#93c5fd',
            fontSize: '0.8rem',
            fontWeight: 700,
            margin: '0 0 0.4rem',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}>
            How to Fix
          </p>
          <p style={{
            color: '#cbd5e1',
            fontSize: '0.8rem',
            lineHeight: 1.6,
            margin: '0 0 0.75rem',
          }}>
            Reopen AuraTrack in a regular browser window — not private or incognito mode.
          </p>
          <button
            onClick={handleCopy}
            style={{
              backgroundColor: '#1e40af',
              color: '#bfdbfe',
              border: 'none',
              borderRadius: '0.6rem',
              padding: '0.5rem 1rem',
              fontSize: '0.7rem',
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              cursor: 'pointer',
              width: '100%',
            }}
          >
            {copied ? '✓ Link Copied' : 'Copy App Link'}
          </button>
        </div>

        {/* Continue anyway */}
        <div style={{ textAlign: 'center' }}>
          <button
            onClick={onContinueAnyway}
            style={{
              background: 'none',
              border: 'none',
              color: '#475569',
              fontSize: '0.7rem',
              cursor: 'pointer',
              textDecoration: 'underline',
              padding: '0.25rem',
            }}
          >
            I understand the risks — continue anyway
          </button>
        </div>

      </div>
    </div>
  );
}

export default PrivateModeGate;
