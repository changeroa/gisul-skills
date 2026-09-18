import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runDaily, renderCandidate } from '../scripts/daily-improvement.mjs';

const date = '2020-01-01';
const config = outputRoot => ({ outputRoot, projectId: 'project1', githubRepo: 'changeroa/gisul-skills', model: 'test-model', reasoning: 'high', maxRunSeconds: 30, maxTraces: 2, maxInputBytes: 10000, enableModelAnalysis: true, publishDraftPR: true });
const quality = { project_id: 'project1', date, timezone: 'Asia/Seoul', source: 'observations-v2-logical-roots', complete: true, full_day: true, passed: true, counts: { non_synthetic_roots: 2 } };
const response = { summary: 'One bounded proposal', proposals: [{ trace_ids: ['abc'], change: 'Change a narrow contract', counterexample: 'Keep the normal case', validation: 'Replay both cases', limitations: 'Two traces only' }] };
const api = { origin: 'https://example.test', async request(path) { return { id: path.split('/').at(-1), input: 'masked evidence', output: 'masked outcome', observations: [] }; } };
async function collect({ out }) {
  await mkdir(out, { recursive: true });
  await writeFile(join(out, `${date}-Asia-Seoul.checkpoint.json`), JSON.stringify({ date, rows: { a: { id: 'a', trace_id: 'abc', start_time: '1' }, b: { id: 'b', trace_id: 'def', start_time: '2' } } }));
  return quality;
}
test('bad or partial quality makes no model call or PR, even when automation is enabled', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'improvement-')); t.after(() => rm(dir, { recursive: true, force: true }));
  for (const [i, altered] of [{ passed: false }, { complete: false }, { project_id: 'other' }, { counts: { non_synthetic_roots: 0 } }].entries()) {
    const result = await runDaily(config(join(dir, String(i))), date, { createApi: async () => api, collect: async () => ({ ...quality, ...altered }), analyze: () => assert.fail('No model on invalid quality'), publish: () => assert.fail('No PR on invalid quality') });
    assert.equal(result.stage, 'quality_blocked'); assert.equal(result.model_run, false);
  }
});
test('a retained model result resumes without another model call; invented evidence is rejected', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'improvement-')); t.after(() => rm(dir, { recursive: true, force: true }));
  let calls = 0;
  const deps = { createApi: async () => api, collect, analyze: async () => { calls++; return response; }, publish: async ({ candidate }) => { assert.match(candidate, /project\/project1\/traces\/abc/); return 'https://example.test/pr/1'; } };
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
