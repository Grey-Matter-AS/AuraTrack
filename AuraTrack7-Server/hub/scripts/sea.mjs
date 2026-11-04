// A single executable of the hub (Node's single-executable application), for a household without Node: dist/package/hub-<system>.
// Run after `pnpm build`. It copies this system's Node program and puts the hub inside it.
import { execFileSync } from 'node:child_process';
import { chmodSync, copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { inject } from 'postject';
import { readFileSync } from 'node:fs';

const win = process.platform === 'win32';
const out = join('dist', 'package');
mkdirSync(out, { recursive: true });
const blob = join('dist', 'hub.blob');
writeFileSync(
  join('dist', 'sea-config.json'),
  JSON.stringify({ main: 'dist/hub.cjs', output: blob, disableExperimentalSEAWarning: true, useCodeCache: false }),
);
execFileSync(process.execPath, ['--experimental-sea-config', join('dist', 'sea-config.json')], { stdio: 'inherit' });
const exe = join(out, `hub-${process.platform}-${process.arch}${win ? '.exe' : ''}`);
copyFileSync(process.execPath, exe);
if (process.platform === 'darwin') execFileSync('codesign', ['--remove-signature', exe]);
await inject(exe, 'NODE_SEA_BLOB', readFileSync(blob), {
  sentinelFuse: 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2',
  ...(process.platform === 'darwin' ? { machoSegmentName: 'NODE_SEA' } : {}),
});
if (process.platform === 'darwin') execFileSync('codesign', ['--sign', '-', exe]);
if (!win) chmodSync(exe, 0o755);
console.log(`built ${exe}`);
