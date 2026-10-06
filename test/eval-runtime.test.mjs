import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, realpath, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';
import { buildEnvironment, CodexSession, readyServers, verifyBoundary } from '../eval/runtime.mjs';
import { classifyFailure, stopReason } from '../eval/run.mjs';

const REPO = fileURLToPath(new URL('..', import.meta.url));
const LOADER = '---\nname: gisul\ndescription: Read remote workflows.\n---\nUse the gisul reader.';
const names = ['search_skills', 'load_skill', 'read_skill_file'];
const tools = Object.fromEntries(names.map(name => [name, { name, inputSchema: { type: 'object' } }]));
const nested = config => {
  const result = {};
  for (const [key, value] of Object.entries(config)) {
    const parts = key.split('.');
    let parent = result;
    for (const part of parts.slice(0, -1)) parent = parent[part] ??= {};
    parent[parts.at(-1)] = value;
  }
  return result;
};
async function fixture(t, overrides = {}) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'gisul-runtime-test-')));
  t.after(() => rm(root, { recursive: true, force: true }));
  const workspace = join(root, 'workspace'), home = join(root, 'home'), denied = join(root, 'controller');
  await writeFile(denied, 'private controller canary');
  const options = { home, workspace, agentsMarkdown: 'Chosen global instruction.\n', loaderMarkdown: LOADER,
    model: 'gpt-6-astra', effort: 'max', authSource: null, deniedPaths: [denied],
    servers: { gisul: { command: '/usr/bin/true' }, linear: { command: process.execPath, args: [join(REPO,'eval/mock-linear.mjs')] } }, ...overrides };
  return { root, denied, workspace, home, options };
}

// A separate process exercises the real stdio framing, argv and environment.
// It is a protocol fixture, never a model call or Codex substitute in preflight.
const FAKE_CODEX = String.raw`#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const fixture = JSON.parse(fs.readFileSync(path.join(process.env.CODEX_HOME, 'protocol-fixture.json')));
const skills = [{name:'gisul',path:path.join(process.cwd(),'.agents/skills/gisul/SKILL.md'),enabled:true,scope:'repo'},
 {name:'builtin',path:path.join(process.env.CODEX_HOME,'skills/.system/builtin/SKILL.md'),enabled:true,scope:'system'}];
const send = value => process.stdout.write(JSON.stringify(value)+'\n');
readline.createInterface({input:process.stdin}).on('line', line => {
 const m=JSON.parse(line); if(!m.method || m.id===undefined) return;
 const ok = result => send({id:m.id,result});
 if(m.method==='initialize') return ok({argv:process.argv.slice(2),env:process.env});
 if(m.method==='config/read') return ok({config:fixture.config});
 if(m.method==='skills/list') return ok({data:[{cwd:process.cwd(),errors:[],skills}]});
 if(m.method==='skills/config/write') {skills.find(s=>s.path===m.params.path).enabled=m.params.enabled;return ok({});}
 if(m.method==='thread/start') return ok({thread:{id:'thread-1',environments:[{environmentId:'local',cwd:process.cwd(),runtimeWorkspaceRoots:[process.cwd()]}]},model:fixture.config.model,modelProvider:'openai',
  reasoningEffort:fixture.config.model_reasoning_effort,approvalPolicy:'never',activePermissionProfile:{id:'eval',extends:':workspace'},sandbox:{networkAccess:false},received:m.params});
 if(m.method==='mcpServerStatus/list') return ok({data:[{name:'gisul',runtimeStatus:'connected',tools:fixture.tools},{name:'linear',runtimeStatus:'connected',tools:{},serverInfo:{name:'linear-evaluation-fixture'}}]});
 if(m.method==='command/exec') return ok({exitCode:m.params.command.at(-1)===fixture.loaderPath?0:1,stdout:m.params.command.at(-1)===fixture.loaderPath?'readable':'EPERM',stderr:''});
 if(m.method==='reject') return send({id:m.id,error:{code:-32000,message:'sensitive server detail omitted'}});
 if(m.method==='collision') return send({id:m.id,method:'item/commandExecution/requestApproval',params:{}});
 if(m.method==='invalid') return process.stdout.write('bad protocol\n');
 if(m.method==='hang') return;
 if(m.method==='turn/start') {
  const prompt=m.params.input[0].text;
  if(prompt==='hang-start') return;
  const done=id=>send({method:'turn/completed',params:{threadId:'thread-1',turn:{id,status:['failed','overloaded'].includes(prompt)?'failed':'completed',...(prompt==='overloaded'?{error:{message:'Selected model is at capacity.',codexErrorInfo:'serverOverloaded'}}:{})}}});
  if(prompt==='early') done('turn-1');
  ok({turn:{id:'turn-1'}});
  if(prompt==='wait') {done('stale-turn');return;}
  if(prompt!=='early') setImmediate(()=>done('turn-1'));
  return;
 }
 ok(m.params);
});
`;
async function fakeSession(t, overrides = {}) {
  const f = await fixture(t, overrides);
  const built = await buildEnvironment(f.options);
  const bin = join(f.root, 'bin'); await mkdir(bin);
  await writeFile(join(bin, 'codex'), FAKE_CODEX, { mode: 0o700 });
  await writeFile(join(f.home, 'protocol-fixture.json'), JSON.stringify({config:nested(built.config),tools,loaderPath:built.loaderPath}));
  const api = new CodexSession({cwd:f.workspace,...built,env:{...built.env,PATH:bin+':'+dirname(process.execPath)+':'+built.env.PATH,OPENAI_API_KEY:'must-not-inherit',NODE_OPTIONS:'--invalid',HERDR_SOCKET:'must-not-inherit'}});
  t.after(() => api.close());
  return {...f,...built,api};
}
async function prepared(t) {
  const f=await fakeSession(t);
  await f.api.initialize(); await f.api.start();
  await verifyBoundary(f.api,{workspace:f.workspace,allowedPath:f.loaderPath,deniedPaths:[f.denied]});
  await readyServers(f.api);
  return f;
}

