import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';

const exec = promisify(execFile), template = resolve('templates/project-runtime');
async function availablePort() {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}
async function project() {
  await mkdir('eval/out/runtime-tests', { recursive: true });
  const root = await mkdtemp(resolve('eval/out/runtime-tests/project-'));
  await cp(template, root, { recursive: true, filter: source => !source.includes('node_modules') && !source.includes('.agent-runtime') });
  const port = await availablePort(), env = { ...process.env, RUNTIME_PORT_BASE: String(port), RUNTIME_ENV: 'test' };
  async function run(script, args = [], environment = {}) {
    try {
      const { stdout } = await exec(process.execPath, [join(root, 'scripts/dev', script), ...args, '--root', root], { env: { ...env, ...environment }, timeout: 45000 });
      return { code: 0, data: JSON.parse(stdout) };
    } catch (e) {
      if (!e.stdout) throw e;
      return { code: e.code, data: JSON.parse(e.stdout) };
    }
  }
  return { root, port, env, run, async close() { await run('ensure-ready', ['--stop']); } };
}

test('runtime reuses a verified service, reads actual login identity, and detects then clears the interstitial', { timeout: 60000 }, async () => {
  const p = await project();
  try {
    const first = await p.run('ensure-ready');
    assert.equal(first.code, 0); assert.equal(first.data.services[0].reused, false);
    const start = performance.now(), second = await p.run('ensure-ready'), elapsed = performance.now() - start;
    assert.equal(second.code, 0); assert.ok(elapsed < 5000, `Second readiness took ${elapsed}ms`);
    assert.equal(second.data.services[0].reused, true);
    assert.equal(second.data.services[0].pid, first.data.services[0].pid);
    const login = await fetch(`http://127.0.0.1:${p.port}/api/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'fixture@example.test', password: 'local-fixture-only' }) }).then(r => r.json());
    assert.deepEqual(second.data.accounts[0].verified_identity, login);
    assert.notEqual(login.workspace, second.data.accounts[0].role);
    assert.ok(!JSON.stringify(second.data).includes('local-fixture-only'));
    const flag = join(p.root, '.agent-runtime/interstitial');
    await writeFile(flag, '');
    const defective = await p.run('verify-flow', ['login-no-interstitial']);
    assert.equal(defective.code, 1); assert.equal(defective.data.passed, false);
    assert.equal(new URL(defective.data.url_at_failure).pathname, '/confirm');
    assert.equal(defective.data.failed_step, 4);
    await rm(flag);
    const fixed = await p.run('verify-flow', ['login-no-interstitial']);
    assert.equal(fixed.code, 0); assert.equal(fixed.data.passed, true);
    for (const result of [defective.data, fixed.data]) {
      assert.equal(result.artifacts.length, 2);
      for (const artifact of result.artifacts) assert.ok((await stat(artifact)).size > 0);
      assert.deepEqual(JSON.parse(await readFile(result.result_path)), result);
    }
    await writeFile(join(p.root, '.agent-runtime/test-evidence.json'), JSON.stringify({ second_ready_ms: elapsed, pid: second.data.services[0].pid, identity: login, defective: defective.data.result_path, fixed: fixed.data.result_path }, null, 2));
  } finally { await p.close(); }
});

test('a different worktree cannot reuse or stop this service; bad login remains unmet', { timeout: 60000 }, async () => {
  const p = await project(), other = await project();
  try {
    const first = await p.run('ensure-ready'); assert.equal(first.code, 0);
    const collision = await other.run('ensure-ready', [], { RUNTIME_PORT_BASE: String(p.port) });
    assert.equal(collision.code, 2); assert.match(collision.data.unmet.join(' '), /another runtime/);
    const stop = await other.run('ensure-ready', ['--stop'], { RUNTIME_PORT_BASE: String(p.port) });
    assert.equal(stop.code, 2);
    assert.equal((await p.run('ensure-ready')).data.services[0].pid, first.data.services[0].pid);
    const rejected = await p.run('ensure-ready', [], { RUNTIME_TEST_PASSWORD: 'incorrect' });
    assert.equal(rejected.code, 2); assert.equal(rejected.data.accounts.length, 0);
    assert.match(rejected.data.unmet.join(' '), /Cannot verify login/);
    assert.ok(!JSON.stringify(rejected).includes('incorrect'));
    const configFile = join(p.root, 'runtime.config.mjs');
    const config = await readFile(configFile, 'utf8');
    try {
      await writeFile(configFile, config.replace('/healthz', '/missing-health'));
      const missingHealth = await p.run('ensure-ready');
      assert.equal(missingHealth.code, 2);
      assert.match(missingHealth.data.unmet.join(' '), /saved process is alive/);
      const unverifiedStop = await p.run('ensure-ready', ['--stop']);
      assert.equal(unverifiedStop.code, 2);
      assert.equal(JSON.parse(await readFile(join(p.root, '.agent-runtime/processes.json'))).web.pid, first.data.services[0].pid);
    } finally { await writeFile(configFile, config); }
    assert.equal((await p.run('ensure-ready')).data.services[0].pid, first.data.services[0].pid);
  } finally { await p.close(); await other.close(); }
});
