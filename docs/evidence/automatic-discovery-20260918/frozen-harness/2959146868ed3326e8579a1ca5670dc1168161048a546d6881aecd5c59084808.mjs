import assert from 'node:assert/strict';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, writeFile, readdir, lstat, rename } from 'node:fs/promises';
import { homedir } from 'node:os';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { CodexSession } from './codex-session.mjs';
import { inspectInstalled, isolatedConfig, writeLoader, sha256, readyServers, verifyReadBoundary } from './environment.mjs';
import { cases, variants, candidateLoader } from './scenarios.mjs';
import { validateProvenance, failureType, stopCondition } from './evidence.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../..');
const COMMON = 'Work within the current repository and the user\'s requested scope. Do not create sub-agents, install packages, publish, or write to external services. Use Korean unless the user requests another language. Existing task authorization covers ordinary local inspection and requested fixture edits.';
export const TOKEN_PRICES = { date: '2026-09-18', source: 'https://developers.openai.com/api/docs/models/gpt-6-astra', kind: 'standard_api_equivalent_not_account_bill', inputPerMillion: 10, cachedPerMillion: 1, cacheWritePerMillion: 12.5, outputPerMillion: 50 };

export function cost(usage, normalized = false) {
  if (!usage) return null;
  const cached = normalized ? 0 : usage.cachedInputTokens;
  const writes = normalized ? 0 : (usage.cacheWriteInputTokens ?? 0);
  return (Math.max(0, usage.inputTokens - cached - writes) * 10 + cached + writes * 12.5 + usage.outputTokens * 50) / 1e6;
}

