const port = Number(process.env.RUNTIME_PORT_BASE ?? 43100);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid RUNTIME_PORT_BASE');
const url = `http://127.0.0.1:${port}`;
const credentials = () => ({ email: process.env.RUNTIME_TEST_EMAIL ?? 'fixture@example.test', password: process.env.RUNTIME_TEST_PASSWORD ?? 'local-fixture-only' });
export default {
  project: 'project-runtime-example',
  env: process.env.RUNTIME_ENV ?? 'dev',
  services: [{ name: 'web', url, healthUrl: `${url}/healthz`, command: [process.execPath, 'example/apps/api/server.mjs'], env: { RUNTIME_PORT_BASE: String(port) } }],
  flowBaseUrl: url,
  accounts: [{
    role: 'example-admin', login_hint: 'env:RUNTIME_TEST_EMAIL (local fixture defaults)', credentials,
    async login({ credentials }) {
      const response = await fetch(`${url}/api/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(credentials), signal: AbortSignal.timeout(2000), redirect: 'error' });
      if (!response.ok) throw new Error('Fixture login rejected');
      return response.json();
    },
  }],
  contracts: { image_ref: 'example/apps/api/image-ref.schema.json' },
};