test('isolated files preserve chosen instructions, stable profiles and auth without inheriting globals', async t => {
  const f=await fixture(t);
  const auth=join(f.root,'source-auth.json'); await writeFile(auth,'{"test":"fixture-only"}');
  const built=await buildEnvironment({...f.options,authSource:auth});
  assert.equal(built.env.HOME,process.env.HOME);
  assert.equal(built.env.CODEX_HOME,f.home);
  assert.deepEqual(Object.keys(built.env).filter(k=>/KEY|TOKEN|SECRET|HERDR|NODE_OPTIONS|PROXY/.test(k)),[]);
  assert.equal(await readFile(join(f.home,'AGENTS.md'),'utf8'),f.options.agentsMarkdown);
  assert.equal(await readFile(built.loaderPath,'utf8'),LOADER);
  assert.equal(await readFile(join(f.home,'auth.json'),'utf8'),'{"test":"fixture-only"}');
  assert.equal((await stat(join(f.home,'auth.json'))).mode & 0o777,0o600);
  const base=await readFile(join(f.home,'config.toml'),'utf8');
  for(const name of ['eval-baseline','eval-candidate']) assert.equal(await readFile(join(f.home,name+'.config.toml'),'utf8'),base);
  assert.deepEqual((await readdir(f.home)).sort(),['AGENTS.md','auth.json','config.toml','eval-baseline.config.toml','eval-candidate.config.toml']);
  assert.equal(built.config['permissions.eval'].filesystem[join(process.env.HOME,'.codex')],'deny');
  assert.equal(built.config['permissions.eval'].filesystem[f.home],'deny');
  assert.deepEqual(built.config['mcp_servers.gisul'].enabled_tools,names);
  assert.deepEqual(built.config['mcp_servers.linear'].tools,{save_issue:{approval_mode:'approve'},send_slack_message:{approval_mode:'approve'}});
  assert.equal(built.config['mcp_servers.gisul'].tools,undefined);
  await assert.rejects(buildEnvironment(f.options),/must be empty/);
});

test('environment rejects external server names, non-mock transport and loader-denying boundaries', async t => {
  const f=await fixture(t);
  await assert.rejects(buildEnvironment({...f.options,servers:{...f.options.servers,slack:{command:'true'}}}),/Exactly/);
  await assert.rejects(buildEnvironment({...f.options,servers:{...f.options.servers,linear:{url:'https:\/\/linear.invalid'}}}),/local mock/);
  await assert.rejects(buildEnvironment({...f.options,servers:{...f.options.servers,linear:{command:process.execPath,args:['/tmp/other-linear.mjs']}}}),/exact local mock/);
  await assert.rejects(buildEnvironment({...f.options,servers:{...f.options.servers,linear:{...f.options.servers.linear,tools:{save_issue:{approval_mode:'approve'}}}}}),/Unsupported/);
  await assert.rejects(buildEnvironment({...f.options,deniedPaths:[f.root]}),/overlaps/);
  const alias=join(f.root,'workspace-alias'); await mkdir(f.workspace); await symlink(f.workspace,alias);
  await assert.rejects(buildEnvironment({...f.options,deniedPaths:[alias]}),/overlaps/);
});

