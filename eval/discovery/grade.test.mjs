import test from 'node:test';
import assert from 'node:assert/strict';
import { objectiveChecks, blindedCompletion, ungradedSlot } from './grade.mjs';
const usage = { inputTokens: 10, outputTokens: 1, totalTokens: 11 };
const make = files => ({ id: 'opaque', status: 'completed', usage, workspace: '/private/work', files, turns: [{ items: [{ type: 'agentMessage', phase: 'final_answer', text: '완료 /private/work/a.js' }] }] });
test('case-sensitive duplicate behavior is checked independently of implementation shape', () => {
  const scenario = { prompts: ['fix'], check: 'duplicates' };
  assert.equal(objectiveChecks(scenario, make({ 'duplicates.mjs': 'export function duplicates(ids) { return ids.length - new Set(ids).size; }' })).objectivePass, true);
  assert.equal(objectiveChecks(scenario, make({ 'duplicates.mjs': 'export function duplicates(ids) { return ids.length - new Set(ids.map(x=>x.toLowerCase())).size; }' })).objectivePass, false);
  assert.equal(objectiveChecks(scenario, make({ 'duplicates.mjs': 'export function duplicates(ids) { return ids.length ? 1 : 0; }' })).objectivePass, false);
});
test('judge input omits arm, expected names, costs and loader reads', () => {
  const result = { ...make({ 'a.js': 'ok' }), variant: 'selective', expectedSkills: ['secret-label'], estimatedCost: 1.2 };
  result.turns[0].items.push({ type: 'commandExecution', command: 'cat .agents/skills/gisul/SKILL.md', commandActions: [{ type: 'read', path: '/private/work/.agents/skills/gisul/SKILL.md' }], aggregatedOutput: 'candidate-body' });
  const text = JSON.stringify(blindedCompletion(result));
  for (const forbidden of ['selective','secret-label','estimatedCost','candidate-body','/private/work']) assert.ok(!text.includes(forbidden));
});
test('explicit remote refusal and follow-up reuse are observable requirements', () => {
  const result = make({});
  result.turns[0].items.push({ type: 'mcpToolCall', server: 'gisul', tool: 'search_skills', status: 'completed' });
  assert.equal(objectiveChecks({ family: 'explicit-no-remote', prompts: ['no remote'], maxSearches: 0 }, result).objectivePass, false);
  const ordinary = objectiveChecks({ family: 'general-question', prompts: ['question'], maxSearches: 0 }, result);
  assert.equal(ordinary.objectivePass, true);
  assert.equal(ordinary.mechanismPass, false);
});
test('mixed skill-read and task-test commands retain their task evidence', () => {
  const result = make({});
  result.turns[0].items.push({ type: 'commandExecution', command: 'cat SKILL.md; cat page.html; node test.mjs', exitCode: 0, commandActions: [{ type: 'unknown' }], aggregatedOutput: 'description: secret treatment\n<h1>Task source</h1>\nTests: 3 passed\n' });
  const action = blindedCompletion(result).actions[0];
  assert.match(action.command, /node test.mjs/);
  assert.match(action.output, /Tests: 3 passed/);
  assert.match(action.output, /Task source/);
  assert.ok(!action.output.includes('secret treatment'));
});
test('missing, interrupted and isolation-failed slots remain explicitly ungraded', () => {
  for (const status of ['not_run', 'interrupted', 'failed']) {
    const slot = { id: status, caseId: 'D01', variant: 'baseline', repeat: 0, status };
    const receipt = status === 'not_run' ? null : { status, failure: { type: status === 'failed' ? 'isolation_violation' : 'controller_interrupted' } };
    const row = ungradedSlot(slot, receipt, 'execution_not_gradable');
    assert.equal(row.id, slot.id);
    assert.equal(row.runStatus, status);
    assert.equal(row.pass, null);
    assert.equal(row.semantic, null);
    assert.equal(row.promotionEligible, false);
    assert.equal(row.resultPresent, status !== 'not_run');
    assert.deepEqual(row.failure, receipt?.failure ?? null);
  }
});
