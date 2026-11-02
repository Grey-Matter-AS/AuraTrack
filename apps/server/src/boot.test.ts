import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// The start-on-boot scripts are plain text; these checks keep them honest: each one points at hub.mjs, says what it needs, is
// not a secret holder, and the shell ones are executable.
const dir = join(__dirname, '..', 'scripts', 'boot');
const files = readdirSync(dir);

describe('start-on-boot scripts', () => {
  it('has one for each system, and a note for the tray icon', () => {
    expect(files.sort()).toEqual(['install-linux.sh', 'install-macos.sh', 'install-windows.ps1', 'tray.md']);
  });
  it.each(['install-linux.sh', 'install-macos.sh', 'install-windows.ps1'])(
    '%s runs hub.mjs, needs Node 24 and prints the status page address',
    (file) => {
      const text = readFileSync(join(dir, file), 'utf8');
      expect(text).toContain('hub.mjs');
      expect(text).toMatch(/Node 24/);
      expect(text).toContain('http://localhost:8420/status');
      expect(text).not.toMatch(/adminCode|password|secret|token/i);
    },
  );
  it('the shell scripts stop at the first error and are executable', () => {
    for (const file of ['install-linux.sh', 'install-macos.sh']) {
      expect(readFileSync(join(dir, file), 'utf8')).toContain('set -eu');
      expect(statSync(join(dir, file)).mode & 0o111).not.toBe(0);
    }
  });
  it('the Windows one stops on errors and restarts the hub when it stops', () => {
    const text = readFileSync(join(dir, 'install-windows.ps1'), 'utf8');
    expect(text).toContain("$ErrorActionPreference = 'Stop'");
    expect(text).toContain('-RestartCount');
  });
});
