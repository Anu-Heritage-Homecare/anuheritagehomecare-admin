// Performance budget for the built bundle. Fails the build if the initial entry
// chunk or the total shipped JavaScript grows past the budget (gzipped).
// Run after `npm run build`.
import { readFileSync, readdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

const DIST = 'dist';
const ENTRY_GZIP_BUDGET = 180 * 1024; // the chunk loaded on first paint
const TOTAL_JS_GZIP_BUDGET = 800 * 1024; // every route chunk combined

const kb = (n) => `${(n / 1024).toFixed(1)}KB`;

const html = readFileSync(join(DIST, 'index.html'), 'utf8');
const match = html.match(/src="(\/assets\/[^"]*index-[^"]+\.js)"/);
if (match === null) {
  console.error('Could not find the entry script in dist/index.html');
  process.exit(2);
}

const entryPath = join(DIST, match[1].replace(/^\//, ''));
const entryGzip = gzipSync(readFileSync(entryPath)).length;

let totalJsGzip = 0;
for (const file of readdirSync(join(DIST, 'assets'))) {
  if (file.endsWith('.js')) {
    totalJsGzip += gzipSync(readFileSync(join(DIST, 'assets', file))).length;
  }
}

console.log(`entry chunk gzip: ${kb(entryGzip)}  (budget ${kb(ENTRY_GZIP_BUDGET)})`);
console.log(`total JS gzip:    ${kb(totalJsGzip)}  (budget ${kb(TOTAL_JS_GZIP_BUDGET)})`);

const failures = [];
if (entryGzip > ENTRY_GZIP_BUDGET) failures.push(`entry chunk ${kb(entryGzip)} exceeds ${kb(ENTRY_GZIP_BUDGET)}`);
if (totalJsGzip > TOTAL_JS_GZIP_BUDGET)
  failures.push(`total JS ${kb(totalJsGzip)} exceeds ${kb(TOTAL_JS_GZIP_BUDGET)}`);

if (failures.length > 0) {
  console.error('Performance budget FAILED:');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('Performance budget passed.');
