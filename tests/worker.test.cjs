const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
test('Worker forwards requests to preserved static assets', async () => {
  const source = fs.readFileSync('src/worker.js', 'utf8');
  const { default: worker } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
  const request = new Request('https://brcontrolsllc.com/studio/index.html');
  const response = await worker.fetch(request, { ASSETS: { fetch: async received => {
    assert.equal(received, request);
    return new Response('Studio');
  } } });
  assert.equal(await response.text(), 'Studio');
});
test('Deployment preserves the database and excludes server source from assets', () => {
  const config = JSON.parse(fs.readFileSync('wrangler.jsonc', 'utf8'));
  assert.equal(config.main, 'src/worker.js');
  assert.equal(config.assets.binding, 'ASSETS');
  assert.equal(config.d1_databases[0].binding, 'DB');
  assert.equal(config.d1_databases[0].database_id, '1b3bea3d-caa8-4946-a906-701fd8202ccf');
  assert.match(fs.readFileSync('.assetsignore', 'utf8'), /src\/\*\*/);
});
