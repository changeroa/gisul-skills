import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
const project=process.argv[2];
if(!/^[a-z0-9]+$/.test(project??""))throw new Error("Usage: install-quality-schedule.mjs <Langfuse project ID>");
if(process.platform!=="darwin"||Intl.DateTimeFormat().resolvedOptions().timeZone!=="Asia/Seoul")throw new Error("This schedule is for macOS with Asia/Seoul system timezone");
const repo=fileURLToPath(new URL("..",import.meta.url)),label="com.iyendev.langfuse-quality",domain=`gui/${process.getuid()}`;
const target=join(homedir(),"Library/LaunchAgents",label+".plist"),logs=join(repo,"eval/out/quality");
await mkdir(logs,{recursive:true});await mkdir(join(homedir(),"Library/LaunchAgents"),{recursive:true});
const xml=value=>value.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
const args=[process.execPath,join(repo,"scripts/langfuse-quality.mjs"),"--project",project,"--tz","Asia/Seoul"];
const content=`<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict><key>Label</key><string>${label}</string><key>ProgramArguments</key><array>${args.map(x=>`<string>${xml(x)}</string>`).join("")}</array><key>WorkingDirectory</key><string>${xml(repo)}</string><key>StartCalendarInterval</key><dict><key>Hour</key><integer>9</integer><key>Minute</key><integer>0</integer></dict><key>StandardOutPath</key><string>${xml(join(logs,"schedule.stdout.log"))}</string><key>StandardErrorPath</key><string>${xml(join(logs,"schedule.stderr.log"))}</string></dict></plist>\n`;
let previous;try{previous=await readFile(target,"utf8");}catch(error){if(error.code!=="ENOENT")throw error;}
if(previous&&previous!==content)await writeFile(`${target}.backup-${Date.now()}`,previous,{mode:0o600});
await writeFile(target,content,{mode:0o600});
execFileSync("plutil",["-lint",target],{stdio:"inherit"});
let loaded=false;try{execFileSync("launchctl",["print",`${domain}/${label}`],{stdio:"pipe"});loaded=true;}catch{}
if(loaded&&previous!==content){execFileSync("launchctl",["bootout",`${domain}/${label}`],{stdio:"pipe"});loaded=false;}
if(!loaded)execFileSync("launchctl",["bootstrap",domain,target],{stdio:"pipe"});
execFileSync("launchctl",["print",`${domain}/${label}`],{stdio:"pipe"});
console.log(JSON.stringify({installed:true,label,path:target,schedule:"daily 09:00 Asia/Seoul",canonical_repo:repo,behavior:"Read-only previous-day quality audit; no model execution or external writes"}));
