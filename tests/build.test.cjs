const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { build } = require('../scripts/build.cjs');

function filesIn(directory, prefix = '') {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const name = prefix + entry.name;
    return entry.isDirectory() ? filesIn(path.join(directory, entry.name), `${name}/`) : [name];
  }).sort();
}

test('公開物にアプリの実行ファイルだけを含め、以前の余分なファイルも除去', () => {
  const directory = build();
  fs.writeFileSync(path.join(directory, 'local-only.txt'), 'This must not be published');
  build();
  assert.deepEqual(filesIn(directory), [
    '.nojekyll', 'app.js', 'calculator.js', 'icon.svg',
    'icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png',
    'index.html', 'manifest.webmanifest', 'styles.css', 'sw.js',
  ].sort());
});

test('Manifestの起動URL・スコープ・アイコンがPagesのサブパス内に解決される', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '../manifest.webmanifest'), 'utf8'));
  const base = 'https://example.github.io/livly-hpwr/';
  assert.equal(new URL(manifest.start_url, base).href, `${base}index.html`);
  assert.equal(new URL(manifest.scope, base).href, base);
  assert.equal(new URL(manifest.id, base).href, base);
  for (const icon of manifest.icons) assert.ok(new URL(icon.src, base).href.startsWith(base));
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    assert.ok(new URL(match[1], base).href.startsWith(base), match[1]);
  }
});
