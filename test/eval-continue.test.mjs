import test from 'node:test';
import assert from 'node:assert/strict';
import {continuationSlots,continuationStopReason} from '../eval/continue.mjs';
const schedule=[{id:'a',caseId:'F-01'},{id:'b',caseId:'L-01'},{id:'c',caseId:'N-01'}];
const protocol={hash:'frozen',schedule};
const phase={protocolHash:'frozen',stopped:'observed_token_limit',runs:schedule.map((x,i)=>({...x,status:['completed','failed','not_run'][i]}))};
test('continuation selects only unexecuted cases, never successful or failed attempts',()=>{
  assert.deepEqual(continuationSlots(protocol,phase),[schedule[2]]);
  assert.equal(phase.runs[1].status,'failed');
});
test('live, changed, repeated and non-budget phases cannot continue',()=>{
  for(const invalid of [{...phase,stopped:'isolation_failure'},{...phase,continuation:{}},{...phase,protocolHash:'changed'},{...phase,runs:phase.runs.map(x=>({...x,status:'running'}))},{...phase,runs:phase.runs.slice().reverse()}])assert.throws(()=>continuationSlots(protocol,invalid));
});
test('continuation preserves cumulative failures while resetting only its token allowance',()=>{
  const completed={status:'completed',usage:{totalTokens:2000}};
  const infrastructure={failure:{type:'infrastructure'}};
  assert.equal(continuationStopReason([completed],[{status:'completed',usage:{totalTokens:1}}],10),null);
  assert.equal(continuationStopReason([infrastructure],[infrastructure],10),'two_infrastructure_failures');
  assert.equal(continuationStopReason([{failure:{type:'isolation'}}],[],10),'isolation_failure');
  assert.equal(continuationStopReason([{failure:{type:'storage'}}],[],10),'storage_failure');
  assert.equal(continuationStopReason([completed],[{usage:{totalTokens:10}}],10),'observed_token_limit');
});
