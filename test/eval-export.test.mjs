import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { experimentSpan, exportRun, verifyItem } from '../eval/export.mjs';

const protocol = { id: 'frozen-run', hash: 'frozen-protocol', dataset: { version: 'dataset-hash' }, model: 'fixed-model', effort: 'max', profile: 'baseline', reader: { release: '20260922.26', commit: 'a'.repeat(40), bundleHash: 'reader-hash' }, prices: { kind: 'standard_api_equivalent_not_account_bill' } };
const item = { id: 'F-01', input: { prompt: 'Read the API contract' }, expected: { must_read: ['api.js'] }, split: 'development', critical: true };
const result = { threadId: 'native-thread', turnId: 'native-turn', gisulEvents: [{ event: 'load_skill', commit: 'a'.repeat(40), manifest_digest: 'digest' }], startedAt: '2026-09-22T01:00:00.000Z', endedAt: '2026-09-22T01:01:00.000Z', status: 'completed', finalText: 'actual output', files: {}, grading: { status: 'unverified' }, usage: { totalTokens: 10 }, estimatedCost: 0.01 };
test('export identity survives retries and binds actual output, dataset item, synthetic scope and release', () => {
  const span = experimentSpan(protocol,item,result,'dataset-id');
  assert.equal(span.traceId.length,32); assert.equal(span.spanId.length,16);
  assert.deepEqual(experimentSpan(protocol,item,result,'dataset-id'),span);
  const attributes = Object.fromEntries(span.attributes.map(x => [x.key,x.value]));
  assert.equal(attributes['langfuse.experiment.item.root_observation_id'].stringValue,span.spanId);
  assert.equal(attributes['langfuse.experiment.item.id'].stringValue,'agent-env-v1:F-01');
  assert.equal(attributes['langfuse.environment'].stringValue,'evaluation');
  assert.ok(attributes['langfuse.trace.tags'].arrayValue.values.some(x => x.stringValue === 'synthetic'));
  assert.equal(JSON.parse(attributes['langfuse.observation.output'].stringValue).finalText,'actual output');
  assert.equal(JSON.parse(attributes['langfuse.observation.metadata'].stringValue).gisul.commit,'a'.repeat(40));
  assert.notEqual(experimentSpan({...protocol,id:'another-run'},item,result,'dataset-id').traceId,span.traceId);
  assert.notEqual(experimentSpan(protocol,{...item,id:'F-02'},result,'dataset-id').traceId,span.traceId);
});
test('no-model preflight cannot be uploaded as an experiment', async () => {
  const root = await mkdtemp(join(tmpdir(),'eval-export-test-'));
  try {
    await writeFile(join(root,'protocol.json'),JSON.stringify({preflight:true}));
    await assert.rejects(exportRun(root,'project',{apply:true,api:{request:()=>assert.fail('must not call remote')}}),/not a model experiment/);
  } finally { await rm(root,{recursive:true,force:true}); }
});