test('stdio preserves argv literals, strips ambient capabilities and disables auto-discovered skills', async t => {
  const f=await fakeSession(t,{model:'literal `touch /tmp/should-not-exist` $(printf bad) "model"'});
  const host=await f.api.initialize();
  assert.deepEqual(host.argv.slice(0,2),['app-server','--stdio']);
  assert.ok(host.argv.includes('model='+JSON.stringify(f.options.model)));
  assert.equal(host.env.CODEX_HOME,f.home); assert.equal(host.env.HOME,process.env.HOME);
  for(const name of ['OPENAI_API_KEY','NODE_OPTIONS','HERDR_SOCKET']) assert.equal(host.env[name],undefined);
  const catalog=await f.api.rpc('skills/list');
  assert.deepEqual(catalog.data[0].skills.filter(s=>s.enabled).map(s=>s.name),['gisul']);
  const start=await f.api.start(f.workspace,{allowProviderModelFallback:false});
  assert.equal(start.received.ephemeral,true); assert.equal(start.received.permissions,'eval');
  assert.equal(start.received.config.model_reasoning_effort,'max');
  assert.equal(Object.hasOwn(start.received,'environments'),false,'An empty environment selection disables model file tools');
  await assert.rejects(f.api.turn('no gates'),/boundaries and MCP/);
});

test('thread overrides cannot re-enable approvals or model fallback', async t => {
  const f=await fakeSession(t); await f.api.initialize();
  await assert.rejects(f.api.start(f.workspace,{approvalPolicy:'on-request'}),/Cannot override/);
  await assert.rejects(f.api.rpc('after-failure'),/Cannot override/);
});

test('effective configuration drift fails before any thread, with an exact field path', async t => {
  const f=await fakeSession(t);
  const path=join(f.home,'protocol-fixture.json');
  const data=JSON.parse(await readFile(path,'utf8'));
  data.config.permissions.eval.network.enabled=true;
  await writeFile(path,JSON.stringify(data));
  await assert.rejects(f.api.initialize(),/permissions\.eval\["network"\]\["enabled"\]/);
  assert.equal(f.api.threadId,undefined);
});

test('RPC rejection, colliding interactive request IDs and invalid framing fail closed', async t => {
  for(const [method,pattern] of [['reject',/RPC rejected/],['collision',/Interactive request rejected/],['invalid',/Invalid JSON/]]) {
    await t.test(method,async t=>{
      const {api}=await fakeSession(t);
      await api.initialize();
      await assert.rejects(api.rpc(method),pattern);
      assert.equal(api.pending.size,0);
      await assert.rejects(api.rpc('later'),pattern);
      if(method==='collision') assert.equal(api.events.at(-1).method,'evaluation/interactiveRequestRejected');
    });
  }
});

test('RPC and turn deadlines settle pending promises and stop the session', async t => {
  for(const mode of ['rpc','hang-start','wait']) {
    await t.test(mode,async t=>{
      const {api}=await prepared(t);
      const begin=Date.now();
      await assert.rejects(mode==='rpc'?api.rpc('hang',{},40):api.turn(mode,{timeoutMs:40}),/timeout|exceeded/);
      assert.ok(Date.now()-begin<1500);
      assert.equal(api.pending.size,0);
      assert.equal(api.listenerCount('notification'),0);
      await assert.rejects(api.rpc('later'),/timeout|exceeded/);
    });
  }
});

test('completion before turn/start response is retained; failed turns reject', async t => {
  const {api}=await prepared(t);
  const result=await api.turn('early',{timeoutMs:1000});
  assert.equal(result.turn.id,'turn-1');
  assert.ok(result.events.some(e=>e.method==='turn/completed'));
  await assert.rejects(api.turn('failed',{timeoutMs:1000}),/did not complete successfully/);
});

test('provider overload keeps its native reason and stops scheduling at two infrastructure failures', async t => {
  const {api}=await prepared(t);
  let observed;
  await assert.rejects(api.turn('overloaded',{timeoutMs:1000}),error=>{
    observed=error;
    return error.code==='EVAL_PROVIDER_FAILURE' && error.providerError.codexErrorInfo==='serverOverloaded';
  });
  const failed={status:'failed',failure:{type:classifyFailure(observed,'execution')}};
  assert.equal(failed.failure.type,'infrastructure');
  assert.equal(stopReason([failed,failed],1500000),'two_infrastructure_failures');
});

