import assert from 'node:assert/strict';
import { createWriteStream } from 'node:fs';
import { readFile, writeFile, mkdir, readdir, rm, rename } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { dataset } from './dataset.mjs';
import { prepareCase } from './prepare.mjs';
import { scoreCase } from './score.mjs';
import { CodexSession, buildEnvironment, verifyBoundary, readyServers } from './runtime.mjs';

const HERE = dirname(fileURLToPath(import.meta.url)), REPO = resolve(HERE, '..');
export const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export const PRICES = { date: '2026-09-22', source: 'https://developers.openai.com/api/docs/models/gpt-6-astra', kind: 'standard_api_equivalent_not_account_bill', inputPerMillion: 10, cachedPerMillion: 1, cacheWritePerMillion: 12.5, outputPerMillion: 50 };
const COMMON = 'Use Korean. The file scenario.json contains available task context. The user has authorized the requested local fixture edits and the provided MCP tools. Work within this workspace. Do not install packages, create agents, publish, or access other services. Use the provided MCP tools for issue operations. Interactive approval tools are unavailable.';
export function estimateCost(usage, normalized = false) {
  if (!usage || !['inputTokens', 'outputTokens', 'cachedInputTokens'].every(key => Number.isFinite(usage[key]) && usage[key] >= 0)) return null;
  const cached = normalized ? 0 : usage.cachedInputTokens, writes = normalized ? 0 : (usage.cacheWriteInputTokens ?? 0);
  if (!Number.isFinite(writes) || writes < 0 || cached + writes > usage.inputTokens) return null;
  return ((usage.inputTokens - cached - writes) * 10 + cached + writes * 12.5 + usage.outputTokens * 50) / 1e6;
}
export async function saveJson(path, value) {
  const temp = path + '.' + randomUUID() + '.tmp';
  await writeFile(temp, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
  await rename(temp, path);
}
async function lines(path) {
  try { return (await readFile(path, 'utf8')).split('\n').filter(Boolean).map(line => JSON.parse(line)); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
}
async function files(root, prefix = '') {
  const found = {};
  for (const entry of await readdir(join(root, prefix), { withFileTypes: true })) {
    if (['.git', '.agents', '.codex', 'node_modules'].includes(entry.name)) continue;
    const relative = prefix ? prefix + '/' + entry.name : entry.name;
    if (entry.isDirectory()) Object.assign(found, await files(root, relative));
    else if (entry.isFile()) {
      const content = await readFile(join(root, relative));
      if (content.length > 200000) throw new Error('Oversized task artifact');
      found[relative] = content.toString('utf8');
    }
  }
  return found;
}
export function stopReason(results, maxTokens) {
  if (results.some(x => x.failure?.type === 'isolation')) return 'isolation_failure';
  if (results.filter(x => x.failure?.type === 'infrastructure').length >= 2) return 'two_infrastructure_failures';
  if (results.some(x => x.status === 'completed' && !x.usage)) return 'missing_usage';
  if (results.reduce((sum, x) => sum + (x.usage?.totalTokens ?? 0), 0) >= maxTokens) return 'observed_token_limit';
  return null;
}
export function classifyFailure(error, stage) {
  // A failed startup assertion is an unproven boundary, regardless of its
  // wording. Stop immediately instead of spending a second trial to rediscover it.
  if (stage === 'preflight' || /Isolation|boundary|Frozen source|pin mismatch|content drift/i.test(String(error))) return 'isolation';
  return /(?:Task|Model) turn|exceeded.*ms/.test(String(error)) ? 'execution' : 'infrastructure';
}
async function verifyFrozen(protocol) {
  for (const [path, expected] of Object.entries(protocol.fileHashes)) assert.equal(hash(await readFile(path)), expected, 'Frozen source changed: ' + path);
}

export async function runCase({ item, slot, protocol, root, preflight = false }) {
  const privateDir = join(root, 'runs', slot.id), home = join(privateDir, 'codex-home'), eventDir = join(privateDir, 'gisul-events');
  await mkdir(eventDir, { recursive: true });
  let api, log, prepared, boundary, capabilities, runtime, failure = null, stage = 'preflight';
  const startedAt = new Date().toISOString();
  const result = { id: slot.id, caseId: item.id, split: item.split, critical: item.critical, profile: slot.profile, synthetic: true, protocolHash: protocol.hash, model: protocol.model, effort: protocol.effort, startedAt, status: 'failed', items: [], mockEvents: [], gisulEvents: [], files: {}, finalText: '', usage: null };
  try {
    await verifyFrozen(protocol);
    prepared = await prepareCase({ item, workspace: slot.workspace, privateDir });
    const servers = {
      gisul: { command: process.execPath, args: [join(HERE, 'reader.mjs')], cwd: REPO, env: { EVAL_READER_CONFIG: join(root, 'reader.json'), GISUL_EVENT_LOG_DIR: eventDir, EVAL_GISUL_OFFLINE: prepared.offlineGisul ? '1' : '0' }, startup_timeout_sec: 30, tool_timeout_sec: 30 },
      linear: { command: process.execPath, args: [join(HERE, 'mock-linear.mjs')], cwd: REPO, env: { EVAL_LINEAR_FIXTURE: prepared.linearFixture, EVAL_WRITE_LOG: join(privateDir, 'mock.jsonl'), EVAL_TIMEOUT_ONCE: prepared.timeoutOnce ? '1' : '0' }, startup_timeout_sec: 30, tool_timeout_sec: 5 },
    };
    const env = await buildEnvironment({ home, workspace: slot.workspace, agentsMarkdown: protocol.instructions[slot.profile], loaderMarkdown: protocol.loaderMarkdown, model: protocol.model, effort: protocol.effort, servers, deniedPaths: [REPO, root, resolve(REPO, '../../../../session-notes'), join(homedir(), 'dev-tools'), ...protocol.schedule.filter(x => x.id !== slot.id).map(x => x.workspace)], authSource: join(homedir(), '.codex/auth.json') });
    log = createWriteStream(join(privateDir, 'events.jsonl'), { mode: 0o600 });
    api = new CodexSession({ cwd: slot.workspace, config: env.config, env: env.env, record: event => log.write(JSON.stringify(event) + '\n') });
    result.host = await api.initialize();
    const catalog = await api.rpc('skills/list', { cwds: [slot.workspace], forceReload: true });
    const enabled = catalog.data.flatMap(x => x.skills.filter(x => x.enabled));
    assert.deepEqual(enabled.map(x => x.name).sort(), ['gisul'], 'Isolation: unexpected native skills');
    assert.ok(catalog.data.every(x => !x.errors?.length), 'Isolation: skill discovery errors');
    runtime = await api.start(slot.workspace, { developerInstructions: COMMON });
    assert.equal(runtime.model, protocol.model, 'Model drift');
    assert.equal(runtime.reasoningEffort, protocol.effort, 'Effort drift');
    boundary = await verifyBoundary(api, { workspace: slot.workspace, allowedPath: env.loaderPath, deniedPaths: [join(root, 'protocol.json'), join(HERE, 'cases', item.id + '.yaml'), join(home, 'auth.json')] });
    const connected = await readyServers(api, ['gisul', 'linear']);
    capabilities = connected.map(x => ({ name: x.name, tools: Object.keys(x.tools).sort() }));
    if (!preflight) {
      stage = 'execution';
      const completed = await api.turn(prepared.prompt, { timeoutMs: protocol.timeoutMs, responsesapiClientMetadata: { gisul_eval_run: protocol.id, synthetic: 'true' } });
      result.turnId = completed.turn.id;
      if (completed.turn.status !== 'completed') throw new Error('Task turn ' + completed.turn.status);
    }
    result.status = 'completed';
  } catch (error) {
    failure = { type: classifyFailure(error, stage), message: String(error) };
  } finally {
    if (api) await api.close().catch(error => { failure ??= { type: 'infrastructure', message: String(error) }; });
    if (log) await new Promise(resolve => log.end(resolve));
    await rm(join(home, 'auth.json'), { force: true });
  }
  result.endedAt = new Date().toISOString();
  result.elapsedMs = Date.parse(result.endedAt) - Date.parse(startedAt);
  result.threadId = api?.threadId ?? null;
  result.turnId ??= (api?.events ?? []).find(x => x.method === 'turn/started')?.params.turn?.id ?? null;
  result.items = (api?.events ?? []).filter(x => x.method === 'item/completed').map(x => x.params.item);
  result.finalText = result.items.filter(x => x.type === 'agentMessage' && x.phase !== 'commentary').map(x => x.text ?? '').join('\n');
  result.usage = (api?.events ?? []).filter(x => x.method === 'thread/tokenUsage/updated').at(-1)?.params.tokenUsage.total ?? null;
  result.estimatedCost = estimateCost(result.usage);
  result.uncachedEstimatedCost = estimateCost(result.usage, true);
  result.boundary = boundary ?? null;
  result.capabilities = capabilities ?? null;
  result.limitations = prepared?.limitations ?? [];
  result.runtime = runtime ? { model: runtime.model, reasoningEffort: runtime.reasoningEffort } : null;
  try {
    result.mockEvents = await lines(join(privateDir, 'mock.jsonl'));
    for (const name of await readdir(eventDir)) if (name.endsWith('.jsonl')) result.gisulEvents.push(...await lines(join(eventDir, name)));
    result.files = await files(slot.workspace);
    if (result.gisulEvents.some(x => x.commit && x.commit !== protocol.reader.commit)) throw new Error('Observed content drift');
  } catch (error) { failure ??= { type: classifyFailure(error, 'evidence'), message: String(error) }; }
  result.failure = failure;
  if (failure) result.status = 'failed';
  result.grading = preflight ? null : scoreCase(item, result);
  await saveJson(join(privateDir, 'result.json'), result);
  return result;
}

async function main() {
  const { parseArgs } = await import('node:util');
  const { values } = parseArgs({ options: { out: { type: 'string' }, profile: { type: 'string', default: 'baseline' }, 'reader-config': { type: 'string' }, 'baseline-agents': { type: 'string', default: join(homedir(), '.codex/AGENTS.md') }, 'candidate-agents': { type: 'string', default: join(HERE, 'candidates/bootstrap/AGENTS.md') }, cases: { type: 'string' }, preflight: { type: 'boolean', default: false } } });
  if (!values.out || !values['reader-config'] || !['baseline', 'candidate'].includes(values.profile)) throw new Error('Usage: node eval/run.mjs --out ABSOLUTE --reader-config JSON --profile baseline|candidate [--preflight] [--cases N-01]');
  const root = resolve(values.out);
  await mkdir(root, { recursive: false }); // Existing evidence is never overwritten.
  const source = await dataset();
  const selection = values.preflight ? source.cases.filter(x => x.id === 'N-01') : values.cases ? source.cases.filter(x => values.cases.split(',').includes(x.id)) : source.cases;
  if (!selection.length || (values.cases && selection.length !== values.cases.split(',').length)) throw new Error('Unknown or duplicate case selection');
  const reader = JSON.parse(await readFile(resolve(values['reader-config']), 'utf8'));
  assert.equal(hash(await readFile(reader.bundle)), reader.bundleHash, 'Reader changed');
  await saveJson(join(root, 'reader.json'), reader);
  const id = 'agent-env-v1-' + values.profile + '-' + randomUUID();
  const workspaceRoot = join(homedir(), 'tmp/gisul-formal-eval', id);
  const schedule = selection.map(item => ({ id: randomUUID(), caseId: item.id, profile: values.profile, workspace: join(workspaceRoot, randomUUID()) }));
  const instructionPaths = { baseline: resolve(values['baseline-agents']), candidate: resolve(values['candidate-agents']) };
  const instructions = Object.fromEntries(await Promise.all(Object.entries(instructionPaths).map(async ([key, path]) => [key, await readFile(path, 'utf8')])));
  const fileHashes = {};
  const tracked = execFileSync('git', ['ls-files', 'eval', 'package-lock.json'], { cwd: REPO, encoding: 'utf8' }).trim().split('\n');
  for (const path of new Set([...tracked.map(x => join(REPO, x)), ...['run.mjs','reader.mjs','runtime.mjs','prepare.mjs','score.mjs','profiles/eval-baseline.config.toml','profiles/eval-candidate.config.toml'].map(x => join(HERE, x)), reader.bundle])) fileHashes[path] = hash(await readFile(path));
  const protocol = { schema: 1, id, createdAt: new Date().toISOString(), dataset: { name: source.name, version: source.version, totalCases: source.cases.length }, profile: values.profile, sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: REPO, encoding: 'utf8' }).trim(), codexVersion: execFileSync('codex', ['--version'], { encoding: 'utf8' }).trim(), model: 'gpt-6-astra', effort: 'max', maxTokens: 1500000, concurrency: 2, timeoutMs: 240000, instructions, instructionHashes: Object.fromEntries(Object.entries(instructions).map(([key,value]) => [key,hash(value)])), loaderMarkdown: await readFile(reader.loader, 'utf8'), reader, prices: PRICES, fileHashes, commonInstructions: COMMON, schedule, preflight: values.preflight, fullDataset: !values.cases && !values.preflight, synthetic: true, humanRatings: 0, semanticJudge: null, promotion: 'not_evaluated' };
  protocol.hash = hash(JSON.stringify(protocol));
  await saveJson(join(root, 'protocol.json'), protocol);
  await saveJson(join(root, 'cases.private.json'), selection);
  const results = [], ledger = schedule.map(x => ({ ...x, status: 'pending' }));
  let cursor = 0, stopped = null, writes = Promise.resolve();
  const update = () => { writes = writes.then(() => saveJson(join(root, 'phase.json'), { protocolHash: protocol.hash, stopped, runs: ledger, tokens: results.reduce((n, x) => n + (x.usage?.totalTokens ?? 0), 0) })); return writes; };
  const interrupt = () => { stopped = 'interrupted'; };
  process.on('SIGINT', interrupt); process.on('SIGTERM', interrupt);
  const heartbeat = setInterval(() => console.log(JSON.stringify({ event: 'heartbeat', completed: results.length, scheduled: schedule.length })), 30000);
  await update();
  try {
    await Promise.all(Array.from({ length: protocol.concurrency }, async () => {
      while (cursor < schedule.length && !stopped) {
        const slot = schedule[cursor++], entry = ledger.find(x => x.id === slot.id);
        entry.status = 'running'; await update();
        console.log(JSON.stringify({ event: 'started', caseId: slot.caseId, profile: slot.profile }));
        let result;
        try { result = await runCase({ item: selection.find(x => x.id === slot.caseId), slot, protocol, root, preflight: values.preflight }); }
        catch (error) { result = { id: slot.id, caseId: slot.caseId, profile: slot.profile, protocolHash: protocol.hash, status: 'failed', failure: { type: 'infrastructure', message: String(error) }, usage: null }; await saveJson(join(root, 'runs', slot.id, 'result.json'), result); }
        results.push(result); entry.status = result.status; entry.failure = result.failure;
        entry.resultHash = hash(await readFile(join(root, 'runs', slot.id, 'result.json')));
        stopped ??= values.preflight ? result.failure?.type : stopReason(results, protocol.maxTokens);
        await update();
        console.log(JSON.stringify({ event: 'finished', caseId: slot.caseId, status: result.status, failure: result.failure, tokens: result.usage?.totalTokens, grading: result.grading?.status }));
      }
    }));
  } finally { clearInterval(heartbeat); process.off('SIGINT', interrupt); process.off('SIGTERM', interrupt); }
  for (const entry of ledger) if (entry.status === 'pending') entry.status = 'not_run';
  await update();
  const summary = { protocolHash: protocol.hash, experimentId: id, scheduled: schedule.length, completed: results.filter(x => x.status === 'completed').length, failed: results.filter(x => x.status === 'failed').length, stopped, fullDataset: protocol.fullDataset, tokens: results.reduce((n,x) => n + (x.usage?.totalTokens ?? 0), 0), estimatedCost: results.reduce((n,x) => n + (x.estimatedCost ?? 0), 0), missingUsage: results.filter(x => !x.usage).length, grading: Object.fromEntries(['pass','fail','unverified'].map(status => [status,results.filter(x => x.grading?.status === status).length])), humanRatings: 0, promotion: 'not_evaluated' };
  await saveJson(join(root, 'summary.json'), summary);
  await rm(workspaceRoot, { recursive: true, force: true });
  console.log(JSON.stringify({ event: 'done', root, ...summary }));
  if (stopped || summary.failed) process.exitCode = 1;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(String(error)); process.exitCode = 1; });
