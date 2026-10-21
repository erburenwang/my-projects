import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const base = new URL('../', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('engine-data/manifest.json', base), 'utf8'));
const pieces = [];
for (let i = 1; i <= manifest.parts; i++) {
  pieces.push(await readFile(new URL(`engine-data/rapfi.data.${String(i).padStart(3, '0')}`, base)));
}
const data = Buffer.concat(pieces);
if (data.length !== manifest.bytes || createHash('sha256').update(data).digest('hex') !== manifest.sha256) {
  throw new Error('Rapfi data integrity check failed');
}
await mkdir(new URL('public/rapfi/', base), { recursive: true });
await writeFile(new URL('public/rapfi/rapfi.data', base), data);
console.log('Rapfi engine data restored and SHA-256 verified.');
