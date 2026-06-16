import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const localeDir = path.join(root, 'src/locales');

function flatten(value, prefix = '', out = {}) {
  for (const [key, child] of Object.entries(value)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === 'object' && !Array.isArray(child)) {
      flatten(child, fullKey, out);
    } else {
      out[fullKey] = child;
    }
  }
  return out;
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'locales') return [];
      return walk(fullPath);
    }
    return [fullPath];
  });
}

function hasKey(tree, key) {
  let current = tree;
  for (const part of key.split('.')) {
    if (!current || !Object.prototype.hasOwnProperty.call(current, part)) return false;
    current = current[part];
  }
  return true;
}

const localeFiles = fs.readdirSync(localeDir).filter((file) => file.endsWith('.json')).sort();
const locales = Object.fromEntries(localeFiles.map((file) => {
  const raw = fs.readFileSync(path.join(localeDir, file), 'utf8');
  return [file, JSON.parse(raw)];
}));

const englishKeys = new Set(Object.keys(flatten(locales['en.json'])));
const localeErrors = [];

for (const [file, tree] of Object.entries(locales)) {
  const keys = new Set(Object.keys(flatten(tree)));
  const missing = [...englishKeys].filter((key) => !keys.has(key));
  const extra = [...keys].filter((key) => !englishKeys.has(key));
  if (missing.length || extra.length) {
    localeErrors.push(`${file}: missing ${missing.length}, extra ${extra.length}`);
    for (const key of missing.slice(0, 20)) localeErrors.push(`  missing ${key}`);
    for (const key of extra.slice(0, 20)) localeErrors.push(`  extra ${key}`);
  }
}

const sourceFiles = walk(path.join(root, 'src')).filter((file) => /\.(jsx?|tsx?)$/.test(file));
const keyPattern = /\b(?:t|i18n\.t)\(\s*(['"])([^'"`]+)\1/g;
const staticKeys = new Set();

for (const file of sourceFiles) {
  const source = fs.readFileSync(file, 'utf8');
  let match;
  while ((match = keyPattern.exec(source))) staticKeys.add(match[2]);
}

const missingStaticKeys = [...staticKeys]
  .filter((key) => !hasKey(locales['en.json'], key) && !hasKey(locales['en.json'], `${key}_one`) && !hasKey(locales['en.json'], `${key}_other`))
  .sort();

if (missingStaticKeys.length) {
  localeErrors.push('Missing static translation keys in en.json:');
  for (const key of missingStaticKeys) localeErrors.push(`  ${key}`);
}

if (localeErrors.length) {
  console.error(localeErrors.join('\n'));
  process.exit(1);
}

console.log(`Locale audit passed for ${localeFiles.length} locale files and ${staticKeys.size} static keys.`);
