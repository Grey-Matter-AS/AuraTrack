import type { Hub } from './hub';

// The status page (this computer only). Plain HTML, no scripts from anywhere: it only reads what the hub says about itself.
const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
const ago = (t: number | null, now: number) => {
  if (t === null) return 'never';
  const m = Math.round((now - t) / 60_000);
  return m < 1 ? 'just now' : m < 90 ? `${m} minutes ago` : `${Math.round(m / 60)} hours ago`;
};

export function statusPage(hub: Hub, version: string, info: { port: number; tls: boolean }): string {
  const s = hub.status(version);
  const now = Date.now();
  const rows = s.devices
    .map(
      (d) =>
        `<tr><td>${esc(d.name)}</td><td>${ago(d.lastSeen, now)}</td><td>${d.revokedAt ? 'removed' : 'active'}</td></tr>`,
    )
    .join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>AuraTrack Hub</title><style>body{font:16px/1.5 system-ui,sans-serif;max-width:46rem;margin:2rem auto;padding:0 1rem;color:#111}
code,.code{font-family:ui-monospace,monospace}.code{font-size:1.6rem;letter-spacing:.1em}table{border-collapse:collapse;width:100%}td,th{padding:.4rem;border-bottom:1px solid #ccc;text-align:left}
.ok{color:#066}.warn{color:#a50}</style></head><body>
<h1>AuraTrack Hub <small>${esc(version)}</small></h1>
<p class="ok">Running on port ${info.port}${info.tls ? ' (https)' : ' (http: phones and the app need https, see below)'}.</p>
<h2>Set up a household</h2>
<p>${s.configured ? 'This hub already has a household.' : 'No household yet.'} In the app choose More, Household, Hub, and type this code:</p>
<p class="code">${esc(hub.adminCode())}</p>
<h2>Devices</h2>
<table><tr><th>Name</th><th>Last seen</th><th></th></tr>${rows || '<tr><td colspan="3">None yet.</td></tr>'}</table>
<h2>What it holds</h2>
<p>${s.entries} sealed entries, ${(s.bytes / 1024).toFixed(0)} KB. They are sealed: this program cannot read them. Last backup: ${ago(s.lastBackupAt, now)}.</p>
<h2>Reaching it from the phones</h2>
<p>Browsers only let an app talk to an <b>https</b> address. Two ways, you choose:</p>
<ul><li><b>Tailscale</b> (works at home and away; needs a free account): install Tailscale here and on each phone, then run <code>tailscale cert &lt;this-machine&gt;.ts.net</code> and start the hub with that certificate. The address is <code>https://&lt;this-machine&gt;.ts.net:${info.port}</code>.</li>
<li><b>Home Wi-Fi only</b> (no account; only at home): make a certificate for this computer's name with <code>openssl</code>, start the hub with it, and install the certificate on each phone so it is trusted.</li></ul>
<p>Start the hub with <code>HUB_CERT=/path/cert.pem HUB_KEY=/path/key.pem</code>. Test the connection from a phone by opening the address: it should answer with a line of text.</p>
<p><b>Open the app from the hub's own address</b> (start the hub with <code>HUB_APP</code> set to the app folder, as in the package's <code>app/</code>). The app at its usual address is not allowed to call a hub, on purpose, to keep what the page can send out strictly limited. The same goes for every phone: use the hub's address.</p>
<p class="warn">The hub is never put on a public website. If this computer is off, the devices still update each other when two are open at the same time.</p>
</body></html>`;
}
