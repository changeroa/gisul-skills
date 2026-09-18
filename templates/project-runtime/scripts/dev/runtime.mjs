import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { access, mkdir, open, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const json = async path => JSON.parse(await readFile(path, 'utf8'));
async function optionalJSON(path) { try { return await json(path); } catch (e) { if (e.code === 'ENOENT') return {}; throw e; } }
export async function writeJSON(path, value) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
  await rename(temporary, path);
}

export async function loadProject(root) {
  root = resolve(root);
  const { default: config } = await import(pathToFileURL(join(root, 'runtime.config.mjs')));
  if (!config?.project || !['dev', 'test'].includes(config.env) || !Array.isArray(config.services) || !config.services.length) throw new Error('Select a dev/test project with services in runtime.config.mjs');
  const names = new Set();
  for (const service of config.services) {
    if (!/^[a-z][a-z0-9-]*$/.test(service.name) || names.has(service.name) || !Array.isArray(service.command) || !service.command.length || service.command.some(arg => typeof arg !== 'string')) throw new Error('Each service needs a unique name and an argv command');
    names.add(service.name);
    for (const value of [service.url, service.healthUrl]) {
      const url = new URL(value);
      if (url.protocol !== 'http:' || !['127.0.0.1', '[::1]', 'localhost'].includes(url.hostname)) throw new Error('Development services must use loopback HTTP URLs');
    }
  }
  return { root, config, directory: join(root, '.agent-runtime') };
}

async function command(argv, root, log) {
  if (!Array.isArray(argv) || !argv.length || argv.some(arg => typeof arg !== 'string')) throw new Error('Commands must be argv arrays');
  const file = await open(log, 'a', 0o600);
  try {
    await new Promise((resolveCommand, reject) => {
      const child = spawn(argv[0], argv.slice(1), { cwd: root, stdio: ['ignore', file.fd, file.fd] });
      child.once('error', reject);
      child.once('exit', code => code === 0 ? resolveCommand() : reject(new Error(`Preparation exited ${code}; inspect the local log`)));
    });
  } finally { await file.close(); }
}

async function probe(service, project) {
  try {
    const response = await fetch(service.healthUrl, { signal: AbortSignal.timeout(1000), redirect: 'error' });
    let data;
    try { data = await response.json(); } catch { return { healthy: false, reachable: true, conflict: true }; }
    const ours = data.project === project.config.project && data.env === project.config.env && data.runtime_root === project.root && data.service === service.name && typeof data.instance === 'string';
    return { healthy: response.ok && ours, reachable: true, conflict: !ours, instance: data.instance };
  } catch { return { healthy: false, reachable: false, conflict: false }; }
}

async function stopService(service, receipt, project) {
  const health = await probe(service, project);
  if (health.conflict) throw new Error(`${service.name}: this port belongs to another runtime`);
  if (!health.reachable) {
    if (receipt?.pid) {
      try { process.kill(receipt.pid, 0); }
      catch (e) { if (e.code === 'ESRCH') return; throw e; }
      throw new Error(`${service.name}: saved process is alive but ownership cannot be verified through health`);
    }
    return;
  }
  if (!receipt?.pid || receipt.instance !== health.instance) throw new Error(`${service.name}: cannot stop a service without its matching ownership receipt`);
  process.kill(-receipt.pid, 'SIGTERM');
  for (let attempt = 0; attempt < 50; attempt++) {
    if (!(await probe(service, project)).healthy) return;
    await delay(50);
  }
  throw new Error(`${service.name}: shutdown timed out`);
}

async function startService(service, project, log, receipts) {
  if (receipts[service.name]?.pid) {
    try {
      process.kill(receipts[service.name].pid, 0);
      throw new Error(`${service.name}: saved process is alive but not ready; inspect its log before starting another instance`);
    } catch (e) { if (e.code !== 'ESRCH') throw e; }
  }
  const instance = randomUUID(), file = await open(log, 'a', 0o600);
  let child;
  try {
    child = spawn(service.command[0], service.command.slice(1), {
      cwd: project.root, detached: true, stdio: ['ignore', file.fd, file.fd],
      env: { ...process.env, ...service.env, RUNTIME_PROJECT: project.config.project, RUNTIME_ENV: project.config.env, RUNTIME_ROOT: project.root, RUNTIME_SERVICE: service.name, RUNTIME_INSTANCE: instance },
    });
    await new Promise((started, reject) => { child.once('spawn', started); child.once('error', reject); });
    child.unref();
  } finally { await file.close(); }
  receipts[service.name] = { pid: child.pid, instance };
  await writeJSON(join(project.directory, 'processes.json'), receipts);
  const deadline = Date.now() + (service.timeoutMs ?? 15000);
  while (Date.now() < deadline) {
    const health = await probe(service, project);
    if (health.healthy && health.instance === instance) return;
    if (health.conflict) break;
    await delay(100);
  }
  try { process.kill(-child.pid, 'SIGTERM'); } catch (e) { if (e.code !== 'ESRCH') throw e; }
  delete receipts[service.name];
  await writeJSON(join(project.directory, 'processes.json'), receipts);
  throw new Error(`${service.name}: readiness failed; inspect ${log}`);
}