function readback(span) {
  const values = Object.fromEntries(span.attributes.map(x => [x.key,x.value.stringValue]));
  return { id:span.spanId, traceId:span.traceId, environment:'evaluation', experimentDatasetId:'dataset-id',
    experimentItemId:values['langfuse.experiment.item.id'],
    input:JSON.parse(values['langfuse.observation.input']), output:JSON.parse(values['langfuse.observation.output']),
    expectedOutput:JSON.parse(values['langfuse.experiment.item.expected_output']), metadata:JSON.parse(values['langfuse.observation.metadata']),
    experimentMetadata:{protocol_hash:values['langfuse.experiment.metadata.protocol_hash'],...(values['langfuse.experiment.metadata.execution']?{execution:JSON.parse(values['langfuse.experiment.metadata.execution'])}:{})} };
}
test('readback rejects lost structured evidence even when final text and identities match', () => {
  const span=experimentSpan(protocol,item,{...result,files:{'api.js':'modified'},mockEvents:[{phase:'applied',tool:'save_issue',result:{id:'EVAL-1'}}]},'dataset-id');
  const row=readback(span);
  verifyItem(row,span,protocol,'dataset-id');
  for(const field of ['grading','files','mockEvents','toolCalls','status']) {
    const bad=structuredClone(row); delete bad.output[field];
    assert.throws(()=>verifyItem(bad,span,protocol,'dataset-id'),/Remote evidence/);
  }
  for(const field of ['usage','gisul','quality']) {
    const bad=structuredClone(row); delete bad.metadata[field];
    assert.throws(()=>verifyItem(bad,span,protocol,'dataset-id'),/Remote metadata/);
  }
  assert.throws(()=>verifyItem({...row,input:{}},span,protocol,'dataset-id'),/Remote evidence/);
  assert.throws(()=>verifyItem({...row,expectedOutput:{}},span,protocol,'dataset-id'),/Remote evidence/);
});
test('native file evidence and incomplete recovery survive export and are required on readback', () => {
  const nativeItems = [{ type: 'commandExecution', command: 'cat fixture.txt', aggregatedOutput: 'actual fixture bytes', exitCode: 0 }, { type: 'fileChange', changes: [{ path: 'copy.txt', kind: 'add' }] }];
  const recovered = { ...result, status: 'failed', items: [...nativeItems, { type: 'agentMessage', text: 'stopped' }], evidenceComplete: false, usageComplete: false, recovery: { reason: 'ENOSPC', rawEventsSha256: 'retained-events' } };
  const span = experimentSpan(protocol, item, recovered, 'dataset-id');
  const row = readback(span);
  verifyItem(row, span, protocol, 'dataset-id');
  assert.deepEqual(row.output.nativeItems, nativeItems);
  assert.equal(row.output.evidenceComplete, false);
  assert.equal(row.metadata.usageComplete, false);
  for (const key of ['nativeItems', 'evidenceComplete', 'usageComplete', 'recovery']) {
    const bad = structuredClone(row); delete bad.output[key];
    assert.throws(() => verifyItem(bad, span, protocol, 'dataset-id'), /Remote evidence/);
  }
  const bad = structuredClone(row); bad.metadata.usageComplete = true;
  assert.throws(() => verifyItem(bad, span, protocol, 'dataset-id'), /usageComplete/);
});
test('v4 JSON IO and flattened string metadata preserve all evidence, with missing leaves rejected', () => {
  const cohort={scheduled:22,executed:1,assessment:{status:'not_reviewed'}};
  const span=experimentSpan(protocol,item,result,'dataset-id',cohort);
  const row=readback(span);
  for(const key of ['input','output','expectedOutput']) row[key]=JSON.stringify(row[key]);
  const flat={};
  function visit(value,key) {
    if(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length) for(const [k,v] of Object.entries(value)) visit(v,key?key+'.'+k:k);
    else flat[key]=typeof value==='string'?value:JSON.stringify(value);
  }
  visit(row.metadata,''); row.metadata=flat;
  row.experimentMetadata.execution=JSON.stringify(cohort);
  verifyItem(row,span,protocol,'dataset-id');
  delete row.metadata['usage.totalTokens'];
  assert.throws(()=>verifyItem(row,span,protocol,'dataset-id'),/usage.totalTokens/);
});
test('v4 explicit null usage stays unknown, and an absent usage key still fails', () => {
  const span=experimentSpan(protocol,item,{...result,usage:null,estimatedCost:null},'dataset-id');
  const row=readback(span);
  row.metadata.usage=''; row.metadata.estimated_cost='';
  verifyItem(row,span,protocol,'dataset-id');
  delete row.metadata.usage;
  assert.throws(()=>verifyItem(row,span,protocol,'dataset-id'),/usage/);
});
test('stopped runs export only actual executions, with missing cases explicit and stable retry identities', async () => {
  const root=await mkdtemp(join(tmpdir(),'partial-eval-export-'));
  const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
  try {
    const p={...protocol,fullDataset:true,dataset:{name:'agent-env-v1',version:'dataset-hash',totalCases:2}};
    delete p.hash; p.hash=sha(JSON.stringify(p));
    const r={...result,caseId:item.id,protocolHash:p.hash,items:[{type:'agentMessage',text:'actual output'}]};
    const other={...item,id:'F-02'};
    const bytes=JSON.stringify(r);
    await mkdir(join(root,'runs','actual'),{recursive:true});
    await writeFile(join(root,'protocol.json'),JSON.stringify(p));
    await writeFile(join(root,'summary.json'),JSON.stringify({protocolHash:p.hash}));
    await writeFile(join(root,'assessment.json'),JSON.stringify({status:'diagnostic_invalid_for_behavior',reason:'fixture write approval denied'}));
    await writeFile(join(root,'cases.private.json'),JSON.stringify([item,other]));
    await writeFile(join(root,'runs','actual','result.json'),bytes);
    await writeFile(join(root,'phase.json'),JSON.stringify({protocolHash:p.hash,stopped:'observed_token_limit',runs:[{id:'actual',caseId:item.id,status:'completed',resultHash:sha(bytes)},{id:'absent',caseId:other.id,status:'not_run'}]}));
    const posts=[]; let spans=[],visible=true;
    const api={origin:'https://example.test',request:async(path,options)=>{
      if(path==='/api/public/projects')return {data:[{id:'project'}]};
      if(path.startsWith('/api/public/v2/datasets/'))return {id:'dataset-id'};
      if(path.startsWith('/api/public/dataset-items?'))return {meta:{totalPages:1},data:[item,other].map(x=>({id:'agent-env-v1:'+x.id,input:x.input,expectedOutput:x.expected,metadata:{version:p.dataset.version}}))};
      if(path==='/api/public/otel/v1/traces'){posts.push(options.body);spans=options.body.resourceSpans[0].scopeSpans[0].spans;return {};}
      if(path.startsWith('/api/public/experiments?'))return {data:[{id:p.id,datasetId:'dataset-id',itemCount:1}]};
      if(path.startsWith('/api/public/experiment-items?'))return {meta:{},data:visible?spans.map(readback):[]};
      assert.fail('Unexpected request '+path);
    }};
    const first=await exportRun(root,'project',{api,apply:true,readbackAttempts:1});
    assert.equal(first.verifiedItems,1); assert.equal(first.execution.fullDatasetExecuted,false);
    assert.equal(first.execution.notRun[0].caseId,'F-02'); assert.equal(first.execution.stopReason,'observed_token_limit');
    assert.equal(first.execution.assessment.status,'diagnostic_invalid_for_behavior');
    assert.ok(first.execution.assessmentHash);
    assert.match(spans[0].attributes.find(x=>x.key==='langfuse.experiment.description').value.stringValue,/DIAGNOSTIC/);
    const second=await exportRun(root,'project',{api,apply:true,readbackAttempts:1});
    assert.deepEqual(first.items,second.items); assert.equal(posts.length,1,'readback retry must not resubmit raw spans');
    visible=false;
    await assert.rejects(exportRun(root,'project',{api,apply:true,readbackAttempts:1}),/readback pending/);
    assert.equal(posts.length,1,'ambiguous submitted intent must not be resent');
    await mkdir(join(root,'langfuse-export.lock'));
    await assert.rejects(exportRun(root,'project',{api,apply:true}),{code:'EEXIST'});
    await rm(join(root,'langfuse-export.lock'),{recursive:true});
    await writeFile(join(root,'runs','actual','result.json'),JSON.stringify({...r,finalText:'changed later'}));
    await assert.rejects(exportRun(root,'project',{api,apply:true,readbackAttempts:1}),/Result changed/);
  } finally {await rm(root,{recursive:true,force:true});}
});
