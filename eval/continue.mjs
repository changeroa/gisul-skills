import assert from 'node:assert/strict';
import { readFile, writeFile, rm } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { requireCanary } from './canary-proof.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
export function continuationSlots(protocol, phase) {
  assert.equal(phase.protocolHash, protocol.hash, 'Protocol mismatch');
  assert.equal(phase.stopped, 'observed_token_limit', 'Only a reviewed token stop can continue');
  assert.ok(!phase.continuation, 'Only one bounded continuation is supported');
  assert.ok(phase.runs.every(x => ['completed','failed','not_run'].includes(x.status)), 'Initial phase has not settled');
  assert.deepEqual(phase.runs.map(x => [x.id,x.caseId]), protocol.schedule.map(x => [x.id,x.caseId]), 'Schedule changed');
  const pending = phase.runs.filter(x => x.status === 'not_run');
  assert.ok(pending.length, 'There are no unexecuted cases');
  return pending.map(x => protocol.schedule.find(y => y.id === x.id));
}

export async function continueRun(root, { maxTokens = 600000 } = {}) {
  assert.ok(Number.isInteger(maxTokens) && maxTokens > 0 && maxTokens <= 600000, 'Continuation is bounded to at most 600000 observed tokens');
  const protocol = JSON.parse(await readFile(join(root,'protocol.json')));
  const {hash:expected,...body} = protocol;
  assert.equal(hash(JSON.stringify(body)),expected,'Protocol changed');
  const phaseBytes = await readFile(join(root,'phase.json')), summaryBytes = await readFile(join(root,'summary.json'));
  const phase = JSON.parse(phaseBytes), firstSummary = JSON.parse(summaryBytes);
  assert.equal(firstSummary.protocolHash,protocol.hash);
  const schedule = continuationSlots(protocol,phase);
  const canary = await requireCanary(protocol.canary?.path, protocol.reader);
  assert.equal(canary.receiptHash, protocol.canary.receiptHash, 'Original capability canary changed');
  for (const [path,expected] of Object.entries(protocol.fileHashes)) assert.equal(hash(await readFile(path)),expected,'Original execution source changed: '+path);
  const runner = Object.keys(protocol.fileHashes).find(x => x.endsWith('/eval/run.mjs'));
  assert.ok(runner,'Original runner is not pinned');
  const {runCase,saveJson,stopReason} = await import(pathToFileURL(runner).href);
  const selection = JSON.parse(await readFile(join(root,'cases.private.json')));
  const controllerHash = hash(await readFile(fileURLToPath(import.meta.url)));
  const extension = { schema:1, createdAt:new Date().toISOString(), originalProtocolHash:protocol.hash, reason:'Reviewed initial execution cost; finish only previously unexecuted cases without retrying any outcome.', maxTokens, concurrency:protocol.concurrency, timeoutMs:protocol.timeoutMs, controllerHash, schedule };
  extension.hash = hash(JSON.stringify(extension));
  // Exclusive creation is also the continuation lock. A second controller must
  // never race the first or reinterpret a partially completed continuation.
  await writeFile(join(root,'continuation-protocol.json'),JSON.stringify(extension,null,2)+'\n',{flag:'wx',mode:0o600});
  await writeFile(join(root,'phase.initial.json'),phaseBytes,{flag:'wx',mode:0o600});
  await writeFile(join(root,'summary.initial.json'),summaryBytes,{flag:'wx',mode:0o600});
  const original = [];
  for (const slot of phase.runs.filter(x => x.status !== 'not_run')) {
    const bytes = await readFile(join(root,'runs',slot.id,'result.json'));
    assert.equal(hash(bytes),slot.resultHash,'Prior result changed');
    original.push(JSON.parse(bytes));
  }
  phase.continuation = { hash:extension.hash, maxTokens, initialStopReason:phase.stopped };
  phase.stopped = null;
  const fresh=[]; let cursor=0, writes=Promise.resolve();
  const update=()=>{writes=writes.then(()=>saveJson(join(root,'phase.json'),{...phase,tokens:[...original,...fresh].reduce((n,x)=>n+(x.usage?.totalTokens??0),0)}));return writes;};
  const interrupt=()=>{phase.stopped='interrupted';};
  process.on('SIGINT',interrupt);process.on('SIGTERM',interrupt);
  const heartbeat=setInterval(()=>console.log(JSON.stringify({event:'continuation_heartbeat',completed:fresh.length,scheduled:schedule.length})),30000);
  try {
    await Promise.all(Array.from({length:protocol.concurrency},async()=>{
      while(cursor<schedule.length && !phase.stopped) {
        const slot=schedule[cursor++], entry=phase.runs.find(x=>x.id===slot.id);
        entry.status='running';await update();
        console.log(JSON.stringify({event:'started',caseId:slot.caseId,continuation:extension.hash}));
        const result=await runCase({item:selection.find(x=>x.id===slot.caseId),slot,protocol,root});
        fresh.push(result);entry.status=result.status;entry.failure=result.failure;
        entry.resultHash=hash(await readFile(join(root,'runs',slot.id,'result.json')));
        phase.stopped??=stopReason(fresh,maxTokens);
        await update();
        console.log(JSON.stringify({event:'finished',caseId:slot.caseId,status:result.status,failure:result.failure,tokens:result.usage?.totalTokens}));
      }
    }));
  } finally {clearInterval(heartbeat);process.off('SIGINT',interrupt);process.off('SIGTERM',interrupt);}
  await update();
  const all=[...original,...fresh];
  const summary={...firstSummary,completed:all.filter(x=>x.status==='completed').length,failed:all.filter(x=>x.status==='failed').length,stopped:phase.stopped,
    tokens:all.reduce((n,x)=>n+(x.usage?.totalTokens??0),0),estimatedCost:all.reduce((n,x)=>n+(x.estimatedCost??0),0),missingUsage:all.filter(x=>!x.usage).length,
    grading:Object.fromEntries(['pass','fail','unverified'].map(s=>[s,all.filter(x=>x.grading?.status===s).length])),
    continuation:{...phase.continuation,executed:fresh.length,tokens:fresh.reduce((n,x)=>n+(x.usage?.totalTokens??0),0)}};
  await saveJson(join(root,'summary.json'),summary);
  await rm(dirname(schedule[0].workspace),{recursive:true,force:true});
  console.log(JSON.stringify({event:'continuation_finished',...summary}));
  return summary;
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const {values}=(await import('node:util')).parseArgs({options:{run:{type:'string'}}});
  if(!values.run)throw new Error('Usage: node eval/continue.mjs --run DIR (after reviewing the retained initial cost)');
  const result=await continueRun(resolve(values.run));
  if(result.stopped)process.exitCode=1;
}
