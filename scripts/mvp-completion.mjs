import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CodexLinear } from './codex-linear.mjs';
import { collectQuality, windowFor } from './langfuse-quality.mjs';
import { langfuseApi } from './langfuse-api.mjs';

export const TARGET = Object.freeze({ project: 'b86d7139-c2bd-4075-b720-20d5f20dcc81', team: 'be395db1-8ee7-4c30-9fe8-f7a2ba8404c5', milestone: '1d58f2aa-52ac-4e1b-a113-284d39930f38', parent: 'IYEN-20', sleep: 'IYEN-25', quality: 'IYEN-36', done: '5a7a8261-4996-40ee-a350-f7f7abdcfd72' });
export const digest = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
export const fingerprint = issue => digest({ title: issue.title, description: issue.description, projectId: issue.projectId, teamId: issue.teamId, parentId: issue.parentId ?? null, milestone: issue.projectMilestone?.id, status: issue.status, relations: issue.relations });
const replaceOnce = (text, before, after) => { assert.equal(text.split(before).length, 2, `Expected one acceptance item: ${before}`); return text.replace(before, after); };
async function atomicJson(path, value) { await writeFile(`${path}.tmp`, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 }); await rename(`${path}.tmp`, path); }
async function json(path) { return JSON.parse(await readFile(path, 'utf8')); }
function scope(issue, parent = TARGET.parent) {
  assert.equal(issue.projectId, TARGET.project, 'Wrong Linear project'); assert.equal(issue.teamId, TARGET.team, 'Wrong Linear team');
  assert.equal(issue.projectMilestone?.id, TARGET.milestone, 'Wrong milestone'); assert.equal(issue.parentId ?? null, parent, 'Wrong parent');
  assert.ok(!issue.archivedAt && !issue.canceledAt, 'Issue archived/canceled');
}
export function qualityEvidence(report, config, now = Date.now()) {
  assert.equal(report.project_id, config.langfuseProject); assert.equal(report.date, config.date); assert.equal(report.timezone, 'Asia/Seoul');
  assert.equal(report.origin, config.langfuseOrigin); assert.equal(report.source, 'observations-v2-logical-roots');
  assert.deepEqual(report.window, windowFor(config.date, 'Asia/Seoul'));
  assert.ok(report.complete === true && report.full_day === true && Date.parse(report.window.to) <= now, 'Calendar day is not complete');
  assert.ok(Date.parse(report.generated_at) >= Date.parse(config.notBefore) && Date.parse(report.generated_at) <= now, 'Stale/future report');
  const gate = report.gates?.e14_codex_duplicate_free;
  assert.equal(gate?.checkpoint_schema, 2); assert.equal(gate?.passed, true); assert.ok(gate.roots > 0 && gate.identified_turns > 0, 'No production population');
  for (const key of ['unknown_turn_identity', 'duplicate_turn_traces', 'unfinished_codex', 'unattributed_roots', 'repeated_identity_rows']) assert.equal(gate[key], 0, `Failed ${key}`);
  return `${report.date} KST 전체 날짜의 Codex 비합성·비-heartbeat root ${gate.roots}개, 식별된 턴 ${gate.identified_turns}개를 조회했다. 중복·식별자 미상·미완료·producer 미상·반복 행은 모두 0이다. 전체 에이전트 품질 통과 여부는 ${report.passed}이며 E-14의 Codex 중복 기준과 구분한다.`;
}
export function sleepEvidence(text, powerLog, plugin) {
  const events = text.trim().split('\n').map(line => JSON.parse(line));
  const observedIndex = events.findIndex(event => event.event === 'sleep-wake-observed');
  assert.ok(observedIndex >= 0, 'No real sleep/wake observed');
  const prior = events.slice(0, observedIndex), armed = prior.findLast(event => event.event === 'armed');
  assert.equal(armed?.plugin, plugin); assert.ok(!prior.slice(prior.lastIndexOf(armed)).some(event => event.event === 'baseline-lost'));
  const observed = events[observedIndex], after = events.slice(observedIndex + 1);
  assert.equal(observed.sleep.type, 'Sleep'); assert.equal(observed.wake.type, 'Wake');
  assert.ok(Date.parse(observed.sleep.time) >= Date.parse(armed.ts) && Date.parse(observed.wake.time) > Date.parse(observed.sleep.time));
  assert.match(observed.sleep.line, /\sSleep\s+.*Entering Sleep state/); assert.match(observed.wake.line, /\sWake\s+.*(?:Wake from|DarkWake to FullWake)/);
  assert.ok(powerLog.includes(observed.sleep.line) && powerLog.includes(observed.wake.line), 'Power log does not confirm recorded events');
  for (const tool of ['search_skills', 'load_skill']) {
    assert.ok(prior.some(event => event.event === 'call' && event.phase === 'before' && event.tool === tool && event.ok === true));
    assert.ok(after.some(event => event.event === 'call' && event.phase === 'after-existing' && event.tool === tool));
    assert.ok(after.some(event => event.event === 'fresh-connect-failed' || (event.event === 'call' && event.phase === 'after-fresh' && event.tool === tool)));
  }
  assert.ok(after.some(event => event.event === 'finished' && event.scenario_executed === true));
  const calls = after.filter(event => event.event === 'call').map(event => `${event.phase}/${event.tool}: ${event.ok ? '성공' : '실패'}`).join(', ');
  return `실제 시스템 절전 ${observed.sleep.time} → full Wake ${observed.wake.time}를 pmset 원본 로그로 확인했다. ${calls}${after.some(event => event.event === 'fresh-connect-failed') ? ', 새 연결 수립 실패' : ''}. 실패 결과도 재현 기록이며 최초 연결 단절의 원인을 이 결과만으로 단정하지 않는다.`;
}
export function hookEvidence(result, config) {
  assert.equal(result.data?.length, config.hookCwds.length);
  for (const cwd of config.hookCwds) {
    const entry = result.data.find(row => row.cwd === cwd); assert.ok(entry && !entry.errors.length && !entry.warnings.length, 'Hook discovery incomplete');
    const stops = entry.hooks.filter(hook => hook.enabled && hook.eventName === 'stop');
    assert.equal(stops.length, 1, 'Expected exactly one active Stop hook');
    assert.equal(stops[0].pluginId, 'langfuse-masked@personal'); assert.equal(stops[0].trustStatus, 'trusted');
    assert.equal(stops[0].command, config.hookCommand); assert.equal(stops[0].currentHash, config.hookHash);
  }
}
export async function snapshot(api, id) {
  const issue = await api.call('get_issue', { id, includeRelations: true });
  const comments = await api.call('list_comments', { issueId: id, limit: 100 });
  assert.equal(comments.hasNextPage, false, 'Comment pagination requires review');
  return { issue, commentsHash: digest(comments.comments) };
}
export async function completeIssue({ api, id, guard, receipt, evidence, marker, transform, persist, verifyDependencies = true }) {
  assert.ok([TARGET.sleep, TARGET.quality, TARGET.parent].includes(id), 'Writes are limited to three MVP issues');
  const current = await snapshot(api, id); scope(current.issue, id === TARGET.parent ? null : TARGET.parent);
  if (current.issue.statusType === 'completed') return { confirmed: true, alreadyCompleted: true, id };
  // An ambiguous previous write is always read back before any further action, never retried blindly.
  assert.ok(!receipt?.intent, `Unconfirmed previous write for ${id}; manual review required`);
  assert.equal(fingerprint(current.issue), guard.fingerprint, 'Issue changed since authorization snapshot');
  assert.equal(current.commentsHash, guard.commentsHash, 'New issue comments require review');
  if (verifyDependencies) for (const dependency of current.issue.relations.blockedBy) {
    const issue = await api.call('get_issue', { id: dependency.id });
    assert.equal(issue.projectId, TARGET.project); assert.equal(issue.statusType, 'completed', `Dependency ${dependency.id} incomplete`);
  }
  const description = transform(current.issue.description) + `\n\n### 완료 검증\n\n${evidence}\n\n검증 기록: \`${marker}\`.`;
  assert.ok(!/\[ \]/.test(description), 'Unmet acceptance checkbox remains');
  const intent = { id, at: new Date().toISOString(), marker, descriptionHash: digest(description) };
  await persist({ intent });
  let writeError;
  try { await api.call('save_issue', { id, state: TARGET.done, description }); } catch (error) { writeError = String(error); }
  const verified = await snapshot(api, id); scope(verified.issue, id === TARGET.parent ? null : TARGET.parent);
  assert.equal(verified.issue.statusType, 'completed', writeError ?? 'Done not confirmed');
  assert.ok(verified.issue.description.includes(marker) && !/\[ \]/.test(verified.issue.description), 'Completion text not confirmed');
  const result = { intent, confirmed: true, id, url: verified.issue.url, at: new Date().toISOString(), writeError: writeError ?? null };
  await persist(result); return result;
}
export function childrenComplete(issues) {
  assert.equal(issues.length, 14, 'Expected exactly 14 MVP children');
  assert.deepEqual(issues.map(issue => issue.id).sort(), Array.from({ length: 14 }, (_, n) => `IYEN-${n + 23}`).sort());
  for (const issue of issues) { scope(issue); assert.equal(issue.statusType, 'completed', `${issue.id} incomplete`); }
}
async function retireSleepObserver(config) {
  if (!config.sleepObserver) return;
  const { label, plist } = config.sleepObserver;
  assert.equal(label, 'com.iyendev.gisul-sleep-diagnostic-20260917');
  assert.ok(plist.endsWith(`/Library/LaunchAgents/${label}.plist`));
  await rm(plist, { force: true });
  try { execFileSync('/bin/launchctl', ['print', `gui/${process.getuid()}/${label}`], { stdio: 'pipe' }); }
  catch { return; }
  execFileSync('/bin/launchctl', ['bootout', `gui/${process.getuid()}/${label}`], { stdio: 'pipe' });
}
async function run(configFile, preflight) {
  const config = await json(configFile), statePath = join(dirname(configFile), 'state.json');
  assert.equal(config.version, 1); assert.equal(config.project, TARGET.project);
  assert.ok(Number.isFinite(Date.parse(config.notBefore)) && Number.isFinite(Date.parse(config.expiresAt)));
  assert.ok(Date.parse(config.expiresAt) > Date.parse(config.notBefore) && Date.parse(config.expiresAt) - Date.parse(config.createdAt) <= 96 * 3600000, 'Continuation must expire within 96 hours');
  const now = Date.now();
  if (!preflight && now >= Date.parse(config.expiresAt)) { await retireSleepObserver(config); await atomicJson(join(dirname(configFile), 'expired.json'), { at: new Date().toISOString(), reason: 'Bounded continuation expired; inspect state.json' }); return { terminal: true, config }; }
  const lock = `${configFile}.lock`; await mkdir(lock);
  let api;
  try {
    let state; try { state = await json(statePath); } catch (error) { if (error.code !== 'ENOENT') throw error; state = { receipts: {} }; }
    if (state.complete && !preflight) return { terminal: true, config };
    const save = async () => { state.updatedAt = new Date().toISOString(); await atomicJson(statePath, state); };
    const sleepLog = await readFile(config.sleepLog, 'utf8');
    const hasSleep = sleepLog.includes('"event":"finished","scenario_executed":true');
    const qualityDue = now >= Date.parse(config.notBefore);
    if (!preflight && (hasSleep || sleepLog.includes('"event":"observation-timeout"'))) await retireSleepObserver(config);
    if (!preflight && !hasSleep && !qualityDue) { state.waiting = 'Actual sleep/wake and completed calendar day'; await save(); return; }
    api = await new CodexLinear(config.codex, config.cwd).start();
    const statuses = await api.call('list_issue_statuses', { team: TARGET.team });
    assert.ok(statuses.some(status => status.id === TARGET.done && status.type === 'completed'), 'Done state changed');
    if (preflight) {
      const guards = {};
      for (const id of [TARGET.sleep, TARGET.quality, TARGET.parent]) {
        const item = await snapshot(api, id); scope(item.issue, id === TARGET.parent ? null : TARGET.parent);
        guards[id] = { fingerprint: fingerprint(item.issue), commentsHash: item.commentsHash };
      }
      hookEvidence(await api.rpc('hooks/list', { cwds: config.hookCwds }), config);
      assert.equal(digest(await readFile(config.exporterBundle, 'utf8')), config.exporterDigest, 'Exporter bundle changed');
      await atomicJson(join(dirname(configFile), 'preflight.json'), { at: new Date().toISOString(), readOnly: true, modelGeneration: false, guards });
      console.log(JSON.stringify({ preflight: true, guards })); return;
    }
    const finish = async (id, evidence, marker, transform) => {
      const persist = async receipt => { state.receipts[id] = receipt; await save(); };
      state.receipts[id] = await completeIssue({ api, id, guard: config.guards[id], receipt: state.receipts[id], evidence, marker, transform, persist }); await save();
    };
    if (!state.receipts[TARGET.sleep]?.confirmed && hasSleep) {
      try {
        for (const record of config.priorDiagnosticEvidence) assert.equal(digest(await readFile(record.path, 'utf8')), record.digest, 'Prior diagnostic evidence changed');
        const power = execFileSync('/usr/bin/pmset', ['-g', 'log'], { encoding: 'utf8', timeout: 15000, maxBuffer: 32 * 1024 * 1024 });
        const evidence = sleepEvidence(sleepLog, power, config.gisulPlugin);
        const marker = `mvp-e03-${digest(sleepLog)}`;
        await finish(TARGET.sleep, `${evidence}\n\n30분 유휴와 Mac mini 격리 sshd 재시작은 기존 기록으로 검증했다. 공유 macOS SSH 서비스 재시작은 실행하지 않았다. 증거: \`${config.sleepLog}\`.`, marker, description => replaceOnce(description, '[ ] sshd 재시작, 절전 복귀, 30분 유휴 각각의 재현 절차를 실행하고 브리지 stderr를 수집한다.', '[X] sshd 재시작, 절전 복귀, 30분 유휴 각각의 재현 절차를 실행하고 브리지 stderr를 수집한다.').replace(/### 절전 관찰 대기[\s\S]*?(?=\*\*선행:)/, ''));
        delete state.sleepError;
      } catch (error) { state.sleepError = String(error); await save(); }
    }
    if (!state.receipts[TARGET.quality]?.confirmed && qualityDue) {
      try {
        const report = await collectQuality({ api: await langfuseApi(), projectId: config.langfuseProject, date: config.date, tz: 'Asia/Seoul', out: config.qualityOut });
        const evidence = qualityEvidence(report, config);
        hookEvidence(await api.rpc('hooks/list', { cwds: config.hookCwds }), config);
        assert.equal(digest(await readFile(config.exporterBundle, 'utf8')), config.exporterDigest, 'Exporter bundle changed');
        await finish(TARGET.quality, `${evidence}\n\n설치된 exporter와 단일 trusted Stop 훅을 다시 확인했다. 보고서: \`${join(config.qualityOut, `${config.date}-Asia-Seoul.json`)}\`.`, `mvp-e14-${digest(report)}`, description => replaceOnce(description, '[ ] 하루치 trace의 중복이 0임을 확인한다.', '[X] 하루치 trace의 중복이 0임을 확인한다.').replace(/### 하루 관찰[\s\S]*?(?=\*\*선행:)/, ''));
        delete state.qualityError;
      } catch (error) { state.qualityError = String(error); await save(); }
    }
    if (state.receipts[TARGET.sleep]?.confirmed && state.receipts[TARGET.quality]?.confirmed) {
      try {
        const page = await api.call('list_issues', { parentId: TARGET.parent, project: TARGET.project, includeArchived: true, limit: 100 });
        assert.equal(page.hasNextPage, false); childrenComplete(page.issues);
        await finish(TARGET.parent, 'MVP 하위 14개 티켓을 Linear API로 다시 조회해 모두 완료됨을 확인했다. E-03 실제 절전 재현과 E-14 완료된 하루의 Codex 중복 0 검증 기록은 각 하위 티켓에 있다.', 'mvp-all-14-verified-20260917', description => replaceOnce(description, '[ ] MVP 하위 14개 작업의 수용 기준을 충족한다.', '[X] MVP 하위 14개 작업의 수용 기준을 충족한다.').replace(/### 현재 상태[^\n]*[\s\S]*?(?=\*\*PR:)/, '### 완료 상태\n\nMVP 하위 14개 작업을 완료했다. 배포 버전과 검증 결과는 각 하위 티켓에 기록했다.\n\n'));
        state.complete = true; delete state.parentError; await save();
      } catch (error) { state.parentError = String(error); await save(); }
    }
    console.log(JSON.stringify(state));
    return { terminal: state.complete === true, config };
  } finally { await api?.close(); await rm(lock, { recursive: true }); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.ok(process.argv[2], 'Usage: node mvp-completion.mjs <bounded-manifest.json> [--preflight]');
  const result = await run(resolve(process.argv[2]), process.argv.includes('--preflight'));
  if (result?.terminal && result.config.launchAgent) {
    const { label, plist } = result.config.launchAgent;
    assert.equal(label, 'com.iyendev.dev-tools-mvp-completion-20260917');
    assert.ok(plist.endsWith(`/Library/LaunchAgents/${label}.plist`));
    await rm(plist, { force: true });
    await atomicJson(join(dirname(resolve(process.argv[2])), 'schedule-finished.json'), { at: new Date().toISOString(), label, plistRemoved: true });
    // All evidence and locks are finalized before this unload can terminate the process.
    execFileSync('/bin/launchctl', ['remove', label], { stdio: 'ignore' });
  }
}
