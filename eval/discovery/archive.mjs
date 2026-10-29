import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { blindedCompletion } from './grade.mjs';
import { sha256 } from './environment.mjs';

// Durable evidence contains task answers/actions, not private reasoning events.
const aggregate = JSON.parse(await readFile(resolve(process.argv[2])));
const out = resolve(process.argv[3]);
await mkdir(join(out, 'frozen-harness'), { recursive: true });
const completions = [], grading = [];
for (const phase of aggregate.phases) {
  for (const [name, digest] of Object.entries(phase.protocol.harnessFiles)) {
    const bytes = await readFile(join(phase.root, 'harness', name));
    assert.equal(sha256(bytes), digest, 'Frozen source changed: ' + name);
    await writeFile(join(out, 'frozen-harness', digest + '.mjs'), bytes);
  }
  const ratings = JSON.parse(await readFile(join(phase.root, 'grading/ratings.json')));
  assert.deepEqual(ratings.map(row => row.id).sort(), phase.ledger.runs.map(slot => slot.id).sort());
  const judges = [];
  for (const caseId of new Set(ratings.filter(row => row.semantic).map(row => row.caseId))) {
    judges.push({ caseId, ...JSON.parse(await readFile(join(phase.root, 'grading', caseId + '.judge.json'))) });
  }
  grading.push({ protocolHash: phase.protocol.hash, ratings, judges });
}
for (const attempt of aggregate.attempts.filter(run => run.selectedForComparison)) {
  const bytes = await readFile(join(attempt.phase, 'runs', attempt.id, 'result.json'));
  const result = JSON.parse(bytes);
  completions.push({ resultHash: sha256(bytes), caseId: result.caseId, variant: result.variant,
    repeat: result.repeat, completion: blindedCompletion(result) });
}
await writeFile(join(out, 'completions.json'), JSON.stringify(completions, null, 2) + '\n');
await writeFile(join(out, 'grading.json'), JSON.stringify(grading, null, 2) + '\n');
console.log(JSON.stringify({ completions: completions.length, scheduledRatingRows: grading.reduce((sum, phase) => sum + phase.ratings.length, 0), out }));
