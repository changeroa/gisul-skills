import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual, parseArgs } from 'node:util';
import { CodexSession, toml } from './runtime.mjs';

const sha = value => createHash('sha256').update(value).digest('hex');
const text = value => typeof value === 'string' && value.trim().length > 0;
const providers = { 'codex-cli': 'openai', 'claude-cli': 'anthropic' };
const ENV_KEYS = ['PATH', 'HOME', 'USER', 'LOGNAME', 'SHELL', 'TMPDIR', 'LANG', 'LC_ALL', 'LC_CTYPE', 'TERM'];
const fail = code => { throw Object.assign(new Error(code), { code }); };
const check = (condition, code) => { if (!condition) fail(code); };
function shape(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && keys.every(key => Object.hasOwn(value, key)) && Object.keys(value).every(key => keys.includes(key));
}
function publicURL(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.search;
  } catch { return false; }
}

export function selectJudge(policy) {
  check(shape(policy, ['schema', 'version', 'metric', 'scope', 'checkedAt', 'source', 'candidates'])
    && policy.schema === 1 && [policy.version, policy.metric, policy.scope].every(text)
    && typeof policy.checkedAt === 'string' && Number.isFinite(Date.parse(policy.checkedAt))
    && new Date(policy.checkedAt).toISOString() === policy.checkedAt && Date.parse(policy.checkedAt) <= Date.now()
    && shape(policy.source, ['url', 'version']) && publicURL(policy.source.url) && text(policy.source.version)
    && Array.isArray(policy.candidates) && policy.candidates.length > 0, 'FRONTIER_POLICY_INVALID');
  for (const candidate of policy.candidates) {
    check(shape(candidate, ['id', 'provider', 'transport', 'model', 'effort', 'score', 'fallback', 'evidenceUrl'])
      && [candidate.id, candidate.model, candidate.effort].every(text)
      && Object.hasOwn(providers, candidate.transport) && providers[candidate.transport] === candidate.provider
      && typeof candidate.score === 'number' && Number.isFinite(candidate.score)
      && candidate.fallback === false && publicURL(candidate.evidenceUrl), 'FRONTIER_POLICY_INVALID');
  }
  check(new Set(policy.candidates.map(candidate => candidate.id)).size === policy.candidates.length
    && new Set(policy.candidates.map(candidate => JSON.stringify([candidate.transport, candidate.model, candidate.effort]))).size === policy.candidates.length, 'FRONTIER_POLICY_INVALID');
  const highest = Math.max(...policy.candidates.map(candidate => candidate.score));
  const winners = policy.candidates.filter(candidate => candidate.score === highest);
  check(winners.length === 1, 'FRONTIER_TIED');
  const body = {
    schema: 1, kind: 'frontier-selection', policy: structuredClone(policy),
    policyHash: sha(JSON.stringify(policy)), selected: structuredClone(winners[0]),
  };
  return { ...body, hash: sha(JSON.stringify(body)) };
}

export function validateSelection(value) {
  check(shape(value, ['schema', 'kind', 'policy', 'policyHash', 'selected', 'hash']), 'FRONTIER_SELECTION_MISMATCH');
  const expected = selectJudge(value.policy);
  check(isDeepStrictEqual(value, expected), 'FRONTIER_SELECTION_MISMATCH');
  return value;
}

export async function readSelection(path) {
  let value;
  try { value = JSON.parse(await readFile(path, 'utf8')); }
  catch (error) { if (error.code) throw error; fail('FRONTIER_SELECTION_MISMATCH'); }
  return validateSelection(value);
}

async function readPolicy(source) {
  let bytes;
  if (/^https:\/\//.test(source)) {
    check(publicURL(source), 'FRONTIER_POLICY_INVALID');
    const response = await fetch(source, { signal: AbortSignal.timeout(60000), redirect: 'error' });
    check(response.ok && response.headers.get('content-type')?.includes('json'), 'FRONTIER_SOURCE_UNAVAILABLE');
    bytes = await response.text();
  } else bytes = await readFile(resolve(source), 'utf8');
  try { return JSON.parse(bytes); }
  catch { fail('FRONTIER_POLICY_INVALID'); }
}

