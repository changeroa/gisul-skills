import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { finalTexts } from './grade.mjs';
import { remoteCalls } from './evidence.mjs';
import { sha256 } from './environment.mjs';

// Summarize observed startup/routing behavior without inventing semantic ratings.
const root = resolve(process.argv[2]);
const protocol = JSON.parse(await readFile(join(root, 'protocol.json')));
const ledger = JSON.parse(await readFile(join(root, 'phase.json')));
assert.ok(ledger.runs.every(slot => slot.status === 'completed'), 'Diagnostic phase is incomplete');
const runs = [];
for (const slot of ledger.runs) {
  const bytes = await readFile(join(root, 'runs', slot.id, 'result.json'));
  const result = JSON.parse(bytes);
  assert.equal(result.status, 'completed');
  for (const key of ['model', 'effort', 'runtimeHash', 'expectedCommit']) assert.equal(result[key], protocol[key]);
  const calls = remoteCalls(result.turns);
  runs.push({
    id: result.id, caseId: result.caseId, variant: result.variant, repeat: result.repeat,
    resultHash: sha256(bytes), loaderHash: result.loaderHash, policyHash: result.policyHash,
    nativeSkills: result.nativeSkills, firstInputTokens: result.firstUsage.inputTokens,
    usage: result.usage, elapsedMs: result.elapsedMs, estimatedCost: result.estimatedCost,
    boundaryPassed: result.boundary.every(check => check.passed), provenance: result.provenance,
    exact391: result.caseId === 'N02' ? finalTexts(result).at(-1)?.trim() === '391' : null,
    remoteCalls: calls.map(({ tool, arguments: args, status }) => ({ tool, arguments: args, status })),
    instructionReads: result.turns.flatMap(turn => turn.items)
      .filter(item => item.type === 'commandExecution' && item.exitCode === 0 && /SKILL\.md/.test(item.command))
      .map(item => ({ command: item.command, exitCode: item.exitCode })),
  });
}
const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length;
const summaries = [...new Set(runs.map(run => run.variant))].map(variant => {
  const selected = runs.filter(run => run.variant === variant);
  const tokens = selected.map(run => run.firstInputTokens);
  const average = mean(tokens);
  return { variant, runs: selected.length, firstInputTokens: tokens, meanFirstInputTokens: average,
    minFirstInputTokens: Math.min(...tokens), maxFirstInputTokens: Math.max(...tokens),
    sampleStandardDeviation: tokens.length > 1 ? Math.sqrt(tokens.reduce((sum, value) => sum + (value - average) ** 2, 0) / (tokens.length - 1)) : null,
    remoteCalls: selected.reduce((sum, run) => sum + run.remoteCalls.length, 0),
    exact391Passes: selected.filter(run => run.exact391 === true).length,
  };
});
const baseline = summaries.find(summary => summary.variant === 'baseline');
for (const summary of summaries) summary.firstInputDifferenceFromBaseline = summary.meanFirstInputTokens - baseline.meanFirstInputTokens;
const evidence = { generatedAt: new Date().toISOString(), protocol, ledger, runs, summaries,
  semanticRatings: null, humanRatings: 0,
  limitation: 'Isolated diagnostic, not the complete installed native catalog or global production startup. Routing observations do not establish semantic quality.' };
const target = resolve(process.argv[3] ?? join(root, 'diagnostics.json'));
await mkdir(dirname(target), { recursive: true });
await writeFile(target, JSON.stringify(evidence, null, 2) + '\n', { mode: 0o600 });
console.log(JSON.stringify(summaries, null, 2));
