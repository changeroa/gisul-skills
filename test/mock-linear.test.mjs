import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { mockLinear } from "../eval/mock-linear.mjs";
test("L-08 loses a successful create response; re-query finds it and no second create is needed",async()=>{
  const fixture=JSON.parse(await readFile(new URL("../eval/fixtures/linear/recorded.json",import.meta.url)));
  const events=[];const {server}=mockLinear({fixture,timeoutOnce:true,record:async event=>events.push(structuredClone(event))});
  const client=new Client({name:"timeout-test",version:"1"});const [a,b]=InMemoryTransport.createLinkedPair();
  await server.connect(a);await client.connect(b);
  try{
    await assert.rejects(client.callTool({name:"save_issue",arguments:{title:"[L-08] 독립 검증",project:fixture.projects[0].id,team:"IYEN Development",template:"개발 작업"}},undefined,{timeout:50}),/timed out/i);
    const queried=await client.callTool({name:"list_issues",arguments:{project:fixture.projects[0].id,query:"[L-08] 독립 검증"}});
    const found=JSON.parse(queried.content[0].text).issues;assert.equal(found.length,1);
    await client.callTool({name:"save_issue",arguments:{id:found[0].id,description:"검증 결과를 기록한다.\n\n- [ ] 실제 흐름 확인"}});
    const reread=await client.callTool({name:"get_issue",arguments:{id:found[0].id}});
    assert.match(JSON.parse(reread.content[0].text).description,/\n\n- \[ \]/);
    assert.equal(events.filter(x=>x.phase==="call"&&x.tool==="save_issue"&&!x.args.id).length,1);
    assert.equal(events.filter(x=>x.phase==="response_lost").length,1);
  }finally{await client.close();await server.close();}
});
