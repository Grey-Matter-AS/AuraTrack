// Performance budget: the JavaScript a phone must download before the first screen (the entry
// script and everything it preloads), gzipped. Fails CI when over budget (docs/plan/README.md §4.6).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const BUDGET_KB = 180;
const dist = fileURLToPath(new URL('../dist', import.meta.url));
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const files = new Set([...html.matchAll(/(?:src|href)="\/(assets\/[^"]+\.js)"/g)].map((m) => m[1]));
let total = 0;
for (const file of files) {
  const size = gzipSync(readFileSync(join(dist, file))).length;
  total += size;
  console.log(`${(size / 1024).toFixed(1).padStart(7)} KB  ${file}`);
}
const kb = total / 1024;
console.log(`${kb.toFixed(1).padStart(7)} KB  initial JavaScript, gzipped (budget ${BUDGET_KB} KB)`);
if (kb > BUDGET_KB) {
  console.error(`Over budget by ${(kb - BUDGET_KB).toFixed(1)} KB`);
  process.exit(1);
}
