import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFile, spawn } from 'node:child_process';
import { watch } from 'node:fs';
import { lstat, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { experimentSpan, exportRun, verifyItem } from '../eval/export.mjs';
import { scoreCase } from '../eval/score.mjs';

const sha = value => createHash('sha256').update(value).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';
const judgeInfo = { sourceKind: 'fixture', id: 'fixture', version: 'fixture-v1', model: 'fixture' };

async function runFixture(t, { profile = 'baseline', cost = 0.01, usage = { totalTokens: 10 }, answers = ['4', '4'], protocolOverrides = {} } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'eval-review-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const cases = ['Q-01', 'Q-02'].map((id, index) => ({
    id, kind: 'context', split: index ? 'holdout' : 'development', critical: !index,
    input: { prompt: 'What is 2 + 2?', fixtures: [] },
    expected: { rubric: 'The response must answer the arithmetic question correctly.', max_loads: 0, max_searches: 0 },
    fixture: 'synthetic-fixture',
  }));
  const schedule = cases.map((item, index) => ({ id: `slot-${index}`, caseId: item.id, profile, workspace: `/fixture/${index}` }));
  const protocol = {
    schema: 1, id: `fixture-${profile}`, createdAt: '2026-10-01T00:00:00.000Z',
    dataset: { name: 'qa-mechanics-fixture', version: sha(JSON.stringify(cases)), totalCases: cases.length },
    profile, sourceCommit: 'a'.repeat(40), codexVersion: 'fixture-v1', model: 'fixture-model', effort: 'max',
    maxTokens: 1000, concurrency: 1, timeoutMs: 1000,
    instructions: { baseline: 'baseline fixture', candidate: 'candidate fixture' },
    instructionHashes: { baseline: sha('baseline fixture'), candidate: sha('candidate fixture') },
    loaderMarkdown: 'fixture loader', reader: { commit: 'b'.repeat(40), release: 'fixture', bundleHash: 'c'.repeat(64) },
    prices: { kind: 'fixture-not-an-account-bill' }, fileHashes: { 'fixture.mjs': 'd'.repeat(64) },
    commonInstructions: 'fixture', schedule, preflight: false, fullDataset: true, synthetic: true,
    humanRatings: 0, semanticJudge: null, promotion: 'not_evaluated',
  };
  Object.assign(protocol, typeof protocolOverrides === 'function' ? protocolOverrides(protocol) : protocolOverrides);
  protocol.hash = sha(JSON.stringify(protocol));
  const entries = [];
  for (const slot of schedule) {
    const item = cases.find(item => item.id === slot.caseId);
    const finalText = answers[cases.indexOf(item)];
    const result = {
      id: slot.id, caseId: item.id, split: item.split, critical: item.critical, profile, protocolHash: protocol.hash,
      synthetic: true, threadId: `fixture-thread-${slot.id}`, turnId: `fixture-turn-${slot.id}`,
      startedAt: '2026-10-01T00:00:00.000Z', endedAt: '2026-10-01T00:00:01.000Z', status: 'completed',
      finalText, files: {}, items: [{ type: 'agentMessage', text: finalText }], mockEvents: [], gisulEvents: [],
      usage, estimatedCost: cost,
    };
    result.grading = scoreCase(item, result);
    const bytes = json(result);
    await mkdir(join(root, 'runs', slot.id), { recursive: true });
    await writeFile(join(root, 'runs', slot.id, 'result.json'), bytes);
    entries.push({ slot, item, result, resultHash: sha(bytes) });
  }
  await writeFile(join(root, 'protocol.json'), json(protocol));
  await writeFile(join(root, 'cases.private.json'), json(cases));
  await writeFile(join(root, 'phase.json'), json({ protocolHash: protocol.hash, stopped: null, runs: entries.map(({ slot, resultHash }) => ({ ...slot, status: 'completed', resultHash })) }));
  await writeFile(join(root, 'summary.json'), json({ protocolHash: protocol.hash, scheduled: 2, completed: 2, failed: 0 }));
  return { root, protocol, cases, entries };
}

function judgment(item, verdict = 'pass') {
  return { caseId: item.id, checks: [{ name: 'semantic_rubric', verdict, reason: 'Synthetic test judgment.', evidence: [{ path: '/response/finalText', quote: '4' }] }] };
}

async function reviewedFixture(t) {
  const { judgmentRequest } = await import('../eval/semantic-assessment.mjs');
  const fixture = await runFixture(t);
  const artifact = {
    schema: 1, kind: 'semantic-assessment', protocolHash: fixture.protocol.hash,
    casebookHash: fixture.protocol.dataset.version, processorHash: 'e'.repeat(64),
    createdAt: '2026-10-01T00:00:02.000Z', judge: judgeInfo,
    entries: fixture.entries.map(source => {
      const { item, resultHash } = source;
      const review = judgment(item);
      return { caseId: item.id, resultHash, expectedHash: sha(JSON.stringify(item.expected)), promptHash: sha(judgmentRequest(source).prompt), observableStatus: 'pass', status: 'pass', judgment: review, responseHash: sha(JSON.stringify(review)) };
    }),
  };
  const bytes = json(artifact);
  await writeFile(join(fixture.root, 'semantic-assessment.json'), bytes);
  return { ...fixture, artifact, artifactHash: sha(bytes) };
}

test('export retains optional semantic review evidence without relabeling frozen grading', async t => {
  const fixture = await reviewedFixture(t);
  const before = await readFile(join(fixture.root, 'runs/slot-0/result.json'));
  const preview = await exportRun(fixture.root, 'fixture-project');
  assert.equal(preview.execution.reviews?.semanticHash, fixture.artifactHash);
  assert.equal(preview.execution.reviews.humanRatings, 0);
  assert.deepEqual(await readFile(join(fixture.root, 'runs/slot-0/result.json')), before);
  assert.equal(fixture.entries[0].result.grading.status, 'unverified');
});

