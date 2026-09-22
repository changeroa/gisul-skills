// Explicit, paid infrastructure check; this is not a scored dataset case.
import assert from 'node:assert/strict';
import { appendFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { buildEnvironment, CodexSession, readyServers, verifyBoundary } from './runtime.mjs';
import { estimateCost, hash, saveJson } from './run.mjs';
import { assertCanaryActions, canaryFingerprint } from './canary-proof.mjs';

const HERE = dirname(fileURLToPath(import.meta.url)), REPO = resolve(HERE, '..');
export async function writeCanary(root, readerPath) {
  await mkdir(root, { recursive: false });
  const reader = JSON.parse(await readFile(readerPath));
  assert.equal(hash(await readFile(reader.bundle)), reader.bundleHash);
  const workspace = join(homedir(), 'tmp/gisul-formal-canary', randomUUID());
  const home = join(root, 'codex-home'), log = join(root, 'mock.jsonl');
  const events = [], writes = [];
  let api;
  const evidence = { kind: 'infrastructure_capability_canary', synthetic: true, model: 'gpt-6-astra', effort: 'max', startedAt: new Date().toISOString(), passed: false };
  try {
    const built = await buildEnvironment({ home, workspace, agentsMarkdown: '', loaderMarkdown: await readFile(reader.loader, 'utf8'), model: evidence.model, effort: evidence.effort,
      deniedPaths: [root, REPO, join(homedir(), 'dev-tools')],
      servers: {
        gisul: { command: process.execPath, args: [join(HERE, 'reader.mjs')], cwd: REPO, env: { EVAL_READER_CONFIG: readerPath, GISUL_EVENT_LOG_DIR: join(root, 'gisul-events') } },
        linear: { command: process.execPath, args: [join(HERE, 'mock-linear.mjs')], cwd: REPO, env: { EVAL_WRITE_LOG: log } },
      } });
    const input = randomUUID() + '\n';
    await writeFile(join(workspace, 'canary-input.txt'), input, { flag: 'wx', mode: 0o600 });
    evidence.fingerprint = await canaryFingerprint(reader);
    api = new CodexSession({ cwd: workspace, config: built.config, env: built.env, record: event => { events.push(event); const pending = appendFile(join(root, 'events.jsonl'), JSON.stringify(event) + '\n', { mode: 0o600 }); writes.push(pending); return pending; } });
    evidence.host = await api.initialize();
    const started = await api.start(workspace, { developerInstructions: 'This is an authorized infrastructure canary against local workspace files and in-memory tools. Perform only the requested local file operations and two MCP calls, then report the result. Do not search skills or contact other services.' });
    evidence.environments = started.thread.environments;
    evidence.boundary = await verifyBoundary(api, { workspace, allowedPath: built.loaderPath, deniedPaths: [join(home, 'auth.json'), readerPath] });
    await readyServers(api);
    const completed = await api.turn('First use the local shell to print the exact contents of canary-input.txt, then copy its exact contents to canary-output.txt in this workspace. Next use linear.save_issue exactly once to create title "Evaluation write canary", team "IYEN Development", project "dev-tools", template "개발 작업". Then call linear.get_issue with the returned issue ID and confirm its title. These tools only change the local fixture.', { timeoutMs: 90000, responsesapiClientMetadata: { synthetic: 'true', gisul_eval_canary: 'file_and_fixture_write' } });
    evidence.turnId = completed.turn.id;
    const mock = (await readFile(log, 'utf8')).trim().split('\n').map(JSON.parse);
    evidence.checks = assertCanaryActions({ events, input, output: await readFile(join(workspace, 'canary-output.txt'), 'utf8'), mockEvents: mock });
    evidence.mockEvents = mock;
    evidence.passed = true;
  } catch (error) { evidence.error = String(error); }
  finally {
    if (api) await api.close().catch(error => { evidence.passed = false; evidence.error ??= String(error); });
    evidence.threadId = api?.threadId ?? null;
    evidence.usage = events.filter(x => x.method === 'thread/tokenUsage/updated').at(-1)?.params.tokenUsage.total ?? null;
    evidence.estimatedCost = estimateCost(evidence.usage);
    evidence.endedAt = new Date().toISOString();
    evidence.runtimeHash = hash(await readFile(join(HERE, 'runtime.mjs')));
    await rm(join(home, 'auth.json'), { force: true });
    await rm(workspace, { recursive: true, force: true });
    await Promise.all(writes);
    await saveJson(join(root, 'receipt.json'), evidence);
  }
  return evidence;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = (await import('node:util')).parseArgs({ options: { out: { type: 'string' }, 'reader-config': { type: 'string' } } });
  if (!values.out || !values['reader-config']) throw new Error('Usage: node eval/canary.mjs --out NEW_DIR --reader-config JSON');
  const receipt = await writeCanary(resolve(values.out), resolve(values['reader-config']));
  console.log(JSON.stringify(receipt, null, 2));
  if (!receipt.passed) process.exitCode = 1;
}
