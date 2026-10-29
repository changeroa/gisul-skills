import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runTrial } from './run.mjs';

test('fixture setup failures persist an attempt and never escape the ledger caller', async () => {
  const root=await mkdtemp(join(tmpdir(),'gisul-attempt-failure-'));
  try {
    const result=await runTrial({phaseRoot:root,workspace:join(root,'workspace'),id:'fixture-failure',expectedCommit:'a'.repeat(40),variant:'baseline',
      installed:{loaderMarkdown:'---\nname: gisul\ndescription: test\n---\n',model:'fixed-model',effort:'max',runtimeHash:'fixed-runtime'},
      scenario:{id:'fixture',family:'harness',prompts:['unused'],files:{'../outside.txt':'must not write'}}});
    assert.equal(result.status,'failed');
    assert.equal(result.failure.type,'infrastructure');
    assert.match(result.failure.message,/Unsafe fixture path/);
    assert.equal(result.usage,null);
    const saved=JSON.parse(await readFile(join(root,'runs/fixture-failure/result.json'),'utf8'));
    assert.equal(saved.id,result.id);
    assert.deepEqual(saved.failure,result.failure);
    await assert.rejects(access(join(root,'outside.txt')));
  } finally { await rm(root,{recursive:true,force:true}); }
});
