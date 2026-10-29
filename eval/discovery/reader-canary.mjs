import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { CodexSession } from './codex-session.mjs';
import { inspectInstalled, isolatedConfig, readyServers, sha256 } from './environment.mjs';

const out=resolve(process.argv[2]??'eval/out/discovery/reader-canary-20260918');
await mkdir(out,{recursive:true});
const installed=await inspectInstalled(process.cwd());
const bundleArg=process.argv.slice(3).find(arg=>arg.startsWith('--bundle='));
if(bundleArg){
  installed.mcp.args[0]=resolve(bundleArg.slice('--bundle='.length));
  installed.runtimeHash=sha256(await readFile(installed.mcp.args[0]));
}
const api=new CodexSession({cwd:out,config:isolatedConfig(installed,join(out,'events'))});
try {
  await api.initialize(); await api.start(out); await readyServers(api);
  const call=async(tool,args)=>{
    const result=await api.rpc('mcpServer/tool/call',{threadId:api.threadId,server:'gisul',tool,arguments:args});
    assert.ok(!result.isError);
    return JSON.parse(result.content.find(item=>item.type==='text').text);
  };
  const local=installed.skills.find(skill=>skill.name==='mandela');
  let discovery;
  if(bundleArg){
    const automatic=await call('search_skills',{query:'hate',mode:'automatic',limit:5});
    assert.ok(automatic.skills.every(skill=>skill.invocation==='automatic'&&skill.name!=='hate'),'Manual-only workflows must not appear in automatic discovery');
    const explicit=await call('search_skills',{query:'hate',mode:'explicit',limit:5});
    assert.equal(explicit.skills[0].name,'hate');
    assert.equal(explicit.skills[0].invocation,'explicit');
    discovery={automaticMatches:automatic.totalMatches,automaticNames:automatic.skills.map(skill=>skill.name),explicitFirst:explicit.skills[0],commit:explicit.commit};
  }
  const matched=await call('load_skill',{uri:'skill://gisul/gisul/mandela/SKILL.md',...(bundleArg?{commit:discovery.commit}:{})});
  if(bundleArg) assert.equal(matched.commit,discovery.commit);
  const localHash=sha256(await readFile(local.path));
  assert.equal(localHash,sha256(matched.markdown));
  const skill=await call('load_skill',{uri:'skill://gisul/gisul/dont-make-me-think/SKILL.md',...(bundleArg?{commit:matched.commit}:{})});
  if(bundleArg){
    assert.equal(skill.commit,matched.commit);
    assert.match(skill.load_id,/^[a-f0-9]{64}$/);
  }
  const uri=skill.files.find(uri=>typeof uri==='string'&&uri!==skill.uri&&uri.endsWith('.md'));
  assert.ok(uri,'Supporting file must be listed by the current manifest');
  const support=await call('read_skill_file',{skill_uri:skill.uri,uri,...(bundleArg?{load_id:skill.load_id}:{})});
  assert.equal(support.commit,skill.commit);
  assert.equal(support.manifest_digest,skill.manifest_digest);
  assert.ok(support.text.length>0);
  const proof={synthetic:true,readerRuntimeHash:installed.runtimeHash,candidateBundle:Boolean(bundleArg),discovery,loaderBytes:Buffer.byteLength(installed.loaderMarkdown),
    matchedNative:{name:'mandela',localPath:local.path,localHash,remoteHash:sha256(matched.markdown),commit:matched.commit},
    supportingFile:{uri:support.uri,commit:support.commit,release:support.release,manifestDigest:support.manifest_digest,...(bundleArg?{loadId:skill.load_id,selectedCommit:matched.commit}:{}),bytes:Buffer.byteLength(support.text),sha256:sha256(support.text)}};
  await writeFile(join(out,'proof.json'),JSON.stringify(proof,null,2)+'\n');
  console.log(JSON.stringify(proof));
} finally { await api.close(); }
