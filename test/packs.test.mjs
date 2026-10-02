import { requirePublicationGate } from "../scripts/publication-gate.mjs";
import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp,mkdir,writeFile,readFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { readPacks,validatePack } from '../scripts/packs.mjs';
import { validate } from '../scripts/validate.mjs';
import { buildR2Release,verifyR2Release } from '../scripts/build-r2-release.mjs';
import { checkPacks } from '../scripts/check-packs-live.mjs';
const member=(n,phase)=>({uri:`skill://gisul/gisul/${n}/SKILL.md`,phase,selection:'required',when:n});
const def={schema_version:1,kind:'skill-pack',name:'example-pack',display_name:'Example',description:'Example review',scope:'fixture',members:[member('scope','scope'),member('backend','investigate'),member('verify','verify')]};
test('published packs retain roles, required members and reference closure',async()=>{
 const catalog=await validate();const packs=await readPacks(new URL('..',import.meta.url).pathname,catalog.valid);
 assert.deepEqual(packs.map(p=>p.definition.name),['architecture-pack','backend-pack','clean-code-pack','frontend-pack']);
 assert.deepEqual(packs.map(p=>p.definition.members.length),[14,13,12,13]);
 assert.ok(packs.every(p=>p.definition.members.some(m=>m.uri.endsWith('/review-verifier/SKILL.md')&&m.selection==='required')));
 const combined=packs.filter(p=>['backend-pack','frontend-pack'].includes(p.definition.name)).flatMap(p=>p.definition.members);
 assert.equal(combined.length,26);assert.equal(new Set(combined.map(m=>m.uri)).size,17);
 assert.ok(packs.find(p=>p.definition.name==='architecture-pack').definition.members.some(m=>m.uri.endsWith('/review-architecture/SKILL.md')&&m.selection==='required'));
 const clean=packs.find(p=>p.definition.name==='clean-code-pack').definition;
 assert.ok(clean.members.some(m=>m.uri.endsWith('/clean-code/SKILL.md')&&m.phase==='investigate'&&m.selection==='required'));
 const specialists=catalog.valid.filter(s=>/^clean-code-/.test(s.name)).map(s=>s.uri).sort();
 assert.deepEqual(clean.members.filter(m=>m.selection==='when_applicable').map(m=>m.uri).sort(),specialists);
 const roles=new Map();
 for(const {definition} of packs) for(const m of definition.members){
  if(roles.has(m.uri))assert.equal(roles.get(m.uri),m.phase,'Shared members must retain their phase across packs');
  roles.set(m.uri,m.phase);
 }
 for(const phase of ['scope','verify'])assert.equal([...roles.values()].filter(p=>p===phase).length,1);

});
test('definition checks reject missing references, duplicate and absent required roles',()=>{
 const available=new Set(def.members.map(m=>m.uri));assert.deepEqual(validatePack(def,available),def);
 for(const edit of [d=>d.members.pop(),d=>d.members.push(d.members[0]),d=>d.members[1].uri='skill://gisul/gisul/missing/SKILL.md',d=>d.members[0].selection='when_applicable',d=>d.kind='skill',d=>d.script='execute']){
  const d=structuredClone(def);edit(d);assert.throws(()=>validatePack(d,available));
 }
});
test('real release builder preserves pack bytes, derives attribution and rejects later broken closure',async t=>{
 const root=await mkdtemp(join(tmpdir(),'gisul-pack-builder-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
 const write=async(path,text)=>{await mkdir(join(root,path,'..'),{recursive:true});await writeFile(join(root,path),text);};
 git(['init','-b','main']);git(['config','user.name','Fixture']);git(['config','user.email','fixture@example.test']);
 await write('.gitignore','dist/\n');await write('aliases.json','{}\n');
 for(const name of ['scope','backend','verify'])await write(`skills/${name}/SKILL.md`,`---\nname: ${name}\ndescription: Fixture\n---\nContent\n`);
 const body=JSON.stringify(def,null,2)+'\n';await write('packs/example-pack.json',body);git(['add','.']);git(['commit','-m','register']);const original=git(['rev-parse','HEAD']);
 await write('registration-accounts.json',JSON.stringify({[original]:'alice'}));git(['add','registration-accounts.json']);git(['commit','-m','mapping']);
 const out=await buildR2Release(root,'20261001.1');const manifest=JSON.parse(await readFile(join(out,'inventory.json')));
 assert.deepEqual(manifest.packs[0].definition,def);assert.equal(manifest.packs[0].registration.created_by,'alice');assert.equal(await readFile(join(out,'packs/example-pack.json'),'utf8'),body);await verifyR2Release(out);
 const broken=structuredClone(def);broken.members[1].uri='skill://gisul/gisul/missing/SKILL.md';await write('packs/example-pack.json',JSON.stringify(broken));git(['add','packs']);git(['commit','-m','invalid']);
 assert.equal(requirePublicationGate(root,git(['rev-parse','HEAD']),original).content_changed,true);
 await assert.rejects(buildR2Release(root,'20261001.2'),/Unavailable/);await verifyR2Release(out);
});
test('publication smoke rejects missing pack surface before promotion',async()=>{
 await assert.rejects(checkPacks({callTool:async()=>({isError:true,content:[{text:'unknown tool'}]})},'a'.repeat(40),{packs:[]}),/unknown tool/);
});

test('staged reads may be verified snapshots while live publication requires active status',async()=>{
 const commit='a'.repeat(40),p={uri:'pack://gisul/gisul/example-pack',definition:def,digest:'test-digest',registration:{created_by:'alice'}};
 const skills=def.members.map(m=>({uri:m.uri,resources:[{uri:m.uri,digest:'unused'}],frontmatter:{}}));
 const client={callTool:async({name})=>({content:[{text:JSON.stringify({commit,packs:[{...p,publication_status:'verified_snapshot'}]})}]})};
 await assert.rejects(checkPacks(client,commit,{packs:[p],skills}),/includes/);
});