test('export refuses semantic evidence bound to a different frozen result', async t => {
  const fixture = await reviewedFixture(t);
  fixture.artifact.entries[0].resultHash = '0'.repeat(64);
  await writeFile(join(fixture.root, 'semantic-assessment.json'), json(fixture.artifact));
  await assert.rejects(exportRun(fixture.root, 'fixture-project'), { code: 'REVIEW_RESULT_MISMATCH' });
});

test('semantic readback rejects a changed prompt commitment before export', async t => {
  const fixture = await reviewedFixture(t);
  fixture.artifact.entries[0].promptHash = '0'.repeat(64);
  await writeFile(join(fixture.root, 'semantic-assessment.json'), json(fixture.artifact));
  await assert.rejects(exportRun(fixture.root, 'fixture-project'), { code: 'REVIEW_PROMPT_MISMATCH' });
});

test('export refuses review protocol and expected-contract drift', async t => {
  for (const [field, code] of [['protocolHash', 'REVIEW_PROTOCOL_MISMATCH'], ['expectedHash', 'REVIEW_EXPECTED_MISMATCH']]) {
    await t.test(field, async sub => {
      const fixture = await reviewedFixture(sub);
      if (field === 'protocolHash') fixture.artifact.protocolHash = '0'.repeat(64);
      else fixture.artifact.entries[0].expectedHash = '0'.repeat(64);
      await writeFile(join(fixture.root, 'semantic-assessment.json'), json(fixture.artifact));
      await assert.rejects(exportRun(fixture.root, 'fixture-project'), { code });
    });
  }
});

test('assessment records the prompt actually sent and preserves all frozen execution files', async t => {
  const { assessRun } = await import('../eval/semantic-assessment.mjs');
  const fixture = await runFixture(t), sent = [];
  const files = ['protocol.json', 'cases.private.json', 'phase.json', 'summary.json', 'runs/slot-0/result.json', 'runs/slot-1/result.json'];
  const before = await Promise.all(files.map(file => readFile(join(fixture.root, file))));
  const artifact = await assessRun(fixture.root, {
    judgeInfo, write: true,
    judge: async request => { sent.push(request); return judgment({ id: request.caseId }); },
  });
  assert.equal(sent.length, 2);
  assert.ok(artifact.entries.every(entry => entry.status === 'pass'));
  assert.equal(artifact.protocolHash, fixture.protocol.hash);
  for (const entry of artifact.entries) {
    assert.equal(entry.promptHash, sha(sent.find(request => request.caseId === entry.caseId).prompt));
    assert.equal(entry.resultHash, fixture.entries.find(item => item.item.id === entry.caseId).resultHash);
  }
  assert.deepEqual(await Promise.all(files.map(file => readFile(join(fixture.root, file)))), before);
  assert.deepEqual(JSON.parse(await readFile(join(fixture.root, 'semantic-assessment.json'))), artifact);
  await assert.rejects(assessRun(fixture.root, { judgeInfo, write: true, judge: () => assert.fail('an immutable review must not spend again') }), { code: 'REVIEW_EXISTS' });
});

test('judgment cannot cite expected answers or invented response text as execution evidence', async t => {
  const { assessRun } = await import('../eval/semantic-assessment.mjs');
  for (const evidence of [{ path: '/expected/rubric', quote: 'correctly' }, { path: '/response/finalText', quote: 'invented' }]) {
    const fixture = await runFixture(t);
    await assert.rejects(assessRun(fixture.root, {
      judgeInfo, write: true,
      judge: async request => {
        const review = judgment({ id: request.caseId });
        review.checks[0].evidence = [evidence];
        return review;
      },
    }), { code: 'REVIEW_EVIDENCE_MISMATCH' });
    await assert.rejects(readFile(join(fixture.root, 'semantic-assessment.json')), { code: 'ENOENT' });
    await assert.rejects(readFile(join(fixture.root, 'langfuse-export.lock')), { code: 'ENOENT' });
    await assert.rejects(readFile(join(fixture.root, 'langfuse-export.lock')), { code: 'ENOENT' });
  }
});

test('changed execution bytes and frozen export intent stop assessment before any judge call', async t => {
  const { assessRun } = await import('../eval/semantic-assessment.mjs');
  for (const frozen of [false, true]) {
    const fixture = await runFixture(t);
    if (frozen) await writeFile(join(fixture.root, 'langfuse-upload-intent.json'), json({ protocolHash: fixture.protocol.hash, spans: { existing: '0'.repeat(64) } }));
    else await writeFile(join(fixture.root, 'runs/slot-0/result.json'), json({ ...fixture.entries[0].result, finalText: 'changed after execution' }));
    await assert.rejects(assessRun(fixture.root, {
      judgeInfo, write: true, judge: () => assert.fail('invalid frozen evidence must not invoke a judge'),
    }), { code: frozen ? 'REVIEW_EXPORT_FROZEN' : 'REVIEW_RESULT_MISMATCH' });
  }
});

