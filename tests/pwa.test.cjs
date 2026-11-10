const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');

function workerHarness() {
  const scope = 'https://example.test/tools/hpwr/';
  const prefix = `livly-hpwr:${scope}:`;
  const current = `${prefix}v2`;
  const handlers = {};
  const deleted = [];
  const requested = [];
  const fetched = [];
  const precached = [];
  let claimed = false;
  let skipped = false;
  const cache = {
    addAll: async assets => precached.push(...assets),
    match: async url => { requested.push(url); return 'cached app asset'; },
  };
  const context = {
    URL,
    self: {
      registration: { scope },
      location: { origin: 'https://example.test' },
      clients: { claim: async () => { claimed = true; } },
      skipWaiting: () => { skipped = true; },
      addEventListener: (name, handler) => { handlers[name] = handler; },
    },
    caches: {
      open: async name => { assert.equal(name, current); return cache; },
      keys: async () => [current, `${prefix}old`, 'another-app-v1', 'livly-hpwr:https://example.test/other/:v1'],
      delete: async name => { deleted.push(name); },
    },
    fetch: async request => { fetched.push(request); return 'network response'; },
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'sw.js'), 'utf8'), context);
  async function lifecycle(name) {
    let pending;
    handlers[name]({ waitUntil: promise => { pending = promise; } });
    await pending;
  }
  async function get(url, method = 'GET') {
    let response;
    handlers.fetch({ request: { url, method }, respondWith: pending => { response = pending; } });
    return response === undefined ? undefined : await response;
  }
  return { scope, prefix, lifecycle, get, handlers, cache, deleted, requested, fetched, precached, get claimed() { return claimed; }, get skipped() { return skipped; } };
}

test('PWAの起動ファイルをすべてキャッシュし、公開ファイルが存在する', async () => {
  const worker = workerHarness();
  await worker.lifecycle('install');
  for (const file of worker.precached) assert.ok(fs.existsSync(path.resolve(root, file)), file);
  for (const file of ['./index.html', './app.js', './styles.css', './calculator.js']) assert.ok(worker.precached.includes(file));
  assert.equal(worker.skipped, false, '更新は入力中に自動適用しない');
});

test('キャッシュ更新はこのスコープの旧版だけを削除', async () => {
  const worker = workerHarness();
  await worker.lifecycle('activate');
  assert.deepEqual(worker.deleted, [`${worker.prefix}old`]);
  assert.equal(worker.claimed, true);
});

test('クエリ付きの起動URLを同じキャッシュからオフライン配信', async () => {
  const worker = workerHarness();
  assert.equal(await worker.get(`${worker.scope}index.html?from=home`), 'cached app asset');
  assert.deepEqual(worker.requested, [`${worker.scope}index.html`]);
  assert.equal(worker.fetched.length, 0);
});

test('キャッシュがなければネットワークにフォールバック', async () => {
  const worker = workerHarness();
  worker.cache.match = async () => undefined;
  assert.equal(await worker.get(`${worker.scope}app.js`), 'network response');
  assert.equal(worker.fetched.length, 1);
});

test('別アプリ・外部サイト・未知のパス・POSTを横取りしない', async () => {
  const worker = workerHarness();
  for (const url of ['https://example.test/other/', 'https://cdn.test/app.js', `${worker.scope}missing.html`]) {
    assert.equal(await worker.get(url), undefined);
  }
  assert.equal(await worker.get(`${worker.scope}app.js`, 'POST'), undefined);
  assert.equal(worker.requested.length, 0);
});

test('確認済みの更新メッセージだけが待機を解除', () => {
  const worker = workerHarness();
  worker.handlers.message({ data: { type: 'UNKNOWN' } });
  assert.equal(worker.skipped, false);
  worker.handlers.message({ data: { type: 'SKIP_WAITING' } });
  assert.equal(worker.skipped, true);
});

test('Manifestに192/512pxの実画像とApple用アイコンがある', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8'));
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.scope, './');
  assert.equal(manifest.start_url, './index.html');
  for (const size of [192, 512]) {
    const icon = manifest.icons.find(icon => icon.sizes === `${size}x${size}`);
    assert.ok(icon && icon.type === 'image/png' && icon.purpose.includes('any'));
    const png = fs.readFileSync(path.join(root, icon.src));
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    assert.equal(png.readUInt32BE(16), size);
    assert.equal(png.readUInt32BE(20), size);
  }
  const apple = fs.readFileSync(path.join(root, 'icons/apple-touch-icon.png'));
  assert.equal(apple.readUInt32BE(16), 180);
  assert.equal(apple.readUInt32BE(20), 180);
});
