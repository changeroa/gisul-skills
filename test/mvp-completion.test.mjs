import test from 'node:test';
import assert from 'node:assert/strict';
import { TARGET, childrenComplete, completeIssue, digest, fingerprint, hookEvidence, qualityEvidence, sleepEvidence } from '../scripts/mvp-completion.mjs';
import { windowFor } from '../scripts/langfuse-quality.mjs';

const config = { langfuseProject: 'project', langfuseOrigin: 'https://example.com', date: '2026-09-17', notBefore: '2026-09-18T00:10:00Z' };
const good = () => ({ project_id: 'project', origin: config.langfuseOrigin, date: config.date, timezone: 'Asia/Seoul', source: 'observations-v2-logical-roots', window: windowFor(config.date, 'Asia/Seoul'), complete: true, full_day: true, generated_at: config.notBefore, passed: false, gates: { e14_codex_duplicate_free: { checkpoint_schema: 2, passed: true, roots: 10, identified_turns: 10, unknown_turn_identity: 0, duplicate_turn_traces: 0, unfinished_codex: 0, unattributed_roots: 0, repeated_identity_rows: 0 } } });
test('E14 accepts only a complete nonempty explicit Codex day, separately from overall quality', () => {
  assert.match(qualityEvidence(good(), config, Date.parse('2026-09-18T01:00:00Z')), /root 10개/);
  for (const change of [r => r.complete = false, r => r.full_day = false, r => r.project_id = 'wrong', r => r.generated_at = '2026-09-17T00:00:00Z', r => r.window.to = '2026-09-18T15:00:00Z', r => r.gates.e14_codex_duplicate_free.roots = 0, r => r.gates.e14_codex_duplicate_free.checkpoint_schema = 1, ...['unknown_turn_identity', 'duplicate_turn_traces', 'unfinished_codex', 'unattributed_roots', 'repeated_identity_rows'].map(key => r => r.gates.e14_codex_duplicate_free[key] = 1)]) {
    const report = good(); change(report); assert.throws(() => qualityEvidence(report, config, Date.parse('2026-09-18T01:00:00Z')));
  }
});
function issue(id = TARGET.quality) { return { id, title: '[E-14] test', description: 'Outcome\n\n- [ ] criterion', projectId: TARGET.project, teamId: TARGET.team, projectMilestone: { id: TARGET.milestone }, parentId: TARGET.parent, status: '검증·배포 대기', statusType: 'started', relations: { blockedBy: [{ id: 'IYEN-34' }] }, url: `https://linear.app/iyen/issue/${id}` }; }
function client({ failWrite = false, applyWrite = true } = {}) {
  const current = issue(); const events = []; let writes = 0;
  return { current, events, get writes() { return writes; }, async call(tool, args) {
    events.push(tool);
    if (tool === 'get_issue') return args.id === 'IYEN-34' ? { projectId: TARGET.project, statusType: 'completed' } : structuredClone(current);
    if (tool === 'list_comments') return { comments: [], hasNextPage: false };
    if (tool === 'save_issue') { writes++; if (applyWrite) Object.assign(current, { statusType: 'completed', status: '완료', description: args.description }); if (failWrite) throw new Error('timeout'); return {}; }
    throw new Error(tool);
  } };
}
const args = api => ({ api, id: TARGET.quality, guard: { fingerprint: fingerprint(issue()), commentsHash: digest([]) }, evidence: 'Measured evidence', marker: 'receipt-test', transform: text => text.replace('[ ]', '[X]'), persist: async () => {} });
test('lost write response is reconciled by readback with exactly one mutation', async () => {
  const api = client({ failWrite: true }); const receipts = [];
  const result = await completeIssue({ ...args(api), persist: async receipt => receipts.push(receipt) });
  assert.equal(result.confirmed, true); assert.equal(api.writes, 1); assert.ok(receipts[0].intent);
  assert.deepEqual(api.events.slice(-2), ['get_issue', 'list_comments']);
});
test('ambiguous unapplied write stays pending and is not blindly retried', async () => {
  const api = client({ failWrite: true, applyWrite: false }); let receipt;
  await assert.rejects(completeIssue({ ...args(api), persist: async value => receipt = value }));
  await assert.rejects(completeIssue({ ...args(api), receipt }), /Unconfirmed previous write/);
  assert.equal(api.writes, 1);
});
test('changed description, comments, project and unresolved dependencies prevent writes', async () => {
  for (const change of [a => a.current.description += '\nNew requirement', a => a.current.projectId = 'other', a => a.current.relations.blockedBy.push({ id: 'IYEN-99' })]) {
    const api = client(); change(api); await assert.rejects(completeIssue(args(api))); assert.equal(api.writes, 0);
  }
  const api = client(), call = api.call.bind(api);
  api.call = (tool, params) => tool === 'list_comments' ? { comments: [{ body: 'Do not close yet' }], hasNextPage: false } : call(tool, params);
  await assert.rejects(completeIssue(args(api)), /comments/); assert.equal(api.writes, 0);
  const blocked = client(), original = blocked.call.bind(blocked);
  blocked.call = (tool, params) => tool === 'get_issue' && params.id === 'IYEN-34' ? { projectId: TARGET.project, statusType: 'started' } : original(tool, params);
  await assert.rejects(completeIssue(args(blocked)), /Dependency/); assert.equal(blocked.writes, 0);
});
test('parent completion requires all and only the 14 actual completed children', () => {
  const children = Array.from({ length: 14 }, (_, n) => ({ ...issue(`IYEN-${23 + n}`), statusType: 'completed' }));
  childrenComplete(children); assert.throws(() => childrenComplete(children.slice(1)));
  children[0].statusType = 'canceled'; assert.throws(() => childrenComplete(children));
  children[0].statusType = 'completed'; children[0].projectId = 'other'; assert.throws(() => childrenComplete(children));
});
test('sleep evidence requires real Sleep/full Wake corroboration and both connection probes', () => {
  const sleep = { type: 'Sleep', time: '2026-09-17T04:01:00Z', line: '2026-09-17 13:01:00 +0900 Sleep Entering Sleep state due to Software Sleep' };
  const wake = { type: 'Wake', time: '2026-09-17T04:02:00Z', line: '2026-09-17 13:02:00 +0900 Wake Wake from Normal Sleep' };
  const events = ['search_skills', 'load_skill'].map(tool => ({ event: 'call', phase: 'before', tool, ok: true }));
  events.push({ event: 'armed', plugin: '/plugin', ts: '2026-09-17T04:00:00Z' }, { event: 'sleep-wake-observed', sleep, wake });
  for (const phase of ['after-existing', 'after-fresh']) for (const tool of ['search_skills', 'load_skill']) events.push({ event: 'call', phase, tool, ok: phase === 'after-fresh' });
  events.push({ event: 'finished', scenario_executed: true });
  const serialize = () => events.map(event => JSON.stringify(event)).join('\n'), power = sleep.line + '\n' + wake.line;
  assert.match(sleepEvidence(serialize(), power, '/plugin'), /after-existing\/search_skills: 실패/);
  assert.throws(() => sleepEvidence(serialize(), '', '/plugin'));
  events[3].event = 'observation-timeout'; assert.throws(() => sleepEvidence(serialize(), power, '/plugin'));
});
test('multiple or changed Stop hooks block acceptance', () => {
  const settings = { hookCwds: ['/repo'], hookCommand: 'node hook', hookHash: 'sha256:expected' };
  const hook = { enabled: true, eventName: 'stop', pluginId: 'langfuse-masked@personal', trustStatus: 'trusted', command: settings.hookCommand, currentHash: settings.hookHash };
  const result = { data: [{ cwd: '/repo', errors: [], warnings: [], hooks: [hook] }] };
  hookEvidence(result, settings); result.data[0].hooks.push({ ...hook, pluginId: 'legacy' }); assert.throws(() => hookEvidence(result, settings));
});
