import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { materializeCandidate } from "../eval/materialize-candidate.mjs";
import { dataset } from "../eval/dataset.mjs";
test("candidate workflow resources include exact project/policy URIs through the real bridge",{timeout:30000},async t=>{
  const root=await mkdtemp(join(tmpdir(),"gisul-candidate-"));t.after(()=>rm(root,{recursive:true,force:true}));
  const candidate=await materializeCandidate(root);
  const server=process.env.GISUL_SERVER_PATH??new URL("../../gisul/server/dist/index.js",import.meta.url).pathname;
  const transport=new StdioClientTransport({command:process.execPath,args:[join(dirname(server),"codex.js"),"--origin","candidate-fixture","--","env",`GISUL_ROOT=${root}`,`GISUL_SKILL_ROOTS=gisul=${join(root,"skills")}`,process.execPath,server],env:{...process.env,GISUL_EVENT_LOG_DIR:join(root,"events")},stderr:"pipe"});
  transport.stderr.on("data",()=>{});const client=new Client({name:"candidate-validation",version:"1"});
  const call=async(name,args)=>{const result=await client.callTool({name,arguments:args});assert.ok(!result.isError,JSON.stringify(result));return JSON.parse(result.content[0].text);};
  try{
    await client.connect(transport);
    const search=await call("search_skills",{query:"기획"});assert.equal(search.totalMatches,1);
    const loaded=await call("load_skill",{uri:search.skills[0].uri});assert.equal(loaded.release,candidate.release);
    assert.ok(!loaded.markdown.includes("C0BBR6TNSCR"));
    const read=uri=>call("read_skill_file",{skill_uri:loaded.uri,uri});
    const index=JSON.parse((await read(loaded.files.find(uri=>uri.endsWith("projects/index.json")))).text);
    assert.equal(index.length,2);
    for(const project of index){assert.ok(loaded.files.includes(project.project_uri));assert.ok(loaded.files.includes(project.policy_uri));await read(project.project_uri);await read(project.policy_uri);}
  }finally{await client.close();}
  const data=await dataset();assert.equal(data.cases.length,22);assert.equal(data.cases.filter(x=>x.split==="holdout").length,4);
  const agents=await readFile(new URL("../eval/candidates/bootstrap/AGENTS.md",import.meta.url));assert.ok(agents.length<=1300);
});
