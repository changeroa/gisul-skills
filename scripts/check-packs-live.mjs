import { digest } from "./release-files.mjs";
import assert from 'node:assert/strict';
export async function checkPacks(client, commit, manifest, { pinned = false } = {}) {
  const call = async (name,args) => {
    const result = await client.callTool({name,arguments:args});
    assert.ok(!result.isError,JSON.stringify(result));
    const body=JSON.parse(result.content[0].text);assert.equal(body.commit,commit);return body;
  };
  const expected=manifest.packs??[];
  const listed=[];let offset=0;
  do {
    const page=await call('search_packs',{mode:'explicit',commit,offset,limit:50});listed.push(...page.packs);offset=page.nextOffset;
  } while(offset!==undefined);
  assert.deepEqual(listed.map(p=>p.uri).sort(),expected.map(p=>p.uri).sort());
  const referenced=new Set();
  for(const p of expected){
    const found=listed.find(v=>v.uri===p.uri);assert.equal(found.digest,p.digest);assert.ok((pinned ? ['verified_snapshot', 'published'] : ['published']).includes(found.publication_status));
    for(const key of ['created_by','created_at','updated_by','updated_at'])assert.equal(found[key],p.registration[key]);
    const load=await call('load_pack',{uris:[p.uri],commit});assert.deepEqual(load.packs[0].definition,p.definition);assert.equal(load.packs[0].digest,p.digest);
    assert.equal(load.members.length,p.definition.members.length);
    for(const m of load.members){const skill=manifest.skills.find(s=>s.uri===m.uri);assert.ok(skill);assert.equal(m.digest,skill.resources.find(r=>r.uri===m.uri).digest);assert.equal(m.invocation,skill.frontmatter['disable-model-invocation']===true?'explicit':'automatic');referenced.add(m.uri);}
  }
  const pair=['backend-pack','frontend-pack'].map(n=>expected.find(p=>p.definition.name===n));let combined;
  if(pair.every(Boolean)){
    const load=await call('load_pack',{uris:pair.map(p=>p.uri),commit});
    const unique=new Set(pair.flatMap(p=>p.definition.members.map(m=>m.uri)));
    assert.equal(load.members.length,unique.size);assert.equal(load.members.filter(m=>m.phase==='scope').length,1);assert.equal(load.members.filter(m=>m.phase==='verify').length,1);
    assert.equal(load.members.reduce((n,m)=>n+m.requirements.length,0),pair.reduce((n,p)=>n+p.definition.members.length,0));
    combined=load.composition;
  }
  for (const uri of referenced) {
    const loaded = await call('load_skill', { uri, commit });
    const skill = manifest.skills.find(s => s.uri === uri);
    assert.equal(loaded.digest, skill.resources.find(r => r.uri === uri).digest);
    assert.equal(digest(Buffer.from(loaded.markdown, 'utf8')), loaded.digest);
  }
  return {verified:true,packs:expected.length,referenced_skills:referenced.size,combined};
}
