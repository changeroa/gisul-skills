import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { parse } from "yaml";
export async function dataset() {
  const root=fileURLToPath(new URL(".",import.meta.url));
  const cases=[];
  for(const name of (await readdir(join(root,"cases"))).filter(x=>x.endsWith(".yaml")).sort())cases.push(parse(await readFile(join(root,"cases",name),"utf8")));
  if(cases.length<20||cases.length>30||new Set(cases.map(x=>x.id)).size!==cases.length||cases.filter(x=>x.split==="holdout").length!==4)throw new Error("Invalid dataset composition");
  for(const item of cases){
    if(!item.input?.prompt||!item.expected||!(item.source_trace||item.fixture))throw new Error(`Invalid case ${item.id}`);
    for(const fixture of item.input.fixtures){if(!fixture.startsWith("fixtures/")||fixture.includes(".."))throw new Error("Unsafe fixture path");}
    if(item.fixture)await readFile(join(root,item.fixture));
  }
  return {name:"agent-env-v1",version:createHash("sha256").update(JSON.stringify(cases)).digest("hex"),cases};
}
