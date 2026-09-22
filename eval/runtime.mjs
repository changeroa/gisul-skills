// Adapted from origin/feat/bounded-discovery-evals (35319c7e6fe1):eval/discovery/
// codex-session.mjs and environment.mjs; intentionally excludes its runner.
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { EventEmitter } from 'node:events';
import { chmod, lstat, mkdir, readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { isDeepStrictEqual } from 'node:util';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ENV_KEYS = ['PATH', 'HOME', 'USER', 'LOGNAME', 'SHELL', 'TMPDIR', 'LANG', 'LC_ALL', 'LC_CTYPE', 'TERM'];
const READER_TOOLS = ['search_skills', 'load_skill', 'read_skill_file'];
const PROFILE_NAMES = ['eval-baseline', 'eval-candidate'];
const within = (root, path) => path === root || path.startsWith(root + sep);
const loaderAt = cwd => join(cwd, '.agents', 'skills', 'gisul', 'SKILL.md');
const omitNulls = value => Array.isArray(value) ? value.map(omitNulls) : value && typeof value === 'object'
  ? Object.fromEntries(Object.entries(value).filter(([, item]) => item !== null).map(([key, item]) => [key, omitNulls(item)])) : value;
function differingPaths(actual, expected, path) {
  if (isDeepStrictEqual(actual, expected)) return [];
  if (!actual || !expected || typeof actual !== 'object' || typeof expected !== 'object') return [path];
  return [...new Set([...Object.keys(actual), ...Object.keys(expected)])].sort()
    .flatMap(key => differingPaths(actual[key], expected[key], path + '[' + JSON.stringify(key) + ']'));
}
const requiredString = (value, name) => {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} is required`);
  return value;
};
const absolute = (value, name) => {
  requiredString(value, name);
  if (!isAbsolute(value)) throw new Error(`${name} must be absolute`);
  return resolve(value);
};

// Values become argv entries, never shell command strings.
export function toml(value) {
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) return String(value);
  if (Array.isArray(value)) return '[' + value.map(toml).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.entries(value).map(([key, v]) => JSON.stringify(key) + '=' + toml(v)).join(',') + '}';
  throw new Error('Unsupported TOML override');
}

function childEnvironment(source, home) {
  const env = Object.fromEntries(ENV_KEYS.filter(key => source[key] !== undefined).map(key => [key, source[key]]));
  env.HOME = process.env.HOME ?? homedir();
  env.CODEX_HOME = home;
  return env;
}

async function canonical(path) {
  try { return await realpath(path); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    if (dirname(path) === path) throw error;
    return join(await canonical(dirname(path)), relative(dirname(path), path));
  }
}

function mcpDescriptors(servers) {
  if (!servers || Array.isArray(servers) || Object.keys(servers).sort().join(',') !== 'gisul,linear') {
    throw new Error('Exactly gisul and linear MCP descriptors are required');
  }
  const allowedKeys = new Set(['command', 'args', 'cwd', 'env', 'env_vars', 'url', 'http_headers', 'env_http_headers', 'bearer_token_env_var', 'startup_timeout_sec', 'tool_timeout_sec', 'enabled_tools']);
  return Object.fromEntries(Object.entries(servers).map(([name, descriptor]) => {
    if (!descriptor || Object.keys(descriptor).some(key => !allowedKeys.has(key))) throw new Error(`Unsupported ${name} MCP descriptor`);
    if (Boolean(descriptor.command) === Boolean(descriptor.url)) throw new Error(`${name} needs exactly one MCP transport`);
    if (name === 'linear' && (descriptor.command !== process.execPath || !isDeepStrictEqual(descriptor.args, [fileURLToPath(new URL('./mock-linear.mjs', import.meta.url))]))) throw new Error('linear must use this checkout\'s exact local mock stdio transport');
    if (descriptor.env_vars?.length || descriptor.env_http_headers || descriptor.bearer_token_env_var) {
      throw new Error('MCP credentials must be explicit; inherited credential variables are unavailable');
    }
    return [`mcp_servers.${name}`, {
      ...descriptor, enabled: true, startup_timeout_sec: descriptor.startup_timeout_sec ?? 30,
      tool_timeout_sec: descriptor.tool_timeout_sec ?? 30,
      ...(name === 'gisul' ? { enabled_tools: READER_TOOLS } : {}),
      // These calls mutate only the pinned in-memory fixture. The application
      // approval policy is independent of Codex's shell approval_policy=never.
      ...(name === 'linear' ? { tools: { save_issue: { approval_mode: 'approve' }, send_slack_message: { approval_mode: 'approve' } } } : {}),
    }];
  }));
}

export async function buildEnvironment({ home, workspace, agentsMarkdown, loaderMarkdown, model, effort, servers, deniedPaths = [], authSource = join(process.env.HOME ?? homedir(), '.codex', 'auth.json') }) {
  home = await canonical(absolute(home, 'home'));
  workspace = await canonical(absolute(workspace, 'workspace'));
  requiredString(model, 'model'); requiredString(effort, 'effort');
  if (typeof agentsMarkdown !== 'string') throw new Error('agentsMarkdown must be provided');
  requiredString(loaderMarkdown, 'loaderMarkdown');
  const actualHome = await canonical(process.env.HOME ?? homedir());
  const codexHome = join(actualHome, '.codex');
  if (within(home, workspace) || within(workspace, home) || within(codexHome, home) || home === actualHome) {
    throw new Error('Isolated home and workspace must be disjoint from each other and the real Codex home');
  }
  const loaderPath = loaderAt(workspace);
  const mandatory = [codexHome, join(actualHome, '.config'), join(actualHome, '.ssh'), join(actualHome, '.aws'),
    join(actualHome, '.azure'), join(actualHome, '.gnupg'), join(actualHome, '.kube'), join(actualHome, 'Library', 'Keychains'),
    join(actualHome, '.docker'), join(actualHome, '.password-store'), join(actualHome, '.local', 'share', 'keyrings'),
    join(actualHome, '.netrc'), join(actualHome, '.npmrc'), join(actualHome, '.git-credentials'), home];
  const paths = new Set();
  for (const path of [...mandatory, ...deniedPaths, ...(authSource ? [authSource] : [])]) {
    const normalized = absolute(path, 'denied path');
    paths.add(normalized); paths.add(await canonical(normalized));
  }
  for (const path of paths) {
    if (within(path, workspace) || within(path, loaderPath)) throw new Error('A denied path overlaps the workspace or its required loader: ' + path);
  }
  const descriptors = mcpDescriptors(servers);
  const templates = await Promise.all(PROFILE_NAMES.map(name => readFile(new URL(`./profiles/${name}.config.toml`, import.meta.url), 'utf8')));
  if (templates[0] !== templates[1]) throw new Error('Evaluation profiles must share the same isolation settings');
  // The small templates contain only flat TOML scalars. Keep returned overrides
  // identical to the generated files, without an independent configuration copy.
  const config = {};
  for (const line of templates[0].split('\n').filter(line => line.trim() && !line.trim().startsWith('#'))) {
    const match = /^(\S+) = (.+)$/.exec(line);
    if (!match) throw new Error('Unsupported evaluation profile template');
    config[match[1]] = JSON.parse(match[2]);
  }
  const env = childEnvironment(process.env, home);
  Object.assign(config, {
    model, model_reasoning_effort: effort,
    'permissions.eval': { extends: ':workspace', filesystem: Object.fromEntries([...paths].map(path => [path, 'deny'])), network: { enabled: false } },
    'shell_environment_policy.set': childEnvironment(env, home),
    ...descriptors,
  });
  // A reused home could contain hooks, project configuration, or native skills.
  await mkdir(home, { recursive: true, mode: 0o700 });
  if ((await readdir(home)).length) throw new Error('Isolated CODEX_HOME must be empty');
  await chmod(home, 0o700);
  await mkdir(workspace, { recursive: true });
  const existingSkills = await readdir(join(workspace, '.agents', 'skills')).catch(error => {
    if (error.code === 'ENOENT') return [];
    throw error;
  });
  if (existingSkills.length) throw new Error('Workspace already has a native skill catalog');
  // Copy only the explicitly selected auth file, never plugins, hooks or skills.
  if (authSource !== null) {
    let auth;
    try { auth = await readFile(absolute(authSource, 'authSource')); }
    catch { throw new Error('Codex authSource is unreadable; provide an auth.json file (no automatic keyring fallback)'); }
    await writeFile(join(home, 'auth.json'), auth, { mode: 0o600, flag: 'wx' });
  }
  const text = '# Generated isolated evaluation configuration.\n' + Object.entries(config).map(([key, value]) => `${key} = ${toml(value)}\n`).join('');
  for (const name of ['config.toml', ...PROFILE_NAMES.map(name => name + '.config.toml')]) {
    await writeFile(join(home, name), text, { mode: 0o600, flag: 'wx' });
  }
  await writeFile(join(home, 'AGENTS.md'), agentsMarkdown, { mode: 0o600, flag: 'wx' });
  await mkdir(dirname(loaderPath), { recursive: true });
  await writeFile(loaderPath, loaderMarkdown, { mode: 0o600, flag: 'wx' });
  return { config, env, loaderPath };
}

export async function assertSkillCatalog(api, workspace = api.cwd) {
  const listed = await api.rpc('skills/list', { cwds: [workspace], forceReload: true });
  if (!Array.isArray(listed.data) || listed.data.length !== 1 || listed.data.some(entry => entry.errors?.length || !Array.isArray(entry.skills))) {
    throw new Error('Skill discovery failed');
  }
  const enabled = listed.data.flatMap(entry => entry.skills.filter(skill => skill.enabled));
  if (enabled.length !== 1 || enabled[0].name !== 'gisul' || await canonical(enabled[0].path) !== await canonical(loaderAt(workspace))) {
    throw new Error('Enabled skill catalog must contain only the workspace gisul loader');
  }
  return listed;
}

export class CodexSession extends EventEmitter {
  constructor({ cwd, config, env, record = () => {} }) {
    super();
    this.cwd = absolute(cwd, 'cwd');
    if (!env?.CODEX_HOME || resolve(env.CODEX_HOME) === resolve(process.env.HOME ?? homedir(), '.codex')) throw new Error('An isolated CODEX_HOME is required');
    requiredString(config?.model, 'model'); requiredString(config?.model_reasoning_effort, 'effort');
    if (config['permissions.eval']?.extends !== ':workspace' || config['permissions.eval']?.network?.enabled !== false) throw new Error('Named eval permissions with network disabled are required');
    this.config = structuredClone(config);
    this.nextId = 0; this.pending = new Map(); this.events = []; this.record = record;
    this.stderr = ''; this.failure = null; this.closed = false; this.initialized = false;
    const args = ['app-server', '--stdio'];
    for (const [key, value] of Object.entries(config)) args.push('-c', key + '=' + toml(value));
    this.child = spawn('codex', args, { cwd: this.cwd, stdio: ['pipe', 'pipe', 'pipe'], env: childEnvironment(env, env.CODEX_HOME) });
    this.child.stderr.on('data', bytes => { this.stderr = (this.stderr + bytes.toString()).slice(-24000); });
    this.child.on('error', error => this.fail(error));
    this.child.stdin.on('error', error => this.fail(error));
    this.child.on('exit', (code, signal) => {
      this.closed = true;
      this.fail(new Error(`Codex app-server exited: ${code}/${signal}`));
      this.emit('closed', { code, signal });
    });
    this.lines = createInterface({ input: this.child.stdout });
    this.lines.on('line', line => {
      let message;
      try { message = JSON.parse(line); }
      catch { this.fail(new Error('Invalid JSON from Codex app-server')); return; }
      // Server request IDs and client request IDs occupy independent spaces.
      if (message.id !== undefined && message.method) {
        this.child.stdin.write(JSON.stringify({ id: message.id, error: { code: -32601, message: 'Interactive requests unavailable in isolated evaluation' } }) + '\n');
        this.observe({ method: 'evaluation/interactiveRequestRejected', params: { method: message.method } });
        this.fail(new Error('Interactive request rejected: ' + message.method));
      } else if (message.id !== undefined && this.pending.has(message.id)) {
        const pending = this.pending.get(message.id);
        clearTimeout(pending.timer); this.pending.delete(message.id);
        if (message.error) {
          const error = new Error('Codex RPC rejected: ' + pending.method + ' (code ' + message.error.code + ')');
          error.rpcCode = message.error.code;
          pending.reject(error); this.fail(error);
        } else pending.resolve(message.result);
      } else if (message.method) this.observe(message);
    });
  }
  observe(message) {
    const event = { observedAt: new Date().toISOString(), ...message };
    this.events.push(event);
    try {
      Promise.resolve(this.record(event)).catch(error => this.fail(error));
      this.emit('notification', event);
    } catch (error) { this.fail(error); }
  }
  fail(error) {
    if (this.failure) return;
    this.failure = error;
    this.rejectPending(error);
    this.emit('failed', error);
    if (!this.closed) this.child.kill('SIGTERM');
  }
  rejectPending(error) {
    for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(error); }
    this.pending.clear();
  }
  rpc(method, params = {}, timeoutMs = 60000) {
    if (this.failure || this.closed) return Promise.reject(this.failure ?? new Error('Session is closed'));
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return Promise.reject(new Error('RPC timeout must be positive'));
    return new Promise((resolve, reject) => {
      const id = ++this.nextId;
      const timer = setTimeout(() => this.fail(new Error(method + ' timeout')), timeoutMs);
      this.pending.set(id, { method, resolve, reject, timer });
      this.child.stdin.write(JSON.stringify({ id, method, params }) + '\n', error => { if (error) this.fail(error); });
    });
  }
  async initialize() {
    try {
      if (this.initialized) throw new Error('Session is already initialized');
      const result = await this.rpc('initialize', { clientInfo: { name: 'gisul-formal-eval-runner', version: '1' }, capabilities: { experimentalApi: true } });
      this.child.stdin.write(JSON.stringify({ method: 'initialized', params: {} }) + '\n');
      const { config } = await this.rpc('config/read', { cwd: this.cwd, includeLayers: false });
      for (const [key, expected] of Object.entries(this.config)) {
        const actual = key.split('.').reduce((value, part) => value?.[part], config);
        if (key.startsWith('mcp_servers.')) {
          for (const [field, value] of Object.entries(expected)) {
            if (!isDeepStrictEqual(omitNulls(actual?.[field]), omitNulls(value))) throw new Error('Effective MCP configuration differs: ' + key + '.' + field);
          }
        } else {
          const differences = differingPaths(omitNulls(actual), omitNulls(expected), key);
          if (differences.length) throw new Error('Effective configuration differs: ' + differences.join(', '));
        }
      }
      const expectedServers = Object.keys(this.config).filter(key => key.startsWith('mcp_servers.')).map(key => key.slice('mcp_servers.'.length)).sort();
      if (Object.keys(config.mcp_servers ?? {}).sort().join(',') !== expectedServers.join(',')) throw new Error('Unexpected configured MCP server');
      const listed = await this.rpc('skills/list', { cwds: [this.cwd], forceReload: true });
      if (!Array.isArray(listed.data) || listed.data.some(entry => entry.errors?.length || !Array.isArray(entry.skills))) throw new Error('Skill discovery failed');
      for (const skill of listed.data.flatMap(entry => entry.skills)) {
        if (skill.enabled && await canonical(skill.path) !== await canonical(loaderAt(this.cwd))) {
          await this.rpc('skills/config/write', { path: skill.path, enabled: false });
        }
      }
      await assertSkillCatalog(this);
      this.initialized = true;
      return result;
    } catch (error) { this.fail(error); throw error; }
  }
  async start(cwd = this.cwd, extras = {}) {
    try {
      if (!this.initialized || this.threadId) throw new Error('Initialize once before starting one thread');
      if (resolve(cwd) !== this.cwd) throw new Error('Thread workspace cannot change');
      const pins = { cwd: this.cwd, ephemeral: true, approvalPolicy: 'never', permissions: 'eval', model: this.config.model,
        modelProvider: 'openai', allowProviderModelFallback: false, config: { model_reasoning_effort: this.config.model_reasoning_effort },
        runtimeWorkspaceRoots: [this.cwd], environments: [], selectedCapabilityRoots: [] };
      const optional = new Set(['baseInstructions', 'developerInstructions', 'personality', 'serviceTier', 'threadSource']);
      for (const [key, value] of Object.entries(extras)) {
        if (!optional.has(key) && JSON.stringify(value) !== JSON.stringify(pins[key])) throw new Error('Cannot override isolated thread setting: ' + key);
      }
      await assertSkillCatalog(this);
      const result = await this.rpc('thread/start', { ...extras, ...pins });
      if (!result.thread?.id || result.model !== pins.model || result.reasoningEffort !== this.config.model_reasoning_effort ||
          result.modelProvider !== 'openai' || result.approvalPolicy !== 'never' || result.activePermissionProfile?.id !== 'eval' ||
          result.activePermissionProfile.extends !== ':workspace' || result.sandbox?.networkAccess !== false) {
        throw new Error('Thread startup did not preserve the pinned model, effort or permissions');
      }
      this.threadId = result.thread.id;
      return result;
    } catch (error) { this.fail(error); throw error; }
  }
  async turn(prompt, { timeoutMs = 240000, responsesapiClientMetadata, ...unsupported } = {}) {
    if (!this.threadId || this.turnInProgress || this.failure) throw this.failure ?? new Error('A single started thread is required');
    if (!this.boundaryVerified || !this.serversReady) throw new Error('Verify filesystem boundaries and MCP readiness before model turns');
    if (Object.keys(unsupported).length) throw new Error('Unsupported turn overrides: ' + Object.keys(unsupported).join(','));
    requiredString(prompt, 'prompt');
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error('Turn timeout must be positive');
    this.turnInProgress = true;
    const startIndex = this.events.length;
    let timer, onEvent, onFailure;
    const completed = [];
    const done = new Promise((resolve, reject) => {
      onEvent = event => {
        if (event.method !== 'turn/completed' || event.params?.threadId !== this.threadId) return;
        completed.push(event.params);
        if (event.params.turn?.id === this.activeTurnId) resolve(event.params);
      };
      onFailure = reject;
      this.on('notification', onEvent); this.once('failed', onFailure);
      timer = setTimeout(() => this.fail(new Error('Model turn exceeded ' + timeoutMs + ' ms')), timeoutMs);
    });
    done.catch(() => {});
    try {
      await assertSkillCatalog(this);
      const started = await this.rpc('turn/start', { threadId: this.threadId, input: [{ type: 'text', text: prompt }],
        model: this.config.model, effort: this.config.model_reasoning_effort, permissions: 'eval', approvalPolicy: 'never',
        ...(responsesapiClientMetadata === undefined ? {} : { responsesapiClientMetadata }) }, Math.min(timeoutMs, 60000));
      this.activeTurnId = started.turn?.id;
      if (!this.activeTurnId) throw new Error('turn/start omitted its turn id');
      const result = completed.find(item => item.turn?.id === this.activeTurnId) ?? await done;
      if (result.turn?.status !== 'completed' || result.turn.error) {
        const error = new Error('Model turn did not complete successfully: ' + result.turn?.status);
        if (result.turn?.status === 'failed' || result.turn?.error) {
          error.code = 'EVAL_PROVIDER_FAILURE';
          error.providerError = result.turn.error ?? { codexErrorInfo: 'unknown' };
        }
        throw error;
      }
      return { ...result, events: this.events.slice(startIndex) };
    } catch (error) { this.fail(error); throw error; }
    finally {
      clearTimeout(timer); this.off('notification', onEvent); this.off('failed', onFailure);
      this.activeTurnId = null; this.turnInProgress = false;
    }
  }
  async close() {
    if (this.closing) return this.closing;
    this.closing = (async () => {
      this.fail(new Error('Session closing'));
      this.child.stdin.end();
      if (this.closed || this.child.exitCode !== null || this.child.signalCode !== null || !this.child.pid) return;
      await new Promise(resolve => {
        const kill = setTimeout(() => this.child.kill('SIGKILL'), 1000);
        this.child.once('exit', () => { clearTimeout(kill); resolve(); });
      });
      this.lines.close();
    })();
    return this.closing;
  }
}

// Like the discovery runner's canary, this uses command/exec's named profile,
// without a model turn. File contents are never returned, even on a violation.
export async function verifyBoundary(api, { workspace, allowedPath, deniedPaths }) {
  workspace = await canonical(absolute(workspace, 'workspace')); allowedPath = await canonical(absolute(allowedPath, 'allowedPath'));
  if (!within(workspace, allowedPath) || !Array.isArray(deniedPaths) || !deniedPaths.length) throw new Error('Boundary verification requires a workspace file and denied probes');
  const probe = `const fs=require('node:fs');try{const p=process.argv[1];if(fs.statSync(p).isDirectory())fs.readdirSync(p);else{const f=fs.openSync(p,'r');fs.readSync(f,Buffer.alloc(1),0,1,0);fs.closeSync(f)}process.stdout.write('readable');}catch(e){process.stdout.write(e.code||'UNKNOWN');process.exitCode=1}`;
  const checks = [];
  try {
    for (const path of [allowedPath, ...deniedPaths]) {
      absolute(path, 'boundary path');
      await lstat(path); // Missing paths are not evidence of sandbox denial.
      const result = await api.rpc('command/exec', { command: [process.execPath, '-e', probe, path], cwd: workspace,
        permissionProfile: 'eval', timeoutMs: 10000, outputBytesCap: 128 }, 15000);
      const allowed = path === allowedPath;
      const passed = allowed ? result.exitCode === 0 && result.stdout === 'readable' : result.exitCode === 1 && /^(EPERM|EACCES)$/.test(result.stdout);
      checks.push({ path, allowed, passed, exitCode: result.exitCode });
      if (!passed) throw new Error('Isolation violation: filesystem boundary canary failed for ' + path);
    }
    api.boundaryVerified = true;
    return checks;
  } catch (error) { api.fail?.(error); throw error; }
}

export async function readyServers(api, allowed = ['gisul', 'linear'], timeoutMs = 45000) {
  if (!Array.isArray(allowed) || new Set(allowed).size !== allowed.length || allowed.some(name => !['gisul', 'linear'].includes(name))) throw new Error('Unsupported evaluation MCP allowlist');
  const deadline = Date.now() + timeoutMs;
  try {
    do {
      const page = await api.rpc('mcpServerStatus/list', { threadId: api.threadId, limit: 100 }, Math.max(1, Math.min(10000, deadline - Date.now())));
      if (page.nextCursor || !Array.isArray(page.data)) throw new Error('Unexpected MCP status pagination or shape');
      const names = page.data.map(server => server.name);
      if (new Set(names).size !== names.length || names.some(name => !allowed.includes(name))) throw new Error('Unexpected external MCP capability');
      if (page.data.some(server => ['failed', 'cancelled', 'authenticationRequired', 'disabled'].includes(server.runtimeStatus) || server.toolsError)) throw new Error('MCP startup failed');
      const connected = page.data.filter(server => server.runtimeStatus === 'connected');
      if (connected.length === allowed.length && allowed.every(name => connected.some(server => server.name === name))) {
        const gisul = connected.find(server => server.name === 'gisul');
        if (gisul && Object.keys(gisul.tools ?? {}).sort().join(',') !== [...READER_TOOLS].sort().join(',')) throw new Error('Gisul must expose exactly the three reader tools');
        const linear = connected.find(server => server.name === 'linear');
        if (linear && linear.serverInfo?.name !== 'linear-evaluation-fixture') throw new Error('Linear MCP is not the evaluation fixture');
        api.serversReady = true;
        return connected;
      }
      await new Promise(resolve => setTimeout(resolve, Math.min(200, Math.max(0, deadline - Date.now()))));
    } while (Date.now() < deadline);
    throw new Error('MCP startup incomplete');
  } catch (error) { api.fail?.(error); throw error; }
}
