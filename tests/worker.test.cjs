const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
async function loadWorker() {
  return import('data:text/javascript;base64,' + Buffer.from(fs.readFileSync('src/worker.js', 'utf8')).toString('base64'));
}
test('API fails closed until Access is configured', async () => {
  const { default: worker } = await loadWorker();
  const response = await worker.fetch(new Request('https://brcontrolsllc.com/studio/api/projects'), {});
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});
test('rejects invalid projects and duplicate IDs', async () => {
  const { validateDocument } = await loadWorker();
  const project = { id: 'p1', name: 'Project 1', elements: ['I/O List'] };
  assert.equal(validateDocument({ projects: [project], revision: 0 }).projects[0].name, 'Project 1');
  assert.throws(() => validateDocument({ projects: [project, project], revision: 0 }));
  assert.throws(() => validateDocument({ projects: [{ ...project, elements: ['Unknown'] }], revision: 0 }));
});
test('verified identities save, load, detect conflicts, and delete project metadata', async () => {
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(':memory:');
  db.exec(fs.readFileSync('migrations/0001_project_accounts.sql', 'utf8'));
  const DB = { prepare(sql) { return { bind(...args) { return {
    async first() { return db.prepare(sql).get(...args); },
    async run() { return { meta: { changes: Number(db.prepare(sql).run(...args).changes) } }; }
  }; } }; } };
  const pair = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  const publicKey = await crypto.subtle.exportKey('jwk', pair.publicKey); publicKey.kid = 'test-key';
  const originalFetch = global.fetch;
  global.fetch = async () => Response.json({ keys: [publicKey] });
  const issuer = 'https://test-team.cloudflareaccess.com';
  const env = { ACCESS_ISSUER: issuer, ACCESS_AUD: 'studio-audience', STUDIO_OWNER_EMAIL: 'owner@example.com', DB };
  const now = Math.floor(Date.now() / 1000);
  async function token(overrides = {}) {
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'test-key' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ iss: issuer, aud: ['studio-audience'], sub: 'owner-id', email: 'owner@example.com', exp: now + 600, iat: now, ...overrides })).toString('base64url');
    const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', pair.privateKey, Buffer.from(header + '.' + payload));
    return header + '.' + payload + '.' + Buffer.from(signature).toString('base64url');
  }
  try {
    const { default: worker } = await loadWorker();
    const jwt = await token();
    async function call(method, body, auth = jwt) {
      return worker.fetch(new Request('https://brcontrolsllc.com/studio/api/projects', {
        method, headers: { 'Cf-Access-Jwt-Assertion': auth, Origin: 'https://brcontrolsllc.com', 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined
      }), env);
    }
    assert.equal((await call('GET', null, await token({ aud: ['wrong'] }))).status, 401);
    assert.equal((await call('GET', null, await token({ exp: now - 1 }))).status, 401);
    assert.equal((await call('GET', null, await token({ email: 'other@example.com' }))).status, 403);
    assert.equal((await call('GET', null, jwt.slice(0, -10) + 'AAAAAAAAAA')).status, 401);
    assert.deepEqual(await (await call('GET')).json(), { projects: [], revision: 0 });
    const projects = [{ id: 'p1', name: 'Pump Station', elements: ['I/O List'] }];
    assert.equal((await call('PUT', { projects, revision: 0 })).status, 200);
    assert.deepEqual(await (await call('GET')).json(), { projects, revision: 1 });
    assert.equal((await call('PUT', { projects: [], revision: 0 })).status, 409);
    assert.equal((await call('PUT', { projects: [], revision: 1 })).status, 200);
    assert.deepEqual(await (await call('GET')).json(), { projects: [], revision: 2 });
    assert.deepEqual(await (await call('GET', null, await token({ sub: 'another-identity' }))).json(), { projects: [], revision: 0 });
    const crossOrigin = await worker.fetch(new Request('https://brcontrolsllc.com/studio/api/projects', { method: 'PUT', headers: { Origin: 'https://evil.example' } }), env);
    assert.equal(crossOrigin.status, 403);
  } finally { global.fetch = originalFetch; db.close(); }
});
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
  assert.equal(config.keep_vars, true);
  assert.equal(config.vars, undefined);
  assert.equal(config.assets.binding, 'ASSETS');
  assert.equal(config.d1_databases[0].binding, 'DB');
  assert.equal(config.d1_databases[0].database_id, '1b3bea3d-caa8-4946-a906-701fd8202ccf');
  assert.match(fs.readFileSync('.assetsignore', 'utf8'), /src\/\*\*/);
});
