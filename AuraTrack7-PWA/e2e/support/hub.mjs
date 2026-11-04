// The built hub for the end-to-end tests: an empty data folder each time, on this computer only. Needs `pnpm build` first.
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const data = mkdtempSync(join(tmpdir(), 'auratrack-e2e-hub-'));
const child = spawn(process.execPath, ['apps/server/dist/hub.mjs'], {
  stdio: 'inherit',
  env: { ...process.env, HUB_PORT: '9420', HUB_DATA: data, HUB_BACKUPS: join(data, 'backups') },
});
child.on('exit', (code) => process.exit(code ?? 0));
process.on('SIGTERM', () => child.kill('SIGTERM'));
process.on('SIGINT', () => child.kill('SIGINT'));