async function runProcess(command, args, { cwd, env, input = '', timeoutMs = 240000, track }) {
  check(!track.closed, 'JUDGE_CANCELLED');
  const child = spawn(command, args, { cwd, env, detached: true, stdio: ['pipe', 'pipe', 'pipe'] });
  let stdout = '', stderr = '', processError = null, timedOut = false;
  child.stdout.on('data', bytes => { stdout += bytes; });
  child.stderr.on('data', bytes => { stderr += bytes; });
  child.on('error', error => { processError = error.code; });
  child.stdin.on('error', error => { processError = error.code; });
  const stop = () => { if (child.pid) { try { process.kill(-child.pid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') throw error; } } };
  const closed = new Promise(resolve => child.once('close', (code, signal) => resolve({ code, signal })));
  const active = { child, closed, group: true };
  track.active.add(active);
  if (child.pid) track.resources.processes.push({ pid: child.pid, group: true });
  const timer = setTimeout(() => { timedOut = true; stop(); }, timeoutMs);
  try {
    child.stdin.end(input);
    return { ...await closed, pid: child.pid, stdout, stderr, processError, timedOut };
  } finally { clearTimeout(timer); stop(); track.active.delete(active); }
}

function environment(source, transport) {
  const keys = [...ENV_KEYS, ...(transport === 'claude-cli'
    ? ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_BASE_URL', 'CLAUDE_CODE_OAUTH_TOKEN', 'CLAUDE_CONFIG_DIR'] : [])];
  return Object.fromEntries(keys.filter(key => source[key] !== undefined).map(key => [key, source[key]]));
}
const success = result => result.code === 0 && !result.signal && !result.processError && !result.timedOut;
const json = value => JSON.stringify(value, null, 2) + '\n';

export async function createJudge(selection, { root, env: sourceEnv = process.env, timeoutMs = 240000, signal } = {}) {
  validateSelection(selection);
  check(text(root) && Number.isFinite(timeoutMs) && timeoutMs > 0, 'JUDGE_CONFIGURATION_INVALID');
  root = await realpath(root);
  const selected = selection.selected, command = selected.transport === 'codex-cli' ? 'codex' : 'claude';
  const schemaBytes = await readFile(new URL('./judge.schema.json', import.meta.url));
  const schema = JSON.parse(schemaBytes);
  const inputs = await Promise.all(['./frontier-judge.mjs', './judge.schema.json', './runtime.mjs', './profiles/eval-baseline.config.toml']
    .map(async name => [name, sha(await readFile(new URL(name, import.meta.url)))]));
  const info = {
    sourceKind: 'model', id: selected.transport, version: selection.hash, model: selected.model, effort: selected.effort,
    selection: structuredClone(selection), adapterHash: sha(JSON.stringify(inputs)), reportedModel: null, cliVersion: null,
  };
  const temporary = await mkdtemp(join(tmpdir(), 'gisul-frontier-judge-'));
  const resources = { temporary, processes: [] };
  const track = { resources, active: new Set(), closed: false };
  const workspace = join(temporary, 'workspace'), home = join(temporary, 'home');
  const childEnv = environment(sourceEnv, selected.transport);
  let config;
  let closing;
  const close = () => closing ??= (async () => {
    track.closed = true;
    signal?.removeEventListener('abort', onAbort);
    const active = [...track.active];
    for (const { child, group } of active) {
      if (child.pid) {
        try { process.kill(group ? -child.pid : child.pid, 'SIGKILL'); }
        catch (error) { if (error.code !== 'ESRCH') throw error; }
      }
    }
    await Promise.all(active.map(child => child.closed));
    await rm(temporary, { recursive: true, force: true });
  })();
  // The owner also awaits close(), which surfaces teardown failures.
  const onAbort = () => { void close().catch(() => {}); };
  signal?.addEventListener('abort', onAbort, { once: true });
  try {
    check(!signal?.aborted, 'JUDGE_CANCELLED');
    await mkdir(workspace, { mode: 0o700 }); await mkdir(home, { mode: 0o700 });
    if (selected.transport === 'codex-cli') {
      const authRoot = sourceEnv.CODEX_HOME ?? join(sourceEnv.HOME ?? homedir(), '.codex');
      let auth;
      try { auth = await readFile(join(authRoot, 'auth.json')); }
      catch { fail('JUDGE_AUTH_MISSING'); }
      await writeFile(join(home, 'auth.json'), auth, { flag: 'wx', mode: 0o600 });
      await writeFile(join(home, 'AGENTS.md'), '', { flag: 'wx', mode: 0o600 });
      childEnv.CODEX_HOME = home;
      childEnv.HOME = home;
      config = {};
      const profile = await readFile(new URL('./profiles/eval-baseline.config.toml', import.meta.url), 'utf8');
      for (const line of profile.split('\n').filter(line => line.trim() && !line.trim().startsWith('#'))) {
        const match = /^(\S+) = (.+)$/.exec(line);
        check(match, 'JUDGE_CONFIGURATION_INVALID'); config[match[1]] = JSON.parse(match[2]);
      }
      Object.assign(config, {
        model: selected.model, model_reasoning_effort: selected.effort,
        default_permissions: 'judge', project_doc_max_bytes: 0,
        'permissions.eval': { extends: ':workspace', filesystem: Object.fromEntries([home, authRoot, sourceEnv.HOME].filter(Boolean).map(path => [path, 'deny'])), network: { enabled: false } },
        'permissions.judge': { extends: ':read-only', filesystem: { '/': 'deny' }, network: { enabled: false } },
        'features.shell_tool': false, 'features.unified_exec': false, 'features.view_image': false,
        'features.code_mode': false, 'features.skill_search': false,
        'features.daemon_auto_start': false, 'features.sleep_tool': false,
      });
    }
    const version = await runProcess(command, ['--version'], { cwd: workspace, env: childEnv, timeoutMs: 60000, track });
    check(success(version), 'JUDGE_TRANSPORT_UNAVAILABLE');
    info.cliVersion = version.stdout.trim();
    check(selected.transport === 'codex-cli' ? /^codex-cli \d+\.\d+\.\d+$/.test(info.cliVersion)
      : /^\d+\.\d+\.\d+ \(Claude Code\)$/.test(info.cliVersion), 'JUDGE_TRANSPORT_UNAVAILABLE');
    if (selected.transport === 'codex-cli') {
      check(!track.closed, 'JUDGE_CANCELLED');
      const api = new CodexSession({ cwd: workspace, env: childEnv, config });
      const active = { child: api.child, group: false, closed: new Promise(resolve => api.child.once('close', resolve)) };
      track.active.add(active);
      if (api.child.pid) resources.processes.push({ pid: api.child.pid, group: false });
      try {
        // Catalog RPCs do not start a model turn or require the runner's gisul skill.
        await api.rpc('initialize', { clientInfo: { name: 'gisul-frontier-judge', version: '1' }, capabilities: { experimentalApi: true } });
        api.child.stdin.write(JSON.stringify({ method: 'initialized', params: {} }) + '\n');
        const effective = (await api.rpc('config/read', { cwd: workspace, includeLayers: false })).config;
        check(effective?.default_permissions === 'judge' && effective.model === selected.model
          && effective.model_reasoning_effort === selected.effort && effective.project_doc_max_bytes === 0
          && effective.permissions?.judge?.extends === ':read-only' && effective.permissions.judge.filesystem?.['/'] === 'deny'
          && effective.permissions.judge.network?.enabled === false
          && Object.keys(effective.mcp_servers ?? {}).length === 0, 'JUDGE_ISOLATION_MISMATCH');
        let cursor, found; const seen = new Set();
        do {
          const page = await api.rpc('model/list', { limit: 100, includeHidden: false, ...(cursor ? { cursor } : {}) });
          check(Array.isArray(page.data), 'JUDGE_CATALOG_INVALID');
          found = page.data.find(model => model.model === selected.model);
          cursor = page.nextCursor;
          if (cursor) { check(!seen.has(cursor), 'JUDGE_CATALOG_INVALID'); seen.add(cursor); }
        } while (!found && cursor);
        check(found?.supportedReasoningEfforts?.some(value => value.reasoningEffort === selected.effort), 'JUDGE_MODEL_UNAVAILABLE');
      } finally { await api.close(); await active.closed; track.active.delete(active); }
      info.identityEvidence = 'requested_model_and_catalog';
    } else {
      const [major, minor, patch] = info.cliVersion.split(' ')[0].split('.').map(Number);
      if (!(major > 2 || (major === 2 && (minor > 1 || (minor === 1 && patch >= 259))))) {
        throw Object.assign(new Error(`Claude Code 2.1.259 or newer is required; found ${info.cliVersion}`), { code: 'JUDGE_CLI_UNSUPPORTED' });
      }
      const status = await runProcess(command, ['auth', 'status', '--json'], { cwd: workspace, env: childEnv, timeoutMs: 60000, track });
      let auth;
      try { auth = JSON.parse(status.stdout); } catch { fail('JUDGE_AUTH_MISSING'); }
      check(success(status) && auth.loggedIn === true, 'JUDGE_AUTH_MISSING');
      info.identityEvidence = 'requested_model_pending_provider_report';
    }
    check(!track.closed, 'JUDGE_CANCELLED');
  } catch (error) { await close(); error.resources = resources; throw error; }

  async function judge(request) {
    check(!track.closed, 'JUDGE_CANCELLED');
    check(text(request?.prompt), 'JUDGE_REQUEST_INVALID');
    const promptHash = sha(request.prompt), directory = join(root, 'judge-attempts', selection.hash, promptHash);
    await mkdir(join(root, 'judge-attempts', selection.hash), { recursive: true, mode: 0o700 });
    try { await mkdir(directory, { mode: 0o700 }); }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      let receipt, bytes;
      try {
        receipt = JSON.parse(await readFile(join(directory, 'receipt.json')));
        check(receipt.state === 'completed', 'JUDGE_ATTEMPT_AMBIGUOUS');
        bytes = await readFile(join(directory, 'response.json'));
      } catch (error) { if (error.code === 'JUDGE_ATTEMPT_AMBIGUOUS') throw error; fail('JUDGE_ATTEMPT_AMBIGUOUS'); }
      check(receipt.selectionHash === selection.hash && receipt.promptHash === promptHash
        && receipt.adapterHash === info.adapterHash && receipt.cliVersion === info.cliVersion
        && receipt.responseHash === sha(bytes), 'JUDGE_ATTEMPT_MISMATCH');
      if (receipt.reportedModel) {
        check(receipt.reportedModel === selected.model, 'JUDGE_MODEL_MISMATCH');
        info.reportedModel = receipt.reportedModel;
        if (selected.transport === 'claude-cli') info.identityEvidence = 'provider_reported_model';
      }
      check(!track.closed, 'JUDGE_CANCELLED');
      return JSON.parse(bytes);
    }
    const path = join(directory, 'receipt.json');
    const receipt = {
      schema: 1, state: 'started', startedAt: new Date().toISOString(), selectionHash: selection.hash,
      promptHash, adapterHash: info.adapterHash, cliVersion: info.cliVersion,
      transport: selected.transport, requestedModel: selected.model, effort: selected.effort,
      resources,
    };
    await writeFile(path, json(receipt), { flag: 'wx', mode: 0o600 });
    try {
      let result, response, reportedModel = null, usage = null;
      if (selected.transport === 'codex-cli') {
        const schemaPath = join(directory, 'schema.json'), output = join(directory, 'response.json');
        await writeFile(schemaPath, json(schema), { flag: 'wx', mode: 0o600 });
        const args = ['exec', '--ignore-user-config', '--ignore-rules', '--ephemeral', '--skip-git-repo-check',
          '--model', selected.model, '--output-schema', schemaPath, '--output-last-message', output, '--json'];
        for (const [key, value] of Object.entries(config)) {
          if (key !== 'permissions.eval') args.push('-c', key + '=' + toml(value));
        }
        args.push('-');
        result = await runProcess(command, args, { cwd: workspace, env: childEnv, input: request.prompt, timeoutMs, track });
        await writeFile(join(directory, 'events.jsonl'), result.stdout, { mode: 0o600 });
        await writeFile(join(directory, 'stderr.log'), result.stderr, { mode: 0o600 });
        check(!track.closed, 'JUDGE_CANCELLED'); check(success(result), 'JUDGE_EXECUTION_FAILED');
        for (const line of result.stdout.split('\n').filter(Boolean)) {
          const event = JSON.parse(line);
          check(event.item?.type !== 'error', 'JUDGE_EXECUTION_FAILED');
          check(!event.item || ['reasoning', 'agent_message'].includes(event.item.type), 'JUDGE_TOOL_USE');
          if (event.type === 'thread.started' && typeof event.model === 'string') reportedModel = event.model;
          if (event.type === 'turn.completed') usage = event.usage ?? null;
          check(event.type !== 'turn.failed' && event.type !== 'error', 'JUDGE_EXECUTION_FAILED');
        }
        response = JSON.parse(await readFile(output, 'utf8'));
      } else {
        const args = ['--safe-mode', '--restricted', '--tools', '', '--setting-sources', '', '--strict-mcp-config',
          '--mcp-config', '{"mcpServers":{}}', '--disable-slash-commands', '--no-chrome', '--permission-prompts', 'none',
          '--no-session-persistence', '--model', selected.model, '--effort', selected.effort,
          '--system-prompt', 'Return only the requested evidence-bound judgment JSON. Use no tools.',
          '--output-format', 'json', '--json-schema', JSON.stringify(schema), '--print'];
        result = await runProcess(command, args, { cwd: workspace, env: childEnv, input: request.prompt, timeoutMs, track });
        await writeFile(join(directory, 'events.json'), result.stdout, { mode: 0o600 });
        await writeFile(join(directory, 'stderr.log'), result.stderr, { mode: 0o600 });
        check(!track.closed, 'JUDGE_CANCELLED'); check(success(result), 'JUDGE_EXECUTION_FAILED');
        const envelope = JSON.parse(result.stdout);
        check(envelope.is_error === false && envelope.structured_output, 'JUDGE_OUTPUT_INVALID');
        const models = Object.keys(envelope.modelUsage ?? {});
        check(models.length === 1 && models[0] === selected.model, 'JUDGE_MODEL_MISMATCH');
        reportedModel = models[0]; usage = envelope.usage ?? null; response = envelope.structured_output;
        await writeFile(join(directory, 'response.json'), json(response), { flag: 'wx', mode: 0o600 });
        info.identityEvidence = 'provider_reported_model';
      }
      check(reportedModel === null || reportedModel === selected.model, 'JUDGE_MODEL_MISMATCH');
      if (reportedModel) info.reportedModel = reportedModel;
      const responseBytes = await readFile(join(directory, 'response.json'));
      check(!track.closed, 'JUDGE_CANCELLED');
      Object.assign(receipt, { state: 'completed', completedAt: new Date().toISOString(), reportedModel, usage, responseHash: sha(responseBytes), exitCode: result.code });
      await writeFile(path, json(receipt), { mode: 0o600 });
      return response;
    } catch (error) {
      Object.assign(receipt, { state: 'failed', completedAt: new Date().toISOString(), error: error.code ?? 'JUDGE_OUTPUT_INVALID' });
      await writeFile(path, json(receipt), { mode: 0o600 });
      if (!error.code) fail('JUDGE_OUTPUT_INVALID');
      throw error;
    }
  }
  return { judge, judgeInfo: info, close, resources };
}

const main = process.argv[1] && await realpath(process.argv[1]).catch(() => null);
if (main === await realpath(fileURLToPath(import.meta.url))) {
  try {
    const { values } = parseArgs({ options: { policy: { type: 'string' }, out: { type: 'string' } } });
    check(values.policy && values.out, 'FRONTIER_USAGE');
    const selection = selectJudge(await readPolicy(values.policy));
    await writeFile(resolve(values.out), json(selection), { flag: 'wx', mode: 0o600 });
    console.log(JSON.stringify({ written: true, path: resolve(values.out), selection }, null, 2));
  } catch (error) {
    console.error(JSON.stringify({ error: error.code ?? 'FRONTIER_FAILED' })); process.exitCode = 1;
  }
}