export async function ensureReady(root, { restart = false, stop = false } = {}) {
  const project = await loadProject(root), { config, directory } = project;
  await mkdir(join(directory, 'logs'), { recursive: true, mode: 0o700 });
  const lock = join(directory, 'ensure.lock');
  try { await mkdir(lock, { mode: 0o700 }); }
  catch (e) { if (e.code === 'EEXIST') throw new Error('Another readiness command holds .agent-runtime/ensure.lock'); throw e; }
  await writeJSON(join(lock, 'owner.json'), { pid: process.pid, started_at: new Date().toISOString() });
  const ready = { project: config.project, env: config.env, checked_at: new Date().toISOString(), services: [], accounts: [], contracts: config.contracts ?? {}, unmet: [] };
  try {
    const receipts = await optionalJSON(join(directory, 'processes.json'));
    if (stop) {
      for (const service of config.services) await stopService(service, receipts[service.name], project);
      await writeJSON(join(directory, 'processes.json'), {});
      await rm(join(directory, 'ready.json'), { force: true });
      return { stopped: true };
    }
    const preparation = await optionalJSON(join(directory, 'preparation.json'));
    if (config.dependencies) {
      const dependencies = config.dependencies;
      const digest = createHash('sha256').update(await readFile(join(project.root, dependencies.lockfile))).digest('hex');
      const present = await access(join(project.root, dependencies.checkPath)).then(() => true, () => false);
      if (!present || preparation.lockfile !== digest) {
        await command(dependencies.command, project.root, join(directory, 'logs/dependencies.log'));
        await access(join(project.root, dependencies.checkPath));
        await writeJSON(join(directory, 'preparation.json'), { lockfile: digest });
      }
    }
    for (const [index, check] of (config.preflight ?? []).entries()) await command(check, project.root, join(directory, `logs/preflight-${index}.log`));
    for (const [name, path] of Object.entries(ready.contracts)) {
      try { await access(resolve(project.root, path)); }
      catch { ready.unmet.push(`Missing contract ${name}: ${path}`); }
    }
    for (const service of config.services) {
      const log = join(directory, 'logs', `${service.name}.log`);
      let health = await probe(service, project), reused = health.healthy;
      try {
        if (health.conflict) throw new Error(`${service.name}: port is occupied by another runtime`);
        if (restart && health.reachable) { await stopService(service, receipts[service.name], project); health = { healthy: false }; reused = false; }
        if (!health.healthy && health.reachable) throw new Error(`${service.name}: existing service is unhealthy; inspect its log before --restart`);
        if (!health.healthy) await startService(service, project, log, receipts);
        health = await probe(service, project);
        if (!health.healthy) throw new Error(`${service.name}: service lost readiness`);
      } catch (e) { ready.unmet.push(e.message); health.healthy = false; }
      ready.services.push({ name: service.name, url: service.url, pid: receipts[service.name]?.instance === health.instance ? receipts[service.name].pid : null, healthy: health.healthy, log, reused });
    }
    if (ready.services.every(service => service.healthy)) for (const account of config.accounts ?? []) {
      try {
        const identity = await account.login({ credentials: account.credentials(), services: ready.services });
        if (typeof identity?.user_id !== 'string' || !identity.user_id || typeof identity.workspace !== 'string' || !identity.workspace || (account.expectedWorkspace && identity.workspace !== account.expectedWorkspace)) throw new Error('Login identity mismatch');
        ready.accounts.push({ role: account.role, login_hint: account.login_hint, verified_identity: { user_id: identity.user_id, workspace: identity.workspace } });
      } catch { ready.unmet.push(`Cannot verify login identity for ${account.role}`); }
    }
  } catch (e) { ready.unmet.push(e.message); }
  finally {
    try { if (!stop) await writeJSON(join(directory, 'ready.json'), ready); }
    finally { await rm(lock, { recursive: true, force: true }); }
  }
  return ready;
}

export async function runReadyCommand(args) {
  const flags = new Set(args.filter(arg => arg.startsWith('--')));
  if ([...flags].some(flag => !['--root', '--restart', '--stop'].includes(flag)) || (flags.has('--stop') && flags.has('--restart'))) throw new Error('Usage: ensure-ready [--root PROJECT] [--restart|--stop]');
  const rootIndex = args.indexOf('--root');
  if (rootIndex >= 0 && (!args[rootIndex + 1] || args[rootIndex + 1].startsWith('--'))) throw new Error('--root requires a project directory');
  if (args.length !== flags.size + (rootIndex >= 0 ? 1 : 0)) throw new Error('Unexpected readiness arguments');
  const result = await ensureReady(rootIndex < 0 ? process.cwd() : args[rootIndex + 1], { restart: flags.has('--restart'), stop: flags.has('--stop') });
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.unmet?.length ? 2 : 0;
}
