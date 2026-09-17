import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { dataset } from "./dataset.mjs";
import { langfuseApi } from "../scripts/langfuse-api.mjs";
const args=process.argv.slice(2), index=args.indexOf("--project");
const project=index>=0?args[index+1]:null;
if(!project)throw new Error("Usage: sync-dataset.mjs --project ID [--apply]");
const source=await dataset();
if(!args.includes("--apply")){console.log(JSON.stringify({dry_run:true,name:source.name,version:source.version,cases:source.cases.length,holdout:4}));process.exit(0);}
const api=await langfuseApi();
const projects=await api.request("/api/public/projects");
if(projects.data?.length!==1||projects.data[0].id!==project)throw new Error("Project identity mismatch");
const get=async path=>{try{return await api.request(path);}catch(error){if(error.status===404)return null;throw error;}};
const datasetPath=`/api/public/v2/datasets/${encodeURIComponent(source.name)}`;
let target=await get(datasetPath);
if(!target){
  try{target=await api.request("/api/public/v2/datasets",{method:"POST",body:{name:source.name,description:"Versioned agent environment evaluation; Git is the case source.",metadata:{source:"changeroa/gisul-skills",version:source.version}}});}
  catch(error){target=await get(datasetPath);if(!target)throw error;}
}
let updated=0,unchanged=0;
for(const item of source.cases){
  const id=`${source.name}:${item.id}`;
  const path=`/api/public/dataset-items/${encodeURIComponent(id)}`;
  const body={id,datasetName:source.name,input:item.input,expectedOutput:item.expected,metadata:{case_id:item.id,split:item.split,critical:item.critical,version:source.version,provenance:item.provenance,fixture:item.fixture??null},...(item.source_trace?{sourceTraceId:item.source_trace.split("/").at(-1)}:{})};
  const equal=value=>value&&value.id===id&&isDeepStrictEqual(value.input,body.input)&&isDeepStrictEqual(value.expectedOutput,body.expectedOutput)&&value.metadata?.version===source.version;
  if(equal(await get(path))){unchanged++;continue;}
  try{await api.request("/api/public/dataset-items",{method:"POST",body});}
  catch(error){if(!equal(await get(path)))throw error;}
  const verified=await get(path);if(!equal(verified))throw new Error(`Dataset readback mismatch: ${item.id}`);
  updated++;
}
const verified=await get(datasetPath);
const items=[];let page=1,totalPages=1;
do{
  const result=await api.request(`/api/public/dataset-items?datasetName=${encodeURIComponent(source.name)}&limit=100&page=${page}`);
  if(!Array.isArray(result.data)||!Number.isInteger(result.meta?.totalPages))throw new Error("Unexpected dataset items response");
  items.push(...result.data);totalPages=result.meta.totalPages;page++;
}while(page<=totalPages);
const active=items.filter(x=>x.status!=="ARCHIVED");
if(verified.id!==target.id)throw new Error("Dataset identity changed during sync");
if(active.length!==source.cases.length||active.some(x=>x.metadata?.version!==source.version))throw new Error("Dataset contains unexpected items or versions");
const result={time:new Date().toISOString(),project_id:project,dataset_id:target.id,name:source.name,version:source.version,cases:source.cases.length,holdout:4,updated,unchanged,verified:true};
const out=fileURLToPath(new URL("out",import.meta.url));await mkdir(out,{recursive:true});await writeFile(join(out,"dataset-sync.json"),JSON.stringify(result,null,2)+"\n");
console.log(JSON.stringify(result,null,2));
