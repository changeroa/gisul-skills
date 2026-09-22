import { execFile } from "node:child_process";
import { copyFile, lstat, mkdir, readFile, readdir, realpath, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const exec = promisify(execFile);
const evalRoot = fileURLToPath(new URL(".", import.meta.url));
const hiddenKeys = /^(?:expected(?:_.*)?|rubric(?:_.*)?|split|case[_-]?id|answers?)$/i;
const within = (parent, child) => {
  const path = relative(parent, child);
  return path === "" || (!isAbsolute(path) && path !== ".." && !path.startsWith(`..${sep}`));
};

function inputOnly(value) {
  if (Array.isArray(value)) return value.map(inputOnly);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).filter(([key]) => !hiddenKeys.test(key)).map(([key, entry]) => [key, inputOnly(entry)]));
  }
  return value;
}

function applyScenario(fixture, key, scenario) {
  const project = fixture.projects[0];
  const base = fixture.issues[0];
  const issue = (id, title, description, facts = {}, state = "진행 중") => {
    const status = fixture.statuses.find(entry => entry.name === state);
    return {
      ...base, id, uuid: `fixture-${id.toLowerCase()}`, title, description,
      url: `https://linear.invalid/evaluation/issue/${id}`, parentId: null,
      status: status.name, statusType: status.type,
      relations: { blocks: [], blockedBy: [], relatedTo: [], duplicateOf: null }, ...facts,
    };
  };
  fixture.comments = [];
  if (key === "L-03") {
    fixture.issues = [issue("IYEN-301", "dev-tools 배포 후 실사용 흐름 검증", "구현 및 배포 완료. 실사용 흐름 검증은 아직 수행하지 않음.", scenario)];
  } else if (key === "L-04") {
    const parent = issue("IYEN-400", "권한 변경 전달 작업", "기획 결정과 개발 작업을 포함하는 상위 전달 작업.", { kind: "delivery" });
    const decision = issue("IYEN-401", "타인 작업 열람 권한 결정", "모든 질문의 합의가 완료됨. 연결된 개발 이슈는 아직 열려 있음.", { ...scenario, kind: "decision", parentId: parent.id });
    const development = issue("IYEN-402", "합의된 권한 개발 작업", "기획 결정과 연결된 개발 작업. 구현 및 검증은 아직 완료되지 않음.", { kind: "development", parentId: parent.id }, "착수 가능");
    decision.relations.relatedTo = [{ id: development.id, title: development.title }];
    development.relations.relatedTo = [{ id: decision.id, title: decision.title }];
    fixture.issues = [decision, development, parent];
  } else if (key === "L-05") {
    const { comments, ...facts } = scenario;
    const target = issue("IYEN-501", "dev-tools 체크리스트 완료 작업", "기존 수용 조건\n\n- [x] 기존 체크리스트 전체 완료", facts);
    fixture.issues = [target];
    fixture.comments = (comments ?? []).map((comment, index) => ({ ...comment, id: `fixture-comment-${index + 1}`, issueId: target.id }));
  } else if (key === "L-06") {
    fixture.projects = [{ ...project, automatic_notifications: scenario.automatic_notifications }];
    fixture.issues = [issue("IYEN-601", "dev-tools 완료 조건 검증 작업", "수용 조건, 배포 및 실사용 흐름 검증 완료. 상태 변경 자동 알림이 켜져 있음.", scenario, "검증·배포 대기")];
  } else if (key === "L-07") {
    fixture.workspace = scenario.actual_workspace;
    fixture.projects = [{ ...scenario.actual_project, workspaceId: scenario.actual_workspace.id, teams: [] }];
    fixture.issues = [{
      id: "OTHER-1", uuid: "fixture-foreign-issue", title: "Foreign workspace 작업",
      url: "https://linear.invalid/foreign/issue/OTHER-1", project: scenario.actual_project.name,
      projectId: scenario.actual_project.id, workspaceId: scenario.actual_workspace.id,
      description: "Foreign workspace의 dev-tools 프로젝트에 속한 이슈.",
      status: "Open", statusType: "unstarted", parentId: null,
      relations: { blocks: [], blockedBy: [], relatedTo: [], duplicateOf: null },
    }];
    fixture.statuses = [];
    fixture.templates = [];
  }
  return fixture;
}

