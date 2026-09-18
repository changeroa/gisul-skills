import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { access } from 'node:fs/promises';
import { join } from 'node:path';

if (!['dev', 'test'].includes(process.env.RUNTIME_ENV)) throw new Error('This fixture only runs in dev/test');
const sessions = new Set();
const identity = { user_id: 'fixture-user-1', workspace: 'verified-fixture-workspace' };
const email = process.env.RUNTIME_TEST_EMAIL ?? 'fixture@example.test';
const password = process.env.RUNTIME_TEST_PASSWORD ?? 'local-fixture-only';
const page = body => `<!doctype html><html><head><meta charset="utf-8"><title>Runtime login fixture</title></head><body>${body}</body></html>`;
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://127.0.0.1');
    const json = (status, data) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(data)); };
    if (url.pathname === '/healthz') return json(200, { project: process.env.RUNTIME_PROJECT, env: process.env.RUNTIME_ENV, runtime_root: process.env.RUNTIME_ROOT, service: process.env.RUNTIME_SERVICE, instance: process.env.RUNTIME_INSTANCE });
    if (req.method === 'POST' && ['/login', '/api/login'].includes(url.pathname)) {
      let body = ''; for await (const chunk of req) { body += chunk; if (body.length > 4096) { req.destroy(); return; } }
      const data = req.headers['content-type']?.includes('application/json') ? JSON.parse(body) : Object.fromEntries(new URLSearchParams(body));
      if (data.email !== email || data.password !== password) return json(401, { error: 'Invalid fixture credentials' });
      const session = randomUUID(); sessions.add(session);
      res.setHeader('set-cookie', `session=${session}; HttpOnly; SameSite=Strict; Path=/`);
      if (url.pathname === '/api/login') return json(200, identity);
      const broken = await access(join(process.env.RUNTIME_ROOT, '.agent-runtime/interstitial')).then(() => true, () => false);
      res.writeHead(303, { location: broken ? '/confirm' : '/dashboard' }); return res.end();
    }
    res.setHeader('content-type', 'text/html; charset=utf-8');
    if (url.pathname === '/login') return res.end(page('<h1>Sign in</h1><form method="post" action="/login"><label>Email <input name="email" type="email"></label><label>Password <input name="password" type="password"></label><button type="submit">Sign in</button></form>'));
    const session = /(?:^|;\s*)session=([^;]+)/.exec(req.headers.cookie ?? '')?.[1];
    if (!sessions.has(session)) { res.writeHead(303, { location: '/login' }); return res.end(); }
    if (url.pathname === '/confirm') return res.end(page('<h1 data-testid="interstitial">Confirm your workspace</h1>'));
    if (url.pathname === '/dashboard') return res.end(page(`<h1>Dashboard</h1><p data-testid="workspace">${identity.workspace}</p>`));
    res.writeHead(404); res.end('Not found');
  } catch { res.writeHead(400); res.end('Invalid request'); }
});
server.listen(Number(process.env.RUNTIME_PORT_BASE), '127.0.0.1');
process.on('SIGTERM', () => { server.close(); server.closeAllConnections(); });
