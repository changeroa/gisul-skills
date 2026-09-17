import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const json = value => ({content:[{type:"text",text:JSON.stringify(value)}]});
export function mockLinear({ fixture, record = async()=>{}, timeoutOnce = false }) {
  const data=structuredClone(fixture), issues=data.issues??[];
  let number=1, timedOut=false;
  const server=new McpServer({name:"linear-evaluation-fixture",version:"1"});
  const register=(name,inputSchema,handler,write=false)=>server.registerTool(name,{description:`Isolated evaluation fixture: ${name}. No external network or real issue changes.`,inputSchema,annotations:{readOnlyHint:!write}},async(args,extra)=>{
    await record({phase:"call",tool:name,args});
    const result=await handler(args);
    await record({phase:"applied",tool:name,result});
    if(name==="save_issue"&&!args.id&&timeoutOnce&&!timedOut){
      timedOut=true;
      await record({phase:"response_lost",tool:name,id:result.id});
      return new Promise((_,reject)=>{extra.signal.addEventListener("abort",()=>reject(new Error("Injected lost response after successful create")),{once:true});});
    }
    return json(result);
  });
  const optional=z.string().optional();
  register("get_workspace",{},()=>data.workspace);
  register("list_projects",{query:optional},({query})=>({projects:data.projects.filter(x=>!query||x.name.toLowerCase().includes(query.toLowerCase())),hasNextPage:false}));
  register("get_project",{query:z.string()},({query})=>{const project=data.projects.find(x=>x.id===query||x.name===query);if(!project)throw new Error("Project not found");return project;});
  register("list_issue_statuses",{team:z.string()},()=>data.statuses);
  register("list_templates",{team:optional,type:optional},()=>({templates:data.templates}));
  register("get_template",{query:z.string()},({query})=>{const found=data.templates.find(x=>x.id===query||x.name===query);if(!found)throw new Error("Template not found");return {...found,description:"Outcome followed by acceptance; omit irrelevant sections."};});
  register("get_issue",{id:z.string(),includeRelations:z.boolean().optional()},({id})=>{const issue=issues.find(x=>x.id===id||x.uuid===id);if(!issue)throw new Error("Issue not found");return issue;});
  register("list_comments",{issueId:optional},({issueId})=>(data.comments??[]).filter(x=>!issueId||x.issueId===issueId));
  register("list_issues",{project:optional,query:optional,parentId:optional,limit:z.number().optional()},({project,query,parentId})=>({issues:issues.filter(x=>(!project||x.projectId===project||x.project===project)&&(!query||x.title.toLowerCase().includes(query.toLowerCase()))&&(!parentId||x.parentId===parentId)),hasNextPage:false}));
  register("save_issue",{id:optional,title:optional,description:optional,project:optional,team:optional,template:optional,state:optional,parentId:optional,blockedBy:z.array(z.string()).optional(),blocks:z.array(z.string()).optional()},args=>{
    let issue=issues.find(x=>x.id===args.id||x.uuid===args.id);
    if(args.id&&!issue)throw new Error("Issue not found");
    if(!issue){
      if(!args.title||!args.team||!args.project||!args.template)throw new Error("Creation requires title, team, project and template");
      const project=data.projects.find(x=>x.id===args.project||x.name===args.project);if(!project)throw new Error("Project not found");
      issue={id:`EVAL-${number++}`,uuid:randomUUID(),url:"https://linear.invalid/evaluation",projectId:project.id,project:project.name,team:args.team,relations:{blocks:[],blockedBy:[]}};issues.push(issue);
    }
    for(const field of ["title","description","parentId","template"])if(args[field]!==undefined)issue[field]=args[field];
    if(args.state){const state=data.statuses.find(x=>x.id===args.state||x.name===args.state);if(!state)throw new Error("State not found");issue.status=state.name;issue.statusType=state.type;}
    for(const field of ["blockedBy","blocks"])if(args[field])issue.relations[field]=[...new Set([...(issue.relations[field]??[]),...args[field]])];
    return issue;
  },true);
  register("send_slack_message",{channel:z.string(),text:z.string()},()=>({sent:false,fixture:true}),true);
  return {server,data};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const file=process.env.EVAL_LINEAR_FIXTURE??fileURLToPath(new URL("fixtures/linear/recorded.json",import.meta.url));
  const log=process.env.EVAL_WRITE_LOG;if(!log)throw new Error("EVAL_WRITE_LOG is required");
  await mkdir(dirname(log),{recursive:true});
  const {server}=mockLinear({fixture:JSON.parse(await readFile(file,"utf8")),timeoutOnce:process.env.EVAL_TIMEOUT_ONCE==="1",record:event=>appendFile(log,JSON.stringify({time:new Date().toISOString(),...event})+"\n",{mode:0o600})});
  await server.connect(new StdioServerTransport());
}
