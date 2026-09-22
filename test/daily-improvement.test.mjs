import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runDaily, renderCandidate } from '../scripts/daily-improvement.mjs';

const date = '2020-01-01';
const config = outputRoot => ({ outputRoot, projectId: 'project1', githubRepo: 'changeroa/gisul-skills', model: 'test-model', reasoning: 'high', maxRunSeconds: 30, maxTraces: 2, maxInputBytes: 10000, enableModelAnalysis: true, publishDraftPR: true });
const quality = { checkpoint_schema: 3, project_id: 'project1', date, timezone: 'Asia/Seoul', source: 'observations-v2-logical-roots', complete: true, full_day: true, passed: true, counts: { non_synthetic_roots: 5, non_synthetic_primary_turn_roots: 2 } };
const response = { summary: 'One bounded proposal', proposals: [{ trace_ids: ['abc'], change: 'Change a narrow contract', counterexample: 'Keep the normal case', validation: 'Replay both cases', limitations: 'Two traces only' }] };
const api = { origin: 'https://example.test', async request(path) { return { id: path.split('/').at(-1), input: 'masked evidence', output: 'masked outcome', observations: [] }; } };
async function collect({ out }) {
  await mkdir(out, { recursive: true });
  await writeFile(join(out, `${date}-Asia-Seoul.checkpoint.json`), JSON.stringify({ schema_version: 3, date, rows: {
    a: { id: 'a', trace_id: 'abc', start_time: '1', record_role: 'primary_turn' },
    b: { id: 'b', trace_id: 'def', start_time: '2', record_role: 'primary_turn' },
    c: { id: 'c', trace_id: '000', start_time: '0', record_role: 'tool' },
    d: { id: 'd', trace_id: '001', start_time: '3', record_role: 'subagent_lifecycle' },
    e: { id: 'e', trace_id: '002', start_time: '4', record_role: 'unknown' },
  } }));
  return quality;
}
test('bad or partial quality makes no model call or PR, even when automation is enabled', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'improvement-')); t.after(() => rm(dir, { recursive: true, force: true }));
  for (const [i, altered] of [{ passed: false }, { complete: false }, { project_id: 'other' }, { checkpoint_schema: 2 }, { counts: { non_synthetic_roots: 50, non_synthetic_primary_turn_roots: 0 } }].entries()) {
    const result = await runDaily(config(join(dir, String(i))), date, { createApi: async () => api, collect: async () => ({ ...quality, ...altered }), analyze: () => assert.fail('No model on invalid quality'), publish: () => assert.fail('No PR on invalid quality') });
    assert.equal(result.stage, 'quality_blocked'); assert.equal(result.model_run, false);
  }
});
test('a retained model result resumes without another model call; invented evidence is rejected', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'improvement-')); t.after(() => rm(dir, { recursive: true, force: true }));
  let calls = 0;
  const deps = { createApi: async () => api, collect, analyze: async ({ prompt }) => {
    calls++;
    const sampled = JSON.parse(prompt.slice(prompt.lastIndexOf('\n') + 1));
    assert.equal(sampled.population, 2);
    assert.equal(sampled.sampling_contract, 'primary-turns-v3');
    assert.deepEqual(sampled.traces.map(trace => trace.id), ['abc', 'def']);
    return response;
  }, publish: async ({ candidate }) => { assert.match(candidate, /project\/project1\/traces\/abc/); return 'https://example.test/pr/1'; } };
  const first = await runDaily(config(dir), date, deps), second = await runDaily(config(dir), date, deps);
  assert.equal(first.stage, 'draft_pr_created'); assert.equal(second.candidate_sha256, first.candidate_sha256); assert.equal(calls, 1);
  await assert.rejects(runDaily({ ...config(dir), model: 'another-model' }, date, deps), /another model/);
  assert.throws(() => renderCandidate(response, { traces: [{ id: 'unknown' }] }, date), /unsampled/);
});
test('a failed invocation is retained and cannot silently spend again', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'improvement-')); t.after(() => rm(dir, { recursive: true, force: true }));
  let calls = 0;
  const deps = { createApi: async () => api, collect, analyze: async () => { calls++; throw new Error('simulated interruption'); } };
  await assert.rejects(runDaily(config(dir), date, deps), /simulated interruption/);
  await assert.rejects(runDaily(config(dir), date, deps), /unresolved/);
  assert.equal(calls, 1);
});

test('a retained analysis with the former all-roots sample cannot be promoted or rerun', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'improvement-')); t.after(() => rm(dir, { recursive: true, force: true }));
  await runDaily({ ...config(dir), publishDraftPR: false }, date, { createApi: async () => api, collect, analyze: async () => response });
  const inputFile = join(dir, date, 'input.json'), receiptFile = join(dir, date, 'model-completed.json');
  const input = JSON.parse(await readFile(inputFile)), receipt = JSON.parse(await readFile(receiptFile));
  delete input.sampling_contract;
  input.population = 500;
  receipt.input_sha256 = createHash('sha256').update(JSON.stringify(input)).digest('hex');
  await writeFile(inputFile, JSON.stringify(input)); await writeFile(receiptFile, JSON.stringify(receipt));
  await assert.rejects(runDaily(config(dir), date, {
    createApi: async () => api, collect,
    analyze: () => assert.fail('Never spend again for a retained legacy result'),
    publish: () => assert.fail('Never publish legacy sampling as primary-turn evidence'),
  }), /another sampling contract/);
  assert.deepEqual(JSON.parse(await readFile(inputFile)), input);
});

test('a response file left by a failed invocation cannot be published on the next run', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'improvement-')); t.after(() => rm(dir, { recursive: true, force: true }));
  let calls = 0, publications = 0;
  const deps = { createApi: async () => api, collect,
    analyze: async ({ out }) => {
      calls++;
      await writeFile(join(out, 'response.json'), JSON.stringify(response));
      throw new Error('failed after writing output');
    },
    publish: async () => { publications++; return 'https://example.test/pr/1'; },
  };
  await assert.rejects(runDaily(config(dir), date, deps), /failed after writing output/);
  await assert.rejects(runDaily(config(dir), date, deps), /unresolved/);
  assert.equal(calls, 1); assert.equal(publications, 0);
});
