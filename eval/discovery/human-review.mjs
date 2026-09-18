import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { blindedCompletion } from './grade.mjs';
import { sha256 } from './environment.mjs';

const aggregate=JSON.parse(await readFile(resolve(process.argv[2])));
const out=resolve(process.argv[3]??'eval/out/discovery/human-review-20260918');
await mkdir(out,{recursive:true});
const selection=[['D01','baseline'],['D01','description'],['D02','selective'],['D04','baseline'],['D06','description'],['D07','selective'],['E01','baseline'],['E02','description'],['N05','selective'],['F01','baseline']];
const chosen=selection.map(([caseId,variant])=>aggregate.attempts.find(run=>run.selectedForComparison&&run.caseId===caseId&&run.variant===variant));
assert.ok(chosen.every(Boolean),'All ten selected results must exist');
chosen.sort((a,b)=>sha256('human-v1/'+a.id).localeCompare(sha256('human-v1/'+b.id)));
let markdown='# 자동 탐색 평가: 사람 검토용 10개 답변\n\n후보 이름과 모델 채점은 숨겼습니다. 각 항목의 사용자 요구와 기록된 행동을 기준으로 `통과` 또는 `실패` 및 한 문장 이유를 적어 주세요. 스킬을 읽었다는 사실만으로 가산점을 주지 않습니다. 금지되지 않은 불필요한 검색은 작업 정답 여부와 별도로 판단합니다. 실제 사람의 판정이 없는 항목은 미평가로 남깁니다.\n\n';
const map=[],ratings=[];
for(let index=0;index<chosen.length;index++){
  const entry=chosen[index],id='H'+String(index+1).padStart(2,'0');
  const run=JSON.parse(await readFile(join(entry.phase,'runs',entry.id,'result.json')));
  const cases=JSON.parse(await readFile(join(entry.phase,'scenarios.private.json')));
  const scenario=cases.find(item=>item.id===entry.caseId);
  const output=blindedCompletion(run);
  markdown+='## '+id+'\n\n사용자 요청:\n\n'+scenario.prompts.map(prompt=>'> '+prompt).join('\n\n')+'\n\n평가 기준:\n\n'+scenario.rubric+'\n\n';
  for(const [path,content]of Object.entries(scenario.files))markdown+='입력 파일 `'+path+'`:\n\n```text\n'+content+'\n```\n\n';
  markdown+='답변:\n\n'+output.finalAnswers.join('\n\n후속 답변:\n\n')+'\n\n';
  if(Object.keys(output.files).length)markdown+='최종 파일:\n\n```json\n'+JSON.stringify(output.files,null,2)+'\n```\n\n';
  markdown+='관측된 작업:\n\n```json\n'+JSON.stringify(output.actions,null,2)+'\n```\n\n판정: 미평가\n\n이유: \n\n';
  map.push({humanId:id,runId:entry.id,caseId:entry.caseId,variant:entry.variant});
  ratings.push({humanId:id,pass:null,reason:null,reviewer:null,ratedAt:null});
}
await writeFile(join(out,'REVIEW.md'),markdown.replace(/[ \t]+$/gm,'').trimEnd()+'\n');
await writeFile(join(out,'mapping.private.json'),JSON.stringify(map,null,2)+'\n',{mode:0o600});
await writeFile(join(out,'human-ratings.json'),JSON.stringify(ratings,null,2)+'\n',{mode:0o600});
console.log(JSON.stringify({review:join(out,'REVIEW.md'),count:ratings.length,genuineRatings:0}));
