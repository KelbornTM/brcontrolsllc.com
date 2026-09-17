const TYPES = ['Title Block', 'Cover Page', 'Symbol Library', 'Panel Layout', 'I/O List', 'BOM'];
const MAX_BODY = 256 * 1024;
let keyCache = null;
function reply(data, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}
function reject(status, message) { throw Object.assign(new Error(message), { status }); }
function decode(value) {
  const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}
export async function verifyIdentity(request, env) {
  const issuer = env.ACCESS_ISSUER;
  if (!issuer || !/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(issuer) || !env.ACCESS_AUD)
    reject(503, 'Account saving is not configured yet.');
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token || token.length > 16000) reject(401, 'Sign in to BRC Studio to access projects.');
  let parts, header, claims;
  try {
    parts = token.split('.');
    if (parts.length !== 3) throw new Error();
    header = JSON.parse(new TextDecoder().decode(decode(parts[0])));
    claims = JSON.parse(new TextDecoder().decode(decode(parts[1])));
  } catch { reject(401, 'Invalid sign-in token.'); }
  const now = Date.now() / 1000;
  if (header.alg !== 'RS256' || typeof header.kid !== 'string' || claims.iss !== issuer ||
      !Array.isArray(claims.aud) || !claims.aud.includes(env.ACCESS_AUD) ||
      typeof claims.exp !== 'number' || claims.exp <= now ||
      typeof claims.iat !== 'number' || claims.iat > now + 30 ||
      (claims.nbf !== undefined && (typeof claims.nbf !== 'number' || claims.nbf > now)) ||
      typeof claims.sub !== 'string' || !claims.sub || typeof claims.email !== 'string')
    reject(401, 'Your sign-in is invalid or expired.');
  let keys = keyCache?.issuer === issuer && keyCache.until > Date.now() ? keyCache.keys : null;
  if (!keys || !keys.some(key => key.kid === header.kid)) {
    const response = await fetch(issuer + '/cdn-cgi/access/certs', { signal: AbortSignal.timeout(10000) });
    if (!response.ok) reject(503, 'Unable to verify sign-in. Try again.');
    keys = (await response.json()).keys;
    if (!Array.isArray(keys)) reject(503, 'Unable to verify sign-in.');
    keyCache = { issuer, keys, until: Date.now() + 300000 };
  }
  const jwk = keys.find(key => key.kid === header.kid && key.kty === 'RSA');
  if (!jwk) reject(401, 'Invalid sign-in signature.');
  try {
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, decode(parts[2]), new TextEncoder().encode(parts[0] + '.' + parts[1]));
    if (!valid) throw new Error();
  } catch { reject(401, 'Invalid sign-in signature.'); }
  // Owner-only rollout: UI toggles never grant access or determine account ownership.
  if (!env.STUDIO_OWNER_EMAIL || claims.email.toLowerCase() !== env.STUDIO_OWNER_EMAIL.toLowerCase())
    reject(403, 'This account is not enabled for BRC Studio yet.');
  return issuer + '|' + claims.sub;
}
export function validateDocument(body) {
  if (!body || !Number.isSafeInteger(body.revision) || body.revision < 0 ||
      !Array.isArray(body.projects) || body.projects.length > 500) reject(400, 'Invalid project document.');
  const ids = new Set();
  const projects = body.projects.map(project => {
    if (!project || typeof project.id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(project.id) || ids.has(project.id) ||
        typeof project.name !== 'string' || !project.name.trim() || project.name.length > 200 ||
        !Array.isArray(project.elements) || project.elements.length > TYPES.length ||
        new Set(project.elements).size !== project.elements.length || project.elements.some(type => !TYPES.includes(type)))
      reject(400, 'Invalid project name or drawing element.');
    ids.add(project.id);
    const completed = project.completed;
    if (completed !== undefined && (!completed || typeof completed !== 'object' || Array.isArray(completed) ||
        Object.entries(completed).some(([type, done]) => !project.elements.includes(type) || typeof done !== 'boolean')))
      reject(400, 'Invalid drawing element completion.');
    return { id: project.id, name: project.name.trim(), elements: project.elements,
      ...(completed === undefined ? {} : { completed: Object.fromEntries(project.elements.map(type => [type, completed[type] === true])) }) };
  });
  return { revision: body.revision, projects };
}
async function readBody(request) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) reject(415, 'JSON required.');
  if (!request.body) reject(400, 'Missing project document.');
  const reader = request.body.getReader(); const chunks = []; let size = 0;
  while (true) {
    const { value, done } = await reader.read(); if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY) { await reader.cancel(); reject(413, 'Project document is too large.'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { reject(400, 'Invalid JSON.'); }
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/studio/api/')) return env.ASSETS.fetch(request);
    try {
      if (url.pathname !== '/studio/api/projects') return reply({ error: 'Not found.' }, 404);
      if (!['GET', 'PUT'].includes(request.method)) return reply({ error: 'Method not allowed.' }, 405);
      if (request.method === 'PUT' && request.headers.get('Origin') !== url.origin)
        return reply({ error: 'Same-origin request required.' }, 403);
      const owner = await verifyIdentity(request, env);
      if (!env.DB) reject(503, 'Project database is not connected.');
      if (request.method === 'GET') {
        const row = await env.DB.prepare('SELECT projects_json, revision FROM studio_project_accounts WHERE owner_id = ?').bind(owner).first();
        return reply(row ? { projects: JSON.parse(row.projects_json), revision: row.revision } : { projects: [], revision: 0 });
      }
      const document = validateDocument(await readBody(request));
      const result = await env.DB.prepare(`INSERT INTO studio_project_accounts (owner_id, projects_json, revision)
        SELECT ?, ?, 1 WHERE ? = 0
        ON CONFLICT(owner_id) DO UPDATE SET projects_json = ?, revision = revision + 1, updated_at = CURRENT_TIMESTAMP
        WHERE studio_project_accounts.revision = ?`).bind(owner, JSON.stringify(document.projects), document.revision,
          JSON.stringify(document.projects), document.revision).run();
      // For existing revision > 0, INSERT's SELECT is empty: use a guarded UPDATE instead.
      let changes = result.meta.changes;
      if (document.revision > 0) {
        const updated = await env.DB.prepare('UPDATE studio_project_accounts SET projects_json = ?, revision = revision + 1, updated_at = CURRENT_TIMESTAMP WHERE owner_id = ? AND revision = ?')
          .bind(JSON.stringify(document.projects), owner, document.revision).run();
        changes = updated.meta.changes;
      }
      if (!changes) return reply({ error: 'Projects changed in another tab or device. Reload before editing; your unsaved changes have not overwritten them.' }, 409);
      return reply({ revision: document.revision + 1 });
    } catch (error) {
      if (error.status) return reply({ error: error.message }, error.status);
      return reply({ error: 'Project storage is unavailable. Your changes have not been confirmed saved.' }, 503);
    }
  }
};