async function copyInputs(source, target, root, paths) {
  const info = await lstat(source);
  if (info.isSymbolicLink()) throw new Error(`Fixture symlinks are not supported: ${source}`);
  if (info.isDirectory()) {
    await mkdir(target, { recursive: true });
    for (const name of (await readdir(source)).sort()) await copyInputs(join(source, name), join(target, name), root, paths);
  } else if (info.isFile()) {
    await mkdir(dirname(target), { recursive: true });
    await copyFile(source, target);
    paths.push(relative(root, target).split(sep).join("/"));
  } else {
    throw new Error(`Unsupported fixture input: ${source}`);
  }
}

/** Prepare one fresh task directory; the caller must sandbox it away from privateDir. */
export async function prepareCase({ item, workspace, privateDir }) {
  if (typeof item?.input?.prompt !== "string" || !Array.isArray(item.input.fixtures)) throw new Error("Case input prompt and fixtures are required");
  if (typeof workspace !== "string" || typeof privateDir !== "string") throw new Error("workspace and privateDir paths are required");
  const taskPath = resolve(workspace), privatePath = resolve(privateDir);
  if (within(taskPath, privatePath)) throw new Error("privateDir must be outside the task workspace");
  const fixtures = item.input.fixtures.map(path => {
    if (typeof path !== "string" || !/^fixtures\//.test(path) || path.split(/[\\/]/).includes("..") || path.includes("\\")) throw new Error("Unsafe fixture path");
    if (path !== "fixtures/scenarios.json" && path !== "fixtures/linear/recorded.json" && path !== "fixtures/workspace" && !path.startsWith("fixtures/workspace/")) throw new Error(`Unsupported input fixture: ${path}`);
    return path;
  });
  await mkdir(taskPath, { recursive: true });
  await mkdir(privatePath, { recursive: true, mode: 0o700 });
  const root = await realpath(taskPath), privateRoot = await realpath(privatePath);
  if (within(root, privateRoot)) throw new Error("privateDir must be outside the task workspace (including symlinks)");
  if ((await readdir(root)).length) throw new Error("Task workspace must be empty");
  const key = item.input.scenario;
  const scenarios = fixtures.includes("fixtures/scenarios.json") ? JSON.parse(await readFile(join(evalRoot, "fixtures/scenarios.json"), "utf8")) : {};
  const scenario = inputOnly(Object.hasOwn(scenarios, key) ? scenarios[key] : {});
  const inputFiles = [];
  for (const path of fixtures.filter(path => path === "fixtures/workspace" || path.startsWith("fixtures/workspace/"))) {
    await copyInputs(join(evalRoot, path), join(root, relative("fixtures", path)), root, inputFiles);
  }
  await writeFile(join(root, "scenario.json"), JSON.stringify(scenario, null, 2) + "\n", { flag: "wx" });
  inputFiles.push("scenario.json");
  const fixture = fixtures.includes("fixtures/linear/recorded.json")
    ? JSON.parse(await readFile(join(evalRoot, "fixtures/linear/recorded.json"), "utf8"))
    : { workspace: {}, projects: [], issues: [], statuses: [], templates: [] };
  if (fixtures.includes("fixtures/linear/recorded.json")) applyScenario(fixture, key, scenario);
  const linearFixture = join(privateRoot, "linear.json");
  await writeFile(linearFixture, JSON.stringify(inputOnly(fixture), null, 2) + "\n", { mode: 0o600, flag: "wx" });
  await exec("git", ["-c", "init.templateDir=", "init", "--quiet", root], { cwd: root });
  return {
    prompt: item.input.prompt, linearFixture,
    timeoutOnce: key === "L-08" && scenario.inject === "successful_create_then_lost_response",
    offlineGisul: key === "S-10" && scenario.gisul_error === "Not connected",
    inputFiles: [...new Set(inputFiles)].sort(),
    limitations: key === "F-02" ? ["F-02 has no browser-specific fixture; this run cannot establish live login-to-editor flow verification."] : [],
  };
}
