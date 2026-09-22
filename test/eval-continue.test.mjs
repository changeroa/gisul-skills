import test from 'node:test';
import assert from 'node:assert/strict';
import {continuationSlots} from '../eval/continue.mjs';
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
