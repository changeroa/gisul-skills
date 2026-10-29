import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { cost } from './run.mjs';
import { remoteCalls } from './evidence.mjs';

const options = Object.fromEntries(process.argv.slice(2).map(arg => { const [key,...rest]=arg.replace(/^--/,'').split('='); return [key,rest.join('=')]; }));
const roots = options.phases.split(',').map(path => resolve(path));
const evidence = { version: 1, generatedAt: new Date().toISOString(), phases: [], attempts: [], ratings: [], summaries: [] };
const selected = new Map();
for (const root of roots) {
  const protocol = JSON.parse(await readFile(join(root,'protocol.json')));
  const ledger = JSON.parse(await readFile(join(root,'phase.json')));
  const grades = await readFile(join(root,'grading/ratings.json')).then(JSON.parse).catch(()=>[]);
  const previous = evidence.phases[0]?.protocol;
  if (previous) for (const key of ['model','effort','runtimeHash','expectedCommit','variantsHash']) assert.equal(protocol[key],previous[key],'Incompatible phase '+key);
  evidence.phases.push({ root, protocol, ledger });
  const completed = [];
  for (const slot of ledger.runs) {
    const run = await readFile(join(root,'runs',slot.id,'result.json')).then(JSON.parse).catch(()=>null);
    if (!run) continue;
    const rating = grades.find(rating=>rating.id===run.id) ?? null;
    evidence.attempts.push({ phase: root, id:run.id,caseId:run.caseId,variant:run.variant,repeat:run.repeat,status:run.status,failure:run.failure,usage:run.usage,usagePartial:run.usagePartial??false,missingUsage:run.missingUsage??false,elapsedMs:run.elapsedMs,firstUsage:run.firstUsage,provenance:run.provenance,boundaryPassed:run.boundary?.every(check=>check.passed),expectedCommit:run.expectedCommit,loaderHash:run.loaderHash,scenarioHash:run.scenarioHash,estimatedCost:cost(run.usage),normalizedCost:cost(run.usage,true),remoteCalls:remoteCalls(run.turns).map(call=>({tool:call.tool,arguments:call.arguments,status:call.status,error:call.error})),rating });
    if(run.status==='completed')completed.push(run);
  }
  const arms=[...new Set(protocol.schedule.map(slot=>slot.variant))].sort();
  for(const key of new Set(completed.map(run=>run.caseId+'/'+run.repeat))){
    const block=completed.filter(run=>run.caseId+'/'+run.repeat===key);
    if(JSON.stringify(block.map(run=>run.variant).sort())===JSON.stringify(arms))selected.set(key,block.map(run=>run.id));
  }
}
const selectedIds=new Set([...selected.values()].flat());
for(const attempt of evidence.attempts)attempt.selectedForComparison=selectedIds.has(attempt.id);
const compare=evidence.attempts.filter(run=>run.selectedForComparison);
const mean=x=>x.length?x.reduce((a,b)=>a+b,0)/x.length:null;
const median=x=>{const y=[...x].sort((a,b)=>a-b),m=Math.floor(y.length/2);return y.length?(y.length%2?y[m]:(y[m-1]+y[m])/2):null;};
for(const variant of [...new Set(compare.map(run=>run.variant))].sort()){
  const runs=compare.filter(run=>run.variant===variant);
  const rating=runs.map(run=>run.rating).filter(Boolean);
  evidence.summaries.push({variant,runs:runs.length,graded:rating.filter(r=>r.semantic).length,passes:rating.filter(r=>r.pass===true).length,critical:rating.filter(r=>r.critical).length,mechanismPasses:rating.filter(r=>r.mechanismPass).length,searches:runs.reduce((n,r)=>n+r.remoteCalls.filter(c=>c.tool==='search_skills').length,0),loads:runs.reduce((n,r)=>n+r.remoteCalls.filter(c=>c.tool==='load_skill').length,0),meanCost:mean(runs.map(r=>r.estimatedCost)),normalizedMeanCost:mean(runs.map(r=>r.normalizedCost)),meanSeconds:mean(runs.map(r=>r.elapsedMs/1000)),medianSeconds:median(runs.map(r=>r.elapsedMs/1000)),tokens:runs.reduce((n,r)=>n+(r.usage?.totalTokens??0),0),humanRatings:rating.filter(r=>r.humanRating!==null&&r.humanRating!==undefined).length});
}
const baseline=evidence.summaries.find(s=>s.variant==='baseline');
for(const s of evidence.summaries){s.costRatio=s.meanCost/baseline.meanCost;s.normalizedCostRatio=s.normalizedMeanCost/baseline.normalizedMeanCost;}
evidence.budget={attempts:evidence.attempts.length,selected:compare.length,tokensLowerBound:evidence.attempts.reduce((n,r)=>n+(r.usage?.totalTokens??0),0),standardPriceEquivalentLowerBound:evidence.attempts.reduce((n,r)=>n+(r.estimatedCost??0),0),hasPartialUsage:evidence.attempts.some(r=>r.usagePartial||r.missingUsage)};
evidence.budget.scheduledSlots=evidence.phases.reduce((sum,phase)=>sum+phase.ledger.runs.length,0);
evidence.budget.notRunSlots=evidence.phases.reduce((sum,phase)=>sum+phase.ledger.runs.filter(slot=>slot.status==='not_run').length,0);
evidence.budget.missingResultSlots=evidence.phases.flatMap(phase=>phase.ledger.runs.filter(slot=>!evidence.attempts.some(attempt=>attempt.id===slot.id)).map(slot=>({id:slot.id,caseId:slot.caseId,variant:slot.variant,status:slot.status})));
evidence.promotion={approved:false,reason:'This is development direction-finding. Holdout gate and ten genuine human ratings are not satisfied; incomplete or critical runs and cost regressions also block promotion.'};
const out=resolve(options.out??join(roots.at(-1),'combined.json'));
await mkdir(dirname(out),{recursive:true});
await writeFile(out,JSON.stringify(evidence,null,2)+'\n',{mode:0o600});
console.log(JSON.stringify({summaries:evidence.summaries,budget:evidence.budget},null,2));