test('boundary probe never prints content; readable, missing or inconclusive denied paths fail', async t => {
  const f=await fixture(t); await mkdir(f.workspace); const allowed=join(f.workspace,'allowed'); await writeFile(allowed,'allowed');
  for(const result of [{exitCode:0,stdout:'readable'},{exitCode:1,stdout:'ENOENT'},{exitCode:1,stdout:'EPERM extra'}]) {
    const calls=[];
    const api={rpc:async(method,params)=>{calls.push(params);return calls.length===1?{exitCode:0,stdout:'readable'}:result;}};
    await assert.rejects(verifyBoundary(api,{workspace:f.workspace,allowedPath:allowed,deniedPaths:[f.denied]}),/Isolation violation/);
    assert.ok(calls.every(c=>c.permissionProfile==='eval' && c.outputBytesCap===128));
    assert.ok(calls.every(c=>!c.command[2].includes('readFile')));
  }
  await assert.rejects(verifyBoundary({rpc:async()=>({exitCode:0,stdout:'readable'})},{workspace:f.workspace,allowedPath:allowed,deniedPaths:[join(f.root,'missing')]}),/ENOENT/);
});

test('MCP readiness requires exact connected names and only the reader tools', async () => {
  const valid=[{name:'gisul',runtimeStatus:'connected',tools},{name:'linear',runtimeStatus:'connected',tools:{},serverInfo:{name:'linear-evaluation-fixture'}}];
  for(const data of [[...valid,{name:'slack',runtimeStatus:'starting'}],valid.map(s=>s.name==='gisul'?{...s,tools:{...tools,create_skill:{}}}:s),valid.map(s=>({...s,runtimeStatus:'failed'})),valid.map(s=>s.name==='linear'?{...s,serverInfo:{name:'real-linear'}}:s)]) {
    await assert.rejects(readyServers({rpc:async()=>({data})}),/Unexpected external|exactly|startup failed|not the evaluation fixture/);
  }
  await assert.rejects(readyServers({rpc:async()=>({data:valid,nextCursor:'more'})}),/pagination/);
  await assert.rejects(readyServers({rpc:async()=>({data:[]})},['gisul','linear'],10),/incomplete/);
  assert.equal((await readyServers({rpc:async()=>({data:valid})})).length,2);
});

// Explicit opt-in invokes the real installed Codex app-server, never turn/start.
// It performs only config/skill/thread/command/MCP status operations.
test('real Codex no-model preflight: isolated catalog, pinned thread, read denies and network deny', {skip:process.env.EVAL_RUNTIME_PREFLIGHT!=='1',timeout:60000}, async t => {
  const f=await fixture(t);
  const reader=join(f.root,'reader.cjs');
  await writeFile(reader,`const r=require('node:readline');const tools=${JSON.stringify(Object.values(tools))};r.createInterface({input:process.stdin}).on('line',l=>{const m=JSON.parse(l);if(m.id===undefined)return;const result=m.method==='initialize'?{protocolVersion:m.params.protocolVersion,capabilities:{tools:{}},serverInfo:{name:'evaluation-reader-fixture',version:'1'}}:m.method==='tools/list'?{tools}:{};process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:m.id,result})+'\\n');});`);
  const built=await buildEnvironment({...f.options,servers:{gisul:{command:process.execPath,args:[reader]},linear:{command:process.execPath,args:[join(REPO,'eval/mock-linear.mjs')],env:{EVAL_WRITE_LOG:join(f.root,'linear.jsonl')}}}});
  const api=new CodexSession({cwd:f.workspace,...built}); t.after(()=>api.close());
  const host=await api.initialize();
  const started=await api.start();
  assert.equal(started.model,'gpt-6-astra'); assert.equal(started.reasoningEffort,'max');
  assert.equal(started.activePermissionProfile.id,'eval'); assert.equal(started.approvalPolicy,'never');
  assert.equal(started.thread.environments[0].environmentId,'local');
  const probes=[f.denied,join(built.env.CODEX_HOME,'config.toml'),join(process.env.HOME,'.codex')];
  const checks=await verifyBoundary(api,{workspace:f.workspace,allowedPath:built.loaderPath,deniedPaths:probes});
  assert.ok(checks.every(check=>check.passed));
  assert.deepEqual((await readyServers(api)).map(s=>s.name).sort(),['gisul','linear']);
  const server=createServer(socket=>socket.end());
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const script=`const s=require('node:net').connect(${server.address().port},'127.0.0.1');s.on('connect',()=>{console.log('CONNECTED');s.end()});s.on('error',e=>{console.log(e.code);process.exitCode=1});setTimeout(()=>{s.destroy();process.exit(2)},1500).unref();`;
  const network=await api.rpc('command/exec',{command:[process.execPath,'-e',script],cwd:f.workspace,permissionProfile:'eval',timeoutMs:5000,outputBytesCap:128});
  assert.equal(network.exitCode,1); assert.match(network.stdout,/^(EPERM|EACCES)\s*$/);
  assert.equal(api.events.some(e=>e.method==='turn/started'),false);
  t.diagnostic(JSON.stringify({host:host.userAgent,model:started.model,effort:started.reasoningEffort,permissionProfile:started.activePermissionProfile.id,checks:checks.length,network:network.stdout.trim(),modelTurns:0}));
});
