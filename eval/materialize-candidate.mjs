import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { parse } from "yaml";
import { validate } from "../scripts/validate.mjs";
const repo=fileURLToPath(new URL("..",import.meta.url));
export async function materializeCandidate(destination) {
  await mkdir(destination,{recursive:true});
  await cp(join(repo,"eval/candidates/workflows/skills"),join(destination,"skills"),{recursive:true});
  const context=join(destination,"skills/linear-delivery/references");
  await cp(join(repo,"projects"),join(context,"projects"),{recursive:true});
  await cp(join(repo,"policies"),join(context,"policies"),{recursive:true});
  const index=[];
  for(const name of (await readdir(join(context,"projects"))).filter(x=>x.endsWith(".yaml")).sort()) {
    const config=parse(await readFile(join(context,"projects",name),"utf8"));
    if (!/^[a-z0-9-]+\.md$/.test(config.policy_file)) throw new Error("Invalid policy file");
    await readFile(join(context,"policies",config.policy_file));
    index.push({key:config.key,workspace_id:config.linear.workspace.id,team_id:config.linear.team.id,project_id:config.linear.project.id,
      project_uri:`skill://gisul/gisul/linear-delivery/references/projects/${name}`,policy_uri:`skill://gisul/gisul/linear-delivery/references/policies/${config.policy_file}`});
  }
  await writeFile(join(context,"projects/index.json"),JSON.stringify(index,null,2)+"\n");
  const catalog=await validate(join(destination,"skills"));
  if(catalog.invalid.length || catalog.warnings.some(x=>x.code==="missing_reference"))throw new Error("Candidate package failed validation");
  const commit=execFileSync("git",["rev-parse","HEAD"],{cwd:repo,encoding:"utf8"}).trim();
  const release=`candidate-${catalog.valid.map(x=>x.manifest_digest.slice(-12)).join("-")}`;
  await writeFile(join(destination,"release.json"),JSON.stringify({release,commit,candidate:true,skills:catalog.valid.map(({uri,manifest_digest})=>({uri,manifest_digest}))},null,2)+"\n");
  await writeFile(join(destination,"aliases.json"),"{}\n");
  return {release,skills:catalog.valid.length,destination};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const destination=join(repo,"eval/out/candidate");
  await rm(destination,{recursive:true,force:true});
  console.log(JSON.stringify(await materializeCandidate(destination)));
}
