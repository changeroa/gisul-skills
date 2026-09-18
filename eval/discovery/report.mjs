import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { cost } from './run.mjs';
import { remoteCalls } from './evidence.mjs';

const phaseRoot = resolve(process.argv[2]);
const [protocol, phase] = await Promise.all(['protocol.json', 'phase.json'].map(name => readFile(join(phaseRoot, name), 'utf8').then(JSON.parse)));
const ratings = await readFile(join(phaseRoot, 'grading/ratings.json'), 'utf8').then(JSON.parse).catch(() => []);
const results = (await Promise.all(phase.runs.map(slot => readFile(join(phaseRoot, 'runs', slot.id, 'result.json'), 'utf8').then(JSON.parse).catch(() => null)))).filter(Boolean);
const mean = values => values.length ? values.reduce((a,b) => a+b, 0)/values.length : null;
const median = values => values.length ? [...values].sort((a,b)=>a-b)[Math.floor(values.length/2)] : null;
const arms = [...new Set(protocol.schedule.map(slot => slot.variant))];
const summaries = arms.map(variant => {
  const runs = results.filter(result => result.variant === variant);
  const grade = ratings.filter(rating => rating.variant === variant);
  return {
    variant, scheduled: phase.runs.filter(slot => slot.variant === variant).length,
    completed: runs.filter(run => run.status === 'completed').length,
    failed: runs.filter(run => run.status !== 'completed').length,
    graded: grade.filter(rating => rating.semantic).length,
    passes: grade.filter(rating => rating.pass === true).length,
    critical: grade.filter(rating => rating.critical).length,
    searches: runs.reduce((sum,run) => sum + remoteCalls(run.turns).filter(call => call.tool === 'search_skills').length, 0),
    loads: runs.reduce((sum,run) => sum + remoteCalls(run.turns).filter(call => call.tool === 'load_skill').length, 0),
    tokens: runs.reduce((sum,run) => sum + (run.usage?.totalTokens ?? 0), 0),
    meanCost: mean(runs.filter(run => run.usage).map(run => cost(run.usage))),
    normalizedMeanCost: mean(runs.filter(run => run.usage).map(run => cost(run.usage,true))),
    medianElapsedSeconds: median(runs.map(run => run.elapsedMs/1000)),
    meanElapsedSeconds: mean(runs.map(run => run.elapsedMs/1000)),
    genuineHumanRatings: grade.filter(rating => rating.humanRating !== null && rating.humanRating !== undefined).length,
  };
});
const baseline = summaries.find(item => item.variant === 'baseline');
for (const summary of summaries) {
  summary.costRatio = baseline ? summary.meanCost/baseline.meanCost : null;
  summary.normalizedCostRatio = baseline ? summary.normalizedMeanCost/baseline.normalizedMeanCost : null;
}
const evidence = {
  protocol, phase, summaries,
  ratings,
  runs: results.map(result => ({ id: result.id, caseId: result.caseId, variant: result.variant, repeat: result.repeat,
    status: result.status, failure: result.failure, expectedCommit: result.expectedCommit, loaderHash: result.loaderHash,
    runtimeHash: result.runtimeHash, scenarioHash: result.scenarioHash, usage: result.usage, firstUsage: result.firstUsage,
    elapsedMs: result.elapsedMs, provenance: result.provenance, boundaryPassed: result.boundary?.every(check => check.passed),
    remoteCalls: remoteCalls(result.turns).map(call => ({ tool: call.tool, arguments: call.arguments, status: call.status, error: call.error })),
  })),
};
const target = resolve(process.argv[3] ?? join(phaseRoot, 'summary.json'));
await mkdir(resolve(target, '..'), { recursive: true });
await writeFile(target, JSON.stringify(evidence, null, 2) + '\n', { mode: 0o600 });
console.log(JSON.stringify(summaries, null, 2));
