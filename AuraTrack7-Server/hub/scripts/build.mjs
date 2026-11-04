// The hub as one file: dist/hub.mjs (run with `node dist/hub.mjs`) and dist/hub.cjs (for the single executable, which wants CommonJS).
import { build } from 'esbuild';

const common = { entryPoints: ['src/main.ts'], bundle: true, platform: 'node', target: 'node24', logLevel: 'info' };
await build({
  ...common,
  outfile: 'dist/hub.mjs',
  format: 'esm',
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
});
await build({ ...common, outfile: 'dist/hub.cjs', format: 'cjs' });