test('review writing excludes an exporter until the exact in-flight judge finishes', { timeout: 10000 }, async t => {
  const { assessRun } = await import('../eval/semantic-assessment.mjs');
  const fixture = await runFixture(t);
  let entered, release;
  const started = new Promise(resolve => { entered = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  const writing = assessRun(fixture.root, {
    judgeInfo, write: true,
    judge: async request => { entered(); await gate; return judgment({ id: request.caseId }); },
  });
  try {
    await Promise.race([started, writing.then(() => assert.fail('judge entry must precede completion'))]);
    await assert.rejects(exportRun(fixture.root, 'fixture-project', { apply: true, api: { request: () => assert.fail('the competing exporter must not write') } }), { code: 'EEXIST' });
  } finally { release(); await writing; }
  await assert.rejects(readFile(join(fixture.root, 'langfuse-export.lock')), { code: 'ENOENT' });
});

test('unknown usage remains unverified even when a judge would approve the answer', async t => {
  const { assessRun } = await import('../eval/semantic-assessment.mjs');
  const fixture = await runFixture(t, { usage: null });
  const artifact = await assessRun(fixture.root, { judgeInfo, write: true, judge: async request => judgment({ id: request.caseId }) });
  assert.deepEqual(artifact.entries.map(entry => entry.status), ['unverified', 'unverified']);
  assert.ok(artifact.entries.every(entry => entry.judgment === null && entry.promptHash === null));
});

test('optional review readback preserves per-case binding while raw grading stays unverified', async t => {
  const fixture = await reviewedFixture(t);
  const span = experimentSpan(fixture.protocol, fixture.cases[0], fixture.entries[0].result, 'dataset-id', {
    scheduled: 2, reviews: { semanticHash: fixture.artifactHash, humanRatings: 0 },
    review: { semantic: { assessmentHash: fixture.artifactHash, judge: judgeInfo, entry: fixture.artifact.entries[0] } },
  });
  const values = Object.fromEntries(span.attributes.map(attribute => [attribute.key, attribute.value.stringValue]));
  const row = {
    id: span.spanId, traceId: span.traceId, environment: 'evaluation', experimentDatasetId: 'dataset-id',
    input: JSON.parse(values['langfuse.observation.input']), output: JSON.parse(values['langfuse.observation.output']),
    expectedOutput: JSON.parse(values['langfuse.experiment.item.expected_output']), metadata: JSON.parse(values['langfuse.observation.metadata']),
    experimentMetadata: { protocol_hash: fixture.protocol.hash, execution: JSON.parse(values['langfuse.experiment.metadata.execution']) },
  };
  assert.equal(row.metadata.reviews?.semantic?.entry?.resultHash, fixture.entries[0].resultHash);
  assert.equal(row.output.grading.status, 'unverified');
  assert.equal(Object.hasOwn(row.experimentMetadata.execution, 'review'), false);
  verifyItem(row, span, fixture.protocol, 'dataset-id');
  delete row.metadata.reviews.semantic.entry.resultHash;
  assert.throws(() => verifyItem(row, span, fixture.protocol, 'dataset-id'), /Remote metadata/);
});

test('unscheduled phase entries cannot stand in for missing frozen cases', async t => {
  const { readRunSnapshot } = await import('../eval/semantic-assessment.mjs');
  const fixture = await runFixture(t);
  const phase = JSON.parse(await readFile(join(fixture.root, 'phase.json')));
  phase.runs[0] = { id: 'unscheduled', status: 'not_run' };
  await writeFile(join(fixture.root, 'phase.json'), json(phase));
  await assert.rejects(readRunSnapshot(fixture.root), { code: 'REVIEW_SCHEDULE_MISMATCH' });
});

test('frontier model claims require a frozen evidence-backed selection', async t => {
  const { assessRun } = await import('../eval/semantic-assessment.mjs');
  const fixture = await runFixture(t);
  await assert.rejects(assessRun(fixture.root, {
    judgeInfo: { sourceKind: 'model', id: 'codex-cli', version: 'unsupported-claim', model: 'qa-model', effort: 'max' },
    judge: async request => judgment({ id: request.caseId }), write: true,
  }), { code: 'REVIEW_FRONTIER_REQUIRED' });
  await assert.rejects(readFile(join(fixture.root, 'semantic-assessment.json')), { code: 'ENOENT' });
});

test('frontier assessment CLI refuses malformed selection instead of silently succeeding', async t => {
  const fixture = await runFixture(t);
  const selection = join(fixture.root, 'invalid-selection.json');
  await writeFile(selection, json({ schema: 1, hash: '0'.repeat(64) }));
  const entry = fileURLToPath(new URL('../eval/semantic-assessment.mjs', import.meta.url));
  const result = await new Promise(resolve => {
    execFile(process.execPath, [entry, '--run', fixture.root, '--selection', selection, '--apply'], { timeout: 10000 }, (error, stdout, stderr) => {
      resolve({ status: error ? (typeof error.code === 'number' ? error.code : 1) : 0, stdout, stderr });
    });
  });
  assert.notEqual(result.status, 0, 'malformed selection must stop the shipped assessment CLI');
  await assert.rejects(readFile(join(fixture.root, 'semantic-assessment.json')), { code: 'ENOENT' });
});

function frontierPolicy() {
  return {
    schema: 1, version: 'fixture-policy-v1', metric: 'fixture-capability-index', scope: 'synthetic transport fixtures only',
    checkedAt: '2026-10-01T00:00:00.000Z', source: { url: 'https://example.test/ranking', version: 'fixture-index-v1' },
    candidates: [
      { id: 'old', provider: 'openai', transport: 'codex-cli', model: 'qa-old', effort: 'max', score: 1, fallback: false, evidenceUrl: 'https://example.test/old' },
      { id: 'strong', provider: 'openai', transport: 'codex-cli', model: 'qa-strong', effort: 'max', score: 3, fallback: false, evidenceUrl: 'https://example.test/strong' },
    ],
  };
}

function selectedModelInfo(selection) {
  return {
    sourceKind: 'model', id: selection.selected.transport, version: selection.hash,
    model: selection.selected.model, effort: selection.selected.effort, selection,
    adapterHash: 'a'.repeat(64), cliVersion: selection.selected.transport === 'codex-cli' ? 'codex-cli 0.160.0' : '2.1.296 (Claude Code)',
  };
}

test('frontier policy upgrades to a stronger new provider without changing the old frozen selection', async () => {
  const { selectJudge, validateSelection } = await import('../eval/frontier-judge.mjs');
  const policy = frontierPolicy();
  const initial = selectJudge(policy);
  assert.equal(initial.selected.model, 'qa-strong', 'provider default or first row is not the strongest');
  policy.candidates.push({ id: 'next', provider: 'anthropic', transport: 'claude-cli', model: 'qa-next', effort: 'max', score: 5, fallback: false, evidenceUrl: 'https://example.test/next' });
  const next = selectJudge(policy);
  assert.equal(next.selected.model, 'qa-next');
  assert.equal(next.selected.transport, 'claude-cli');
  assert.notEqual(next.hash, initial.hash);
  assert.equal(initial.policy.candidates.length, 2);
  assert.equal(validateSelection(initial).selected.model, 'qa-strong');
});

test('frontier policy refuses empty, ambiguous, unscored and fallback configurations', async t => {
  const { selectJudge } = await import('../eval/frontier-judge.mjs');
  const mutations = {
    empty: policy => { policy.candidates = []; },
    tied: policy => { policy.candidates[0].score = 3; },
    unknown: policy => { policy.candidates[1].score = null; },
    fallback: policy => { policy.candidates[1].fallback = true; },
    credentials: policy => { policy.source.url = 'https://user:private@example.test/ranking'; },
  };
  for (const [name, mutate] of Object.entries(mutations)) {
    await t.test(name, () => {
      const policy = frontierPolicy(); mutate(policy);
      assert.throws(() => selectJudge(policy), { code: name === 'tied' ? 'FRONTIER_TIED' : 'FRONTIER_POLICY_INVALID' });
    });
  }
});

test('a self-consistent hash cannot substitute a weaker candidate for the policy winner', async () => {
  const { selectJudge, validateSelection } = await import('../eval/frontier-judge.mjs');
  const selection = selectJudge(frontierPolicy());
  const weaker = { ...selection, selected: selection.policy.candidates[0] };
  delete weaker.hash; weaker.hash = sha(JSON.stringify(weaker));
  assert.throws(() => validateSelection(weaker), { code: 'FRONTIER_SELECTION_MISMATCH' });
});

test('frontier model identity cannot lower the frozen model or reasoning effort', async t => {
  const { selectJudge } = await import('../eval/frontier-judge.mjs');
  const { assessRun } = await import('../eval/semantic-assessment.mjs');
  const selection = selectJudge(frontierPolicy());
  for (const change of [{ model: 'qa-old' }, { effort: 'low' }, { version: 'different-selection' }]) {
    const fixture = await runFixture(t);
    await assert.rejects(assessRun(fixture.root, {
      judgeInfo: { ...selectedModelInfo(selection), ...change }, write: true,
      judge: () => assert.fail('mismatched model must not consume a judgment'),
    }), { code: 'REVIEW_FRONTIER_MISMATCH' });
  }
});

test('model-only assessment retains the frozen winner and needs no human input', async t => {
  const { selectJudge } = await import('../eval/frontier-judge.mjs');
  const { assessRun } = await import('../eval/semantic-assessment.mjs');
  const fixture = await runFixture(t);
  const selection = selectJudge(frontierPolicy());
  const artifact = await assessRun(fixture.root, {
    judgeInfo: selectedModelInfo(selection), write: true,
    judge: async request => judgment({ id: request.caseId }),
  });
  assert.equal(artifact.judge.model, 'qa-strong');
  assert.equal(artifact.judge.effort, 'max');
  assert.deepEqual(artifact.judge.selection, selection);
  assert.ok(artifact.entries.every(entry => entry.status === 'pass'));
  assert.equal(JSON.parse(await readFile(join(fixture.root, 'protocol.json'))).humanRatings, 0);
});

async function fixtureTransports(t, { claudeVersion = '2.1.296' } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'frontier-transport-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const bin = join(root, 'bin'), auth = join(root, 'auth'), home = join(root, 'home');
  await mkdir(bin); await mkdir(auth); await mkdir(home);
  await writeFile(join(root, 'package.json'), '{"type":"commonjs"}');
  await writeFile(join(auth, 'auth.json'), '{"auth_mode":"fixture"}');
  const program = `#!${process.execPath}
const fs = require('node:fs');
const path = require('node:path');
const args = process.argv.slice(2), claude = path.basename(process.argv[1]) === 'claude';
const get = flag => args[args.indexOf(flag) + 1];
if (args.includes('--version')) console.log(claude ? ${JSON.stringify(`${claudeVersion} (Claude Code)`)} : 'codex-cli 0.160.0');
else if (claude && args[0] === 'auth') {
  fs.writeFileSync(path.join(__dirname,'auth-called'),'true');
  console.log(JSON.stringify({loggedIn:true}));
}
else if (args[0] === 'app-server') {
  require('node:readline').createInterface({input:process.stdin}).on('line', line => {
    const message = JSON.parse(line);
    if (message.id === undefined) return;
    const named = args.includes('default_permissions="judge"') && args.some(value=>value.startsWith('permissions.judge=') && value.includes('"/"="deny"'));
    const result = message.method === 'initialize' ? {} : message.method === 'config/read'
      ? {config:{default_permissions:named?'judge':'eval',model:JSON.parse(args.find(value=>value.startsWith('model=')).slice(6)),
          model_reasoning_effort:'max',project_doc_max_bytes:0,permissions:{judge:{extends:':read-only',filesystem:{'/':'deny'},network:{enabled:false}}},mcp_servers:{}}}
      : message.method === 'model/list'
        ? {data:['qa-old','qa-strong'].map(model=>({model,supportedReasoningEfforts:[{reasoningEffort:'max'}]})),nextCursor:null} : null;
    console.log(JSON.stringify(result === null ? {id:message.id,error:{code:-32601}} : {id:message.id,result}));
  });
} else {
  const required = claude ? ['--safe-mode','--restricted','--strict-mcp-config','--no-session-persistence','--json-schema']
    : ['--ephemeral','--ignore-user-config','--output-schema','--output-last-message'];
  const named = args.includes('default_permissions="judge"') && args.some(value=>value.startsWith('permissions.judge=') && value.includes('"/"="deny"'));
  const unstableHostDiscovery = args.includes('features.skip_host_skill_discovery=true');
  if (!claude) fs.writeFileSync(path.join(__dirname,'environment.json'),JSON.stringify({privateHome:process.env.HOME===process.env.CODEX_HOME,unstableHostDiscovery}));
  if (required.some(flag=>!args.includes(flag)) || args.includes('--fallback-model')
      || (claude ? get('--tools') !== '' : get('--sandbox') !== 'read-only' && !named)) process.exit(9);
  let input = '';
  process.stdin.on('data', bytes=>input+=bytes);
  process.stdin.on('end', ()=>{
    const model = get('--model');
    const effort = claude ? get('--effort') : args.find(value=>value.startsWith('model_reasoning_effort='));
    fs.appendFileSync(path.join(__dirname,'calls.jsonl'),JSON.stringify({model,effort})+'\\n');
    const modePath = path.join(__dirname,'mode.json');
    const mode = fs.existsSync(modePath) ? JSON.parse(fs.readFileSync(modePath)) : {};
    if (mode.requireDenyAll && !named) { console.error('fixture requires a named deny-all filesystem profile'); process.exit(11); }
    if (mode.fail) { console.error('fixture provider failure'); process.exit(17); }
    if (mode.hold) {
      fs.watch(__dirname,()=>{});
      fs.writeFileSync(path.join(__dirname,'ready.tmp'),JSON.stringify({pid:process.pid,authHome:process.env.CODEX_HOME}));
      fs.renameSync(path.join(__dirname,'ready.tmp'),path.join(__dirname,'ready.json'));
      return;
    }
    const data = JSON.parse(input.slice(input.lastIndexOf('\\n')+1));
    const output = {caseId:data.caseId,checks:data.requiredChecks.map(name=>({
      name,verdict:data.response.finalText==='4'?'pass':'fail',reason:'Fixture protocol response.',
      evidence:[{path:'/response/finalText',quote:data.response.finalText}]
    }))};
    const reported = mode.reportedModel || model;
    if (claude) console.log(JSON.stringify({is_error:false,structured_output:output,modelUsage:{[reported]:{}},usage:{input_tokens:10,output_tokens:5}}));
    else {
      fs.writeFileSync(get('--output-last-message'),JSON.stringify(output));
      console.log(JSON.stringify({type:'thread.started',thread_id:'fixture',model:reported}));
      if (unstableHostDiscovery || mode.diagnostic) console.log(JSON.stringify({type:'item.completed',item:{type:'error',message:'Fixture native diagnostic.'}}));
      if (mode.toolType) console.log(JSON.stringify({type:'item.completed',item:{type:mode.toolType}}));
      console.log(JSON.stringify({type:'turn.completed',usage:{input_tokens:10,output_tokens:5}}));
    }
  });
}
`;
  for (const name of ['codex', 'claude']) await writeFile(join(bin, name), program, { mode: 0o700 });
  return { root, bin, env: { ...process.env, PATH: bin + ':' + process.env.PATH, HOME: home, CODEX_HOME: auth } };
}

test('frontier transport journals exact responses and never repeats completed or ambiguous paid attempts', async t => {
  const { selectJudge, createJudge } = await import('../eval/frontier-judge.mjs');
  const { judgmentRequest } = await import('../eval/semantic-assessment.mjs');
  const fixture = await runFixture(t), transport = await fixtureTransports(t);
  const selection = selectJudge(frontierPolicy());
  const backend = await createJudge(selection, { root: fixture.root, env: transport.env });
  try {
    const request = judgmentRequest(fixture.entries[0]);
    const first = await backend.judge(request), second = await backend.judge(request);
    assert.deepEqual(second, first);
    assert.equal(first.checks[0].verdict, 'pass');
    assert.equal(backend.judgeInfo.reportedModel, 'qa-strong');
    const lines = (await readFile(join(transport.bin, 'calls.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
    assert.deepEqual(lines, [{ model: 'qa-strong', effort: 'model_reasoning_effort="max"' }]);
    const receiptPath = join(fixture.root, 'judge-attempts', selection.hash, sha(request.prompt), 'receipt.json');
    const receipt = JSON.parse(await readFile(receiptPath));
    assert.equal(receipt.state, 'completed');
    assert.equal(receipt.responseHash, sha(await readFile(join(fixture.root, 'judge-attempts', selection.hash, sha(request.prompt), 'response.json'))));
    await writeFile(receiptPath, json({ ...receipt, state: 'started' }));
    await assert.rejects(backend.judge(request), { code: 'JUDGE_ATTEMPT_AMBIGUOUS' });
    assert.equal((await readFile(join(transport.bin, 'calls.jsonl'), 'utf8')).trim().split('\n').length, 1);
  } finally { await backend.close(); }
});

test('a provider failure is retained and cannot trigger another model or an implicit retry', async t => {
  const { selectJudge, createJudge } = await import('../eval/frontier-judge.mjs');
  const { judgmentRequest } = await import('../eval/semantic-assessment.mjs');
  const fixture = await runFixture(t), transport = await fixtureTransports(t);
  await writeFile(join(transport.bin, 'mode.json'), '{"fail":true}');
  const selection = selectJudge(frontierPolicy());
  const backend = await createJudge(selection, { root: fixture.root, env: transport.env });
  try {
    const request = judgmentRequest(fixture.entries[0]);
    await assert.rejects(backend.judge(request), { code: 'JUDGE_EXECUTION_FAILED' });
    await assert.rejects(backend.judge(request), { code: 'JUDGE_ATTEMPT_AMBIGUOUS' });
    const receipt = JSON.parse(await readFile(join(fixture.root, 'judge-attempts', selection.hash, sha(request.prompt), 'receipt.json')));
    assert.equal(receipt.state, 'failed');
    assert.equal(receipt.error, 'JUDGE_EXECUTION_FAILED');
    assert.equal((await readFile(join(transport.bin, 'calls.jsonl'), 'utf8')).trim().split('\n').length, 1);
  } finally { await backend.close(); }
});

test('Claude preflight rejects unsupported versions before authentication or inference', async t => {
  const { selectJudge, createJudge } = await import('../eval/frontier-judge.mjs');
  const policy = frontierPolicy();
  policy.candidates.push({ id: 'next', provider: 'anthropic', transport: 'claude-cli', model: 'qa-next', effort: 'max', score: 5, fallback: false, evidenceUrl: 'https://example.test/next' });
  const selection = selectJudge(policy);
  for (const version of ['1.99.999', '2.1.236', '2.1.258']) await t.test(version, async t => {
    const fixture = await runFixture(t), transport = await fixtureTransports(t, { claudeVersion: version });
    let backend, failure;
    try {
      await assert.rejects(async () => {
        try { backend = await createJudge(selection, { root: fixture.root, env: transport.env }); }
        catch (error) { failure = error; throw error; }
      }, { code: 'JUDGE_CLI_UNSUPPORTED' });
    } finally { await backend?.close(); }
    await assert.rejects(lstat(join(transport.bin, 'auth-called')), { code: 'ENOENT' });
    await assert.rejects(lstat(join(fixture.root, 'judge-attempts')), { code: 'ENOENT' });
    await assert.rejects(lstat(failure.resources.temporary), { code: 'ENOENT' });
    for (const { pid } of failure.resources.processes) assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
  });
});

test('Claude preflight accepts the minimum version and newer minor or major versions', async t => {
  const { selectJudge, createJudge } = await import('../eval/frontier-judge.mjs');
  const policy = frontierPolicy();
  policy.candidates.push({ id: 'next', provider: 'anthropic', transport: 'claude-cli', model: 'qa-next', effort: 'max', score: 5, fallback: false, evidenceUrl: 'https://example.test/next' });
  const selection = selectJudge(policy);
  for (const version of ['2.1.259', '2.2.0', '3.0.0']) await t.test(version, async t => {
    const fixture = await runFixture(t), transport = await fixtureTransports(t, { claudeVersion: version });
    const backend = await createJudge(selection, { root: fixture.root, env: transport.env });
    try { assert.equal(backend.judgeInfo.cliVersion, `${version} (Claude Code)`); }
    finally { await backend.close(); }
    await assert.rejects(lstat(backend.resources.temporary), { code: 'ENOENT' });
  });
});

test('Claude transport requires the selected reported model and rejects a weaker reroute', async t => {
  const { selectJudge, createJudge } = await import('../eval/frontier-judge.mjs');
  const { judgmentRequest } = await import('../eval/semantic-assessment.mjs');
  const fixture = await runFixture(t), transport = await fixtureTransports(t);
  const policy = frontierPolicy();
  policy.candidates.push({ id: 'next', provider: 'anthropic', transport: 'claude-cli', model: 'qa-next', effort: 'max', score: 5, fallback: false, evidenceUrl: 'https://example.test/next' });
  const selection = selectJudge(policy);
  const backend = await createJudge(selection, { root: fixture.root, env: transport.env });
  try {
    const good = await backend.judge(judgmentRequest(fixture.entries[0]));
    assert.equal(good.checks[0].verdict, 'pass');
    assert.equal(backend.judgeInfo.reportedModel, 'qa-next');
    await writeFile(join(transport.bin, 'mode.json'), '{"reportedModel":"qa-old"}');
    await assert.rejects(backend.judge(judgmentRequest(fixture.entries[1])), { code: 'JUDGE_MODEL_MISMATCH' });
  } finally { await backend.close(); }
});

test('a new or unknown Codex tool cannot be accepted as a tool-free judgment', async t => {
  const { selectJudge, createJudge } = await import('../eval/frontier-judge.mjs');
  const { judgmentRequest } = await import('../eval/semantic-assessment.mjs');
  const fixture = await runFixture(t), transport = await fixtureTransports(t);
  await writeFile(join(transport.bin, 'mode.json'), '{"toolType":"file_read"}');
  const backend = await createJudge(selectJudge(frontierPolicy()), { root: fixture.root, env: transport.env });
  try { await assert.rejects(backend.judge(judgmentRequest(fixture.entries[0])), { code: 'JUDGE_TOOL_USE' }); }
  finally { await backend.close(); }
});

test('Codex judging uses a deny-all filesystem profile rather than global read access', async t => {
  const { selectJudge, createJudge } = await import('../eval/frontier-judge.mjs');
  const { judgmentRequest } = await import('../eval/semantic-assessment.mjs');
  const fixture = await runFixture(t), transport = await fixtureTransports(t);
  await writeFile(join(transport.bin, 'mode.json'), '{"requireDenyAll":true}');
  const backend = await createJudge(selectJudge(frontierPolicy()), { root: fixture.root, env: transport.env });
  try {
    const response = await backend.judge(judgmentRequest(fixture.entries[0]));
    assert.equal(response.checks[0].verdict, 'pass');
  } finally { await backend.close(); }
});

test('Codex judging isolates HOME without enabling unstable host-discovery features', async t => {
  const { selectJudge, createJudge } = await import('../eval/frontier-judge.mjs');
  const { judgmentRequest } = await import('../eval/semantic-assessment.mjs');
  const fixture = await runFixture(t), transport = await fixtureTransports(t);
  const backend = await createJudge(selectJudge(frontierPolicy()), { root: fixture.root, env: transport.env });
  try {
    const result = await backend.judge(judgmentRequest(fixture.entries[0]));
    assert.equal(result.checks[0].verdict, 'pass');
    assert.deepEqual(JSON.parse(await readFile(join(transport.bin, 'environment.json'))), { privateHome: true, unstableHostDiscovery: false });
  } finally { await backend.close(); }
});

test('a native diagnostic item is an execution problem rather than a model tool call', async t => {
  const { selectJudge, createJudge } = await import('../eval/frontier-judge.mjs');
  const { judgmentRequest } = await import('../eval/semantic-assessment.mjs');
  const fixture = await runFixture(t), transport = await fixtureTransports(t);
  await writeFile(join(transport.bin, 'mode.json'), '{"diagnostic":true}');
  const backend = await createJudge(selectJudge(frontierPolicy()), { root: fixture.root, env: transport.env });
  try { await assert.rejects(backend.judge(judgmentRequest(fixture.entries[0])), { code: 'JUDGE_EXECUTION_FAILED' }); }
  finally { await backend.close(); }
});

test('interrupting the shipped assessment CLI stops its model process and deletes copied authentication', { timeout: 15000 }, async t => {
  const { selectJudge } = await import('../eval/frontier-judge.mjs');
  const fixture = await runFixture(t), transport = await fixtureTransports(t);
  const selection = selectJudge(frontierPolicy()), selectionPath = join(fixture.root, 'selection.json');
  await writeFile(selectionPath, json(selection));
  await writeFile(join(transport.bin, 'mode.json'), '{"hold":true}');
  let watcher, readyValue;
  const ready = new Promise((resolve, reject) => {
    watcher = watch(transport.bin, async (_event, filename) => {
      if (filename?.toString() !== 'ready.json') return;
      watcher.close();
      try { resolve(JSON.parse(await readFile(join(transport.bin, 'ready.json')))); }
      catch (error) { reject(error); }
    });
    t.signal.addEventListener('abort', () => reject(t.signal.reason), { once: true });
  });
  const entry = fileURLToPath(new URL('../eval/semantic-assessment.mjs', import.meta.url));
  const child = spawn(process.execPath, [entry, '--run', fixture.root, '--selection', selectionPath, '--apply'], { env: transport.env, stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = '';
  child.stdout.resume(); child.stderr.on('data', bytes => { stderr += bytes; });
  const exited = new Promise((resolve, reject) => { child.once('close', (code, signal) => resolve({ code, signal })); child.once('error', reject); });
  try {
    readyValue = await Promise.race([ready, exited.then(() => assert.fail('the provider must reach its event-synchronized busy state'))]);
    child.kill('SIGINT');
    const result = await exited;
    assert.notEqual(result.code, 0);
    assert.throws(() => process.kill(readyValue.pid, 0), { code: 'ESRCH' });
    await assert.rejects(readFile(join(readyValue.authHome, 'auth.json')), { code: 'ENOENT' });
    await assert.rejects(readFile(join(fixture.root, 'semantic-assessment.json')), { code: 'ENOENT' });
    assert.equal(JSON.parse(stderr.trim()).error, 'JUDGE_CANCELLED');
  } finally {
    watcher?.close();
    child.kill('SIGKILL');
    if (!readyValue) {
      try { readyValue = JSON.parse(await readFile(join(transport.bin, 'ready.json'))); } catch {}
    }
    if (readyValue) {
      console.log('C3_CANCEL_TEST_OWNED_PID=' + readyValue.pid);
      try { process.kill(-readyValue.pid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
      await rm(join(readyValue.authHome, '..'), { recursive: true, force: true });
    }
    await exited;
  }
});

async function ratedFixture(t, options = {}) {
  const { selectJudge } = await import('../eval/frontier-judge.mjs');
  const { assessRun } = await import('../eval/semantic-assessment.mjs');
  const fixture = await runFixture(t, options);
  const selection = options.selection ?? selectJudge(frontierPolicy());
  const artifact = await assessRun(fixture.root, {
    judgeInfo: selectedModelInfo(selection), write: true,
    judge: async request => ({
      caseId: request.caseId,
      checks: request.requiredChecks.map(name => ({
        name, verdict: options.abstainCase === request.caseId ? 'abstain' : request.response.finalText === '4' ? 'pass' : 'fail',
        reason: 'Fixture arithmetic judgment.',
        evidence: options.abstainCase === request.caseId ? [] : [{ path: '/response/finalText', quote: request.response.finalText }],
      })),
    }),
  });
  return { ...fixture, selection, artifact };
}

async function comparisonCLI(baseline, candidate) {
  const entry = fileURLToPath(new URL('../eval/semantic-assessment.mjs', import.meta.url));
  const env = { ...process.env, PATH: '', HOME: join(baseline.root, 'no-provider-home'), CODEX_HOME: join(baseline.root, 'no-provider-auth') };
  delete env.NODE_TEST_CONTEXT;
  return new Promise(resolve => {
    execFile(process.execPath, [entry, '--compare', '--baseline', baseline.root, '--candidate', candidate.root],
      { env, timeout: 10000 }, (error, stdout, stderr) => {
        resolve({ status: error ? (typeof error.code === 'number' ? error.code : 1) : 0, stdout, stderr });
      });
  });
}

test('matched comparison accepts a fixed frontier judge at the 130 percent boundary with zero human ratings', async t => {
  const baseline = await ratedFixture(t, { cost: 1 });
  const candidate = await ratedFixture(t, { profile: 'candidate', cost: 1.3 });
  const before = await Promise.all([baseline, candidate].flatMap(fixture => ['protocol.json', 'semantic-assessment.json'].map(file => readFile(join(fixture.root, file)))));
  const result = await comparisonCLI(baseline, candidate);
  assert.equal(result.status, 0, 'the shipped comparison CLI must execute a complete matched comparison');
  const report = JSON.parse(result.stdout);
  assert.equal(report.eligible, true);
  assert.equal(report.costRatio, 1.3);
  assert.equal(report.judge.model, 'qa-strong');
  assert.equal(report.humanRatings, 0);
  assert.equal(report.promotion, 'not_evaluated');
  assert.deepEqual(await Promise.all([baseline, candidate].flatMap(fixture => ['protocol.json', 'semantic-assessment.json'].map(file => readFile(join(fixture.root, file))))), before);
  await assert.rejects(readFile(join(candidate.root, 'judge-attempts')), { code: 'ENOENT' });
});

test('matched comparison rejects every documented frozen control drift', async t => {
  const baseline = await ratedFixture(t);
  const changes = {
    dataset: protocol => ({ dataset: { ...protocol.dataset, name: 'another-dataset' } }),
    sourceCommit: { sourceCommit: 'f'.repeat(40) },
    codexVersion: { codexVersion: 'another-cli-version' },
    model: { model: 'another-agent-model' },
    effort: { effort: 'low' },
    fileHashes: { fileHashes: { 'fixture.mjs': 'f'.repeat(64) } },
    instructionHashes: { instructionHashes: { baseline: sha('changed'), candidate: sha('candidate fixture') }, instructions: { baseline: 'changed', candidate: 'candidate fixture' } },
    loaderMarkdown: { loaderMarkdown: 'different loader' },
    reader: protocol => ({ reader: { ...protocol.reader, release: 'another-release' } }),
    commonInstructions: { commonInstructions: 'different common instruction' },
    maxTokens: { maxTokens: 2000 },
    concurrency: { concurrency: 2 },
    timeoutMs: { timeoutMs: 2000 },
  };
  for (const [field, protocolOverrides] of Object.entries(changes)) {
    await t.test(field, async sub => {
      const candidate = await ratedFixture(sub, { profile: 'candidate', protocolOverrides });
      const result = await comparisonCLI(baseline, candidate);
      assert.equal(result.status, 2);
      assert.ok(JSON.parse(result.stdout).reasons.some(reason => reason.code === 'PROTOCOL_MISMATCH' && reason.fields.includes(field)));
    });
  }
});

test('matched comparison rejects missing ratings, abstention, critical and holdout regressions, and excess cost', async t => {
  const baseline = await ratedFixture(t, { cost: 1 });
  const scenarios = [
    ['critical', { answers: ['5', '4'], cost: 1 }, 'CRITICAL_REGRESSION'],
    ['holdout', { answers: ['4', '5'], cost: 1 }, 'HOLDOUT_REGRESSION'],
    ['abstain', { abstainCase: 'Q-01', cost: 1 }, 'UNVERIFIED_GRADING'],
    ['cost', { cost: 1.300001 }, 'COST_REGRESSION'],
    ['unknown_cost', { cost: null }, 'COST_UNKNOWN'],
    ['unknown_usage', { usage: null, cost: 1 }, 'USAGE_UNKNOWN'],
    ['missing', { cost: 1 }, 'SEMANTIC_ASSESSMENT_MISSING'],
  ];
  for (const [name, options, code] of scenarios) {
    await t.test(name, async sub => {
      const candidate = await ratedFixture(sub, { profile: 'candidate', ...options });
      if (name === 'missing') await rm(join(candidate.root, 'semantic-assessment.json'));
      const result = await comparisonCLI(baseline, candidate);
      assert.equal(result.status, 2);
      assert.ok(JSON.parse(result.stdout).reasons.some(reason => reason.code === code));
    });
  }
});

test('matched comparison rejects a changed judge snapshot and later harness invalidation', async t => {
  const { selectJudge } = await import('../eval/frontier-judge.mjs');
  const baseline = await ratedFixture(t);
  const policy = frontierPolicy(); policy.version = 'fixture-policy-v2';
  const candidate = await ratedFixture(t, { profile: 'candidate', selection: selectJudge(policy) });
  let result = await comparisonCLI(baseline, candidate);
  assert.equal(result.status, 2);
  assert.ok(JSON.parse(result.stdout).reasons.some(reason => reason.code === 'JUDGE_MISMATCH'));
  const invalid = await ratedFixture(t, { profile: 'candidate' });
  await writeFile(join(invalid.root, 'assessment.json'), json({ status: 'diagnostic_invalid_for_behavior', reason: 'Fixture invalidation.' }));
  result = await comparisonCLI(baseline, invalid);
  assert.equal(result.status, 2);
  assert.ok(JSON.parse(result.stdout).reasons.some(reason => reason.code === 'HARNESS_DIAGNOSTIC'));
});

test('matched comparison cannot equate two absent source controls or a malformed diagnostic with valid evidence', async t => {
  const baseline = await ratedFixture(t, { protocolOverrides: { fileHashes: undefined } });
  const candidate = await ratedFixture(t, { profile: 'candidate', protocolOverrides: { fileHashes: undefined } });
  let result = await comparisonCLI(baseline, candidate);
  assert.equal(result.status, 2);
  assert.ok(JSON.parse(result.stdout).reasons.some(reason => reason.code === 'PROTOCOL_INCOMPLETE'));
  const validBaseline = await ratedFixture(t), invalid = await ratedFixture(t, { profile: 'candidate' });
  await writeFile(join(invalid.root, 'assessment.json'), 'null');
  result = await comparisonCLI(validBaseline, invalid);
  assert.equal(result.status, 2);
  assert.ok(JSON.parse(result.stdout).reasons.some(reason => reason.code === 'EVIDENCE_INVALID'));
});

test('matched comparison never treats a diagnostic fixture judge as a frontier model', async t => {
  const baseline = await reviewedFixture(t), candidate = await ratedFixture(t, { profile: 'candidate' });
  const result = await comparisonCLI(baseline, candidate);
  assert.equal(result.status, 2);
  assert.ok(JSON.parse(result.stdout).reasons.some(reason => reason.code === 'JUDGE_NOT_FRONTIER'));
});