async function json(path, value) {
  const temp = path + '.' + randomUUID() + '.tmp';
  await writeFile(temp, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
  await rename(temp, path);
}
async function logEvents(directory) {
  const result = [];
  for (const name of await readdir(directory)) {
    if (!name.endsWith('.jsonl')) continue;
    for (const line of (await readFile(join(directory, name), 'utf8')).split('\n').filter(Boolean)) {
      try { result.push(JSON.parse(line)); } catch { throw new Error('Incomplete gisul event log'); }
    }
  }
  return result;
}
async function snapshot(workspace, at = '') {
  const found = {};
  for (const item of await readdir(join(workspace, at), { withFileTypes: true })) {
    if (['.git', '.agents', '.codex', 'node_modules', 'AGENTS.md'].includes(item.name)) continue;
    const relative = at ? at + '/' + item.name : item.name;
    const path = join(workspace, relative);
    if (item.isDirectory()) Object.assign(found, await snapshot(workspace, relative));
    else if (item.isFile() && (await lstat(path)).size < 200000) found[relative] = await readFile(path, 'utf8');
  }
  return found;
}

export async function runTrial({ phaseRoot, installed, scenario, variant, repeat = 0, nativeSkills = [], expectedCommit, timeoutMs = 240000, id = randomUUID(), workspace, allWorkspaces = [] }) {
  const root = join(phaseRoot, 'runs', id);
  workspace ??= join(homedir(), 'tmp/gisul-discovery', id);
  const eventDir = join(root, 'gisul-events');
  const loader = candidateLoader(installed.loaderMarkdown, variant);
  const policy = variants[variant].policy;
  const identity = { id, caseId: scenario.id, family: scenario.family, contentFamily: scenario.contentFamily ?? scenario.family, variant, repeat, nativeSkills, model: installed.model, effort: installed.effort, loaderHash: sha256(loader), policyHash: sha256(policy), runtimeHash: installed.runtimeHash, scenarioHash: sha256(JSON.stringify(scenario)), expectedCommit, synthetic: true, workspace };
  const started = Date.now();
  const turns = [];
  let failure = null, capabilities, boundary, runtime, api, raw, gisulEvents = [], files = {}, provenance;
  try {
    await mkdir(workspace, { recursive: true });
    await mkdir(eventDir, { recursive: true });
    await json(join(root, 'identity.json'), identity);
    execFileSync('git', ['init', '-q', workspace]);
    for (const [path, content] of Object.entries(scenario.files)) {
      if (path.startsWith('/') || path.split('/').includes('..')) throw new Error('Unsafe fixture path');
      await mkdir(dirname(join(workspace, path)), { recursive: true });
      await writeFile(join(workspace, path), content);
    }
    const loaderPath = await writeLoader(workspace, loader);
    if (policy) await writeFile(join(workspace, 'AGENTS.md'), policy);
    const deniedPaths = [REPO, resolve(REPO, '../session-notes'),
      ...['sessions', 'archived_sessions', 'log', 'memories', 'history.jsonl', 'state_5.sqlite', 'state_5.sqlite-wal', 'auth.json'].map(path => join(homedir(), '.codex', path)),
      ...allWorkspaces.filter(path => path !== workspace),
      ...installed.skills.filter(skill => !nativeSkills.includes(skill.name)).map(skill => dirname(skill.path)),
    ];
    const config = isolatedConfig(installed, eventDir, { nativeSkills, deniedPaths });
    if (scenario.transport === 'offline') config['mcp_servers.gisul'] = {
      command: process.execPath, args: [join(HERE, 'offline-reader.mjs')], cwd: REPO,
      env: { EVAL_FAULT_LOG: join(eventDir, 'fault.jsonl') }, enabled: true,
    };
    raw = createWriteStream(join(root, 'events.jsonl'), { mode: 0o600 });
    api = new CodexSession({ cwd: workspace, config, record: event => raw.write(JSON.stringify(event) + '\n') });
    await api.initialize();
    const skills = await api.rpc('skills/list', { cwds: [workspace], forceReload: true });
    const enabled = skills.data.flatMap(entry => entry.skills.filter(skill => skill.enabled));
    assert.deepEqual(enabled.map(skill => skill.name).sort(), ['gisul', ...nativeSkills].sort(), 'Unexpected native skill in trial');
    assert.ok(skills.data.every(entry => entry.errors.length === 0), 'Skill discovery errors');
    runtime = await api.start(workspace, { developerInstructions: COMMON, allowProviderModelFallback: false });
    assert.equal(runtime.model, installed.model);
    assert.equal(runtime.reasoningEffort, installed.effort);
    boundary = await verifyReadBoundary(api, workspace, loaderPath, [join(root, 'identity.json'), join(HERE, 'scenarios.mjs')]);
    const connected = await readyServers(api);
    assert.deepEqual(connected.map(server => server.name).sort(), ['gisul'], 'Unexpected external capability');
    assert.deepEqual(Object.keys(connected[0].tools).sort(), ['load_skill', 'read_skill_file', 'search_skills'], 'Unexpected external capability: gisul tools differ');
    capabilities = { skills: enabled.map(({ name, path }) => ({ name, path })), servers: connected.map(server => ({ name: server.name, tools: Object.keys(server.tools).sort() })) };
    for (const prompt of scenario.prompts) {
      const turnStarted = Date.now();
      const done = await api.turn(prompt, { timeoutMs, responsesapiClientMetadata: { gisul_eval_run: id, synthetic: 'true' } });
      const items = done.events.filter(event => event.method === 'item/completed').map(event => event.params.item);
      turns.push({ id: done.turn.id, status: done.turn.status, error: done.turn.error, elapsedMs: Date.now() - turnStarted, items });
      if (done.turn.status !== 'completed') throw new Error('Turn did not complete: ' + done.turn.status);
    }
  } catch (error) { failure = { message: String(error), type: failureType(error) }; }
  finally {
    if (api) await api.close().catch(error => { failure ??= { message: String(error), type: 'infrastructure' }; });
    if (raw) await new Promise(resolve => raw.end(resolve));
    try {
      gisulEvents = await logEvents(eventDir);
      files = await snapshot(workspace);
      provenance = validateProvenance(turns, gisulEvents, expectedCommit, scenario.transport === 'offline');
    } catch (error) { failure ??= { message: String(error), type: 'infrastructure' }; }
  }
  const usageEvents = (api?.events ?? []).filter(event => event.method === 'thread/tokenUsage/updated');
  const usage = usageEvents.at(-1)?.params.tokenUsage.total ?? null;
  const firstUsage = usageEvents[0]?.params.tokenUsage.last ?? null;
  const result = {
    ...identity, startedAt: new Date(started).toISOString(), elapsedMs: Date.now() - started,
    status: failure ? 'failed' : 'completed', failure, threadId: api?.threadId,
    capabilities, boundary, provenance, usage, firstUsage, estimatedCost: cost(usage), normalizedCost: cost(usage, true),
    turns, gisulEvents, files,
  };
  if (!usage) result.missingUsage = true;
  try {
    await mkdir(root, { recursive: true });
    await json(join(root, 'result.json'), result);
    if (failure && api) await writeFile(join(root, 'stderr.txt'), api.stderr, { mode: 0o600 });
  } catch (error) { result.status = 'failed'; result.failure = { type: 'infrastructure', message: 'Result persistence failed: ' + error }; }
  return result;
}

async function pinInstalled(installed, phaseRoot) {
  const cwd = join(phaseRoot, 'preflight');
  await mkdir(cwd, { recursive: true });
  const api = new CodexSession({ cwd, config: isolatedConfig(installed, join(cwd, 'events')) });
  try {
    await api.initialize();
    await api.start(cwd);
    await readyServers(api);
    const result = await api.rpc('mcpServer/tool/call', { threadId: api.threadId, server: 'gisul', tool: 'search_skills', arguments: { limit: 50 } });
    assert.ok(!result.isError, 'Reader preflight failed');
    const data = JSON.parse(result.content.find(item => item.type === 'text').text);
    assert.match(data.commit, /^[a-f0-9]{40}$/);
    await json(join(phaseRoot, 'catalog.json'), data);
    return data.commit;
  } finally { await api.close(); }
}

async function main() {
  const options = Object.fromEntries(process.argv.slice(2).map(arg => { const [key, ...rest] = arg.replace(/^--/, '').split('='); return [key, rest.join('=') || 'true']; }));
  const phase = options.phase ?? 'pilot';
  const arms = (options.variants ?? 'baseline,description,selective').split(',');
  arms.forEach(arm => assert.ok(variants[arm], 'Unknown arm'));
  const selection = options.cases ? cases.filter(item => options.cases.split(',').includes(item.id)) : phase === 'pilot' ? cases.filter(item => item.pilot) : cases;
  const repeats = Number(options.repeats ?? 1);
  const maxTokens = Number(options.maxTokens ?? 1500000);
  const concurrency = Math.min(2, Number(options.concurrency ?? 2));
  const phaseRoot = resolve(options.out ?? join(REPO, 'eval/out/discovery', phase + '-' + new Date().toISOString().replace(/[:.]/g, '-')));
  await mkdir(phaseRoot, { recursive: true });
  const installed = await inspectInstalled(REPO);
  if (options.model) installed.model = options.model;
  if (options.effort) installed.effort = options.effort;
  const expectedCommit = await pinInstalled(installed, phaseRoot);
  const nativeSkills = (options.nativeSkills ?? '').split(',').filter(Boolean);
  for (const name of nativeSkills) assert.equal(installed.skills.filter(skill => skill.name === name).length, 1, 'Native skill must identify exactly one installation');
  const schedule = [];
  for (let repeat = 0; repeat < repeats; repeat++) for (let index = 0; index < selection.length; index++) {
    for (let n = 0; n < arms.length; n++) {
      const id = randomUUID();
      const workspace = join(homedir(), 'tmp/gisul-discovery', id);
      schedule.push({ scenario: selection[index], variant: arms[(n + index + repeat) % arms.length], repeat, id, workspace });
    }
  }
  const harnessFiles = {};
  await mkdir(join(phaseRoot, 'harness'), { recursive: true });
  for (const name of ['run.mjs', 'scenarios.mjs', 'codex-session.mjs', 'environment.mjs', 'offline-reader.mjs', 'evidence.mjs']) {
    const bytes = await readFile(join(HERE, name));
    harnessFiles[name] = sha256(bytes);
    await writeFile(join(phaseRoot, 'harness', name), bytes);
  }
  const protocol = { version: 'discovery-v2', phase, frozenAt: new Date().toISOString(), model: installed.model, effort: installed.effort, runtimeHash: installed.runtimeHash, expectedCommit, harnessFiles, scenariosHash: sha256(JSON.stringify(selection)), variantsHash: sha256(JSON.stringify(variants)), schedule: schedule.map(({ scenario, variant, repeat, id, workspace }) => ({ id, caseId: scenario.id, variant, repeat, workspace })), maxTokens, concurrency, tokenPrices: TOKEN_PRICES, nativeSkills };
  protocol.hash = sha256(JSON.stringify(protocol));
  await json(join(phaseRoot, 'protocol.json'), protocol);
  await json(join(phaseRoot, 'scenarios.private.json'), selection);
  const results = [];
  let cursor = 0, usedTokens = 0, infrastructureFailures = 0, stopReason = null;
  const ledger = protocol.schedule.map(slot => ({ ...slot, status: 'pending' }));
  let ledgerWrites = Promise.resolve();
  const saveLedger = () => {
    ledgerWrites = ledgerWrites.then(() => json(join(phaseRoot, 'phase.json'), { protocolHash: protocol.hash, scheduled: schedule.length, completed: results.length, usedTokens, infrastructureFailures, stopReason, runs: ledger }));
    return ledgerWrites;
  };
  const onSignal = signal => { stopReason = 'interrupted_' + signal; };
  const sigint = () => onSignal('SIGINT'), sigterm = () => onSignal('SIGTERM');
  process.on('SIGINT', sigint); process.on('SIGTERM', sigterm);
  await saveLedger();
  console.log(JSON.stringify({ event: 'phase_started', phaseRoot, runs: schedule.length, protocolHash: protocol.hash, model: installed.model, effort: installed.effort }));
  async function worker() {
    while (cursor < schedule.length && !stopReason) {
      const trial = schedule[cursor++];
      const slot = ledger.find(slot => slot.id === trial.id);
      slot.status = 'running';
      await saveLedger();
      console.log(JSON.stringify({ event: 'started', caseId: trial.scenario.id, variant: trial.variant, repeat: trial.repeat }));
      let result;
      try { result = await runTrial({ phaseRoot, installed, expectedCommit, ...trial, nativeSkills, allWorkspaces: schedule.map(slot => slot.workspace) }); }
      catch (error) { result = { id: trial.id, caseId: trial.scenario.id, variant: trial.variant, repeat: trial.repeat, status: 'failed', failure: { type: 'infrastructure', message: String(error) }, gisulEvents: [], missingUsage: true }; }
      results.push(result);
      slot.status = result.status;
      slot.failure = result.failure;
      usedTokens += result.usage?.totalTokens ?? 0;
      infrastructureFailures += Number(result.failure?.type === 'infrastructure');
      stopReason ??= stopCondition(results, maxTokens);
      await saveLedger();
      console.log(JSON.stringify({ event: 'finished', id: result.id, caseId: result.caseId, variant: result.variant, status: result.status, failure: result.failure, tokens: result.usage?.totalTokens, cost: result.estimatedCost, searches: result.gisulEvents.filter(item => item.event === 'search').length, loads: result.gisulEvents.filter(item => item.event === 'load_skill').map(item => item.uri), elapsedMs: result.elapsedMs }));
    }
  }
  const settled = await Promise.allSettled(Array.from({ length: concurrency }, () => worker().catch(error => { stopReason = 'worker_failure'; throw error; })));
  if (settled.some(result => result.status === 'rejected')) stopReason = 'worker_failure';
  for (const slot of ledger) if (slot.status === 'pending') slot.status = 'not_run';
  await saveLedger();
  process.off('SIGINT', sigint); process.off('SIGTERM', sigterm);
  console.log(JSON.stringify({ event: 'phase_finished', phaseRoot, completed: results.length, scheduled: schedule.length, usedTokens, stopReason }));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error); process.exitCode = 1; });
