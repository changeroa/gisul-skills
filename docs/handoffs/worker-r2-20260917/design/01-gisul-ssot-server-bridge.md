# 01. gisul SSOT · 서버 · 브리지 · 배포

목표: 스킬 콘텐츠의 편집 원본을 Git 하나로 만들고, Mac mini가 검증된 release 스냅샷을 서빙하며, 각 기기의 브리지가 어떤 release·digest를 읽었는지 기록하게 한다. 기존 `skill://gisul/gisul/...` URI는 깨뜨리지 않는다.

**2026-09-17 구현 정정:** 운영은 `~/gisul/current -> releases/<id>` 링크 하나로 skills·release.json·aliases.json을 함께 전환한다. 아래 초기안의 개별 링크 교체는 일시적으로 서로 다른 release를 가리킬 수 있어 채택하지 않았다. current가 있는 서버는 legacy native roots를 제외하고, live create/update를 거부한다. 편집은 private Git 초안에서 하고 검증·커밋 후 명시적으로 승격한다. 기존 원본은 복구용으로 보존했다. `GISUL_SKILL_ROOTS` 구분자는 플랫폼과 무관하게 세미콜론이다.

## 현재 상태 (확인됨)

```text
코드:    ~/dev-tools/gisul (git, main f80ff98)  ──(수동 복사, 파이프라인 없음)──▶  macmini:/Users/iyen/gisul/server  (2커밋 뒤)
콘텐츠:  macmini:~/gisul/skills (3개, git 아님) + macmini:~/.codex/skills (51개 중 28개 유효, git 아님)
클라이언트: ~/.codex/plugins/cache/personal/gisul/0.1.0+codex.20260908084946 (offset 없는 옛 브리지)
```

## 1. 저장소 구성

두 저장소로 나눈다. 코드와 콘텐츠는 변경 주기·검토자·롤백 단위가 다르다.

| 저장소 | 내용 | 이미 있음 |
| --- | --- | --- |
| `changeroa/gisul` | server, bridge(codex.ts), worker, clients, ops, **deploy 스크립트(신설)** | 예 |
| `gisul-skills` (private, 신설) | `skills/<name>/SKILL.md`, `projects/*.yaml`, `policies/*.md`, `releases/` 기록, `catalog.json` 생성물 | 아니오 |

`gisul-skills` 레이아웃:

```text
gisul-skills/
├── skills/
│   ├── linear-delivery/        # 03번 설계
│   ├── agent-improvement/      # 05번 설계
│   ├── aside-browser/          # macmini ~/gisul/skills 에서 이관
│   ├── herdr-orchestrator/
│   └── archify/
├── projects/arkpoint.yaml      # 식별자와 정책 위치, 비밀값 없음 (03번)
├── policies/arkpoint-delivery.md
├── releases/CHANGELOG.md       # release id ↔ commit ↔ 평가 run 링크
├── scripts/
│   ├── validate.mjs            # 카탈로그 검증 (아래 3절)
│   └── build-release.mjs       # 스냅샷 + release.json 생성
└── .github/workflows/validate.yml
```

**결정(2026-09-16):** `~/.codex/skills`의 유효한 28개는 전부 `skills/`로 이관한다. ouroboros-* 23개는 삭제한다(macmini `~/.codex/skills/ouroboros-*`). 삭제 전에 OpenClaw가 native 스킬로 참조하는지 `grep -r ouroboros ~/.openclaw ~/.codex/config.toml`로 확인하고, 참조가 있으면 먼저 끊는다.

## 2. URI 호환과 서빙 루트

현재 서버는 `GISUL_SKILLS_DIRS`를 쓰면 root id가 `root0`, `root1`로 바뀌어 기존 URI가 깨진다. 서버에 **id를 지정하는 새 env**를 추가한다.

```text
GISUL_SKILL_ROOTS="gisul=/Users/iyen/gisul/skills;codex=/Users/iyen/.codex/skills"
```

- 형식 `id=dir`, `path.delimiter` 구분. 기존 `GISUL_SKILLS_DIRS`는 그대로 두되 deprecated로 문서화한다.
- 파서 위치: `server/src/index.ts`의 `SKILL_ROOTS` 상수 계산부. 테스트: `server/test/skills-extension.test.mjs`에 id 지정 케이스 추가.

이관 후 URI 정책:

| 스킬 출처 | 현재 URI | 이관 후 URI | 처리 |
| --- | --- | --- | --- |
| `~/gisul/skills` 3개 | `skill://gisul/gisul/<name>/SKILL.md` | 동일 | 변경 없음 |
| 채택한 codex 루트 스킬 | `skill://gisul/codex/<name>/SKILL.md` | `skill://gisul/gisul/<name>/SKILL.md` | `aliases.json`으로 옛 URI → 새 URI |
| 미채택 codex 루트 스킬 | `skill://gisul/codex/<name>/SKILL.md` | 서빙 제외 | `skills/get` 404 |

`aliases.json`은 서빙 루트 옆(`~/gisul/aliases.json`)에 두고 `skills/get`이 요청 URI가 alias면 새 entry를 반환하면서 `_meta.movedFrom`을 채운다. 브리지는 `load_skill` 응답에 `movedFrom`을 그대로 노출해 모델이 새 URI를 쓰도록 한다. alias는 release 두 번 뒤에 제거한다.

## 3. 검증과 release 빌드

`scripts/validate.mjs` (gisul-skills 저장소, CI와 배포 전 실행):

- 서버와 **같은 규칙**으로 판정한다: frontmatter `name`·`description` 필수, `name == dirname`, 512파일/16MiB 한도, 심볼릭링크 하위 미탐색. 규칙은 서버 코드를 import하지 않고 문서화된 사양으로 재구현하되, 판정 결과를 서버의 `skills/list`와 대조하는 통합 테스트를 둔다.
- 출력: `{ valid: [...], invalid: [{dir, reason}], total }`. invalid가 1개라도 있으면 exit 1.
- 추가 검사: description 길이(≤ 1,024자), 한국어·영어 키워드 존재(경고), references 링크 유효성.

`scripts/build-release.mjs`:

```text
입력:  현재 commit (clean tree 필수)
출력:  dist/<release-id>/            # skills/ 전체 복사본 + projects/ + policies/
       dist/<release-id>/release.json
release-id: YYYYMMDD.N  (예 20260916.1)
```

`release.json`:

```json
{
  "release": "20260916.1",
  "commit": "abc1234",
  "created_at": "2026-09-16T05:00:00Z",
  "skills": [
    { "name": "linear-delivery", "uri": "skill://gisul/gisul/linear-delivery/SKILL.md",
      "manifest_digest": "sha256:…" }
  ]
}
```

`manifest_digest`는 해당 스킬의 `{uri, digest, size}` 목록을 URI 순으로 직렬화한 값의 SHA-256이다. 서버가 계산하는 파일별 digest와 동일한 입력을 쓰므로 서버 `skills/get` 결과에서 재계산해 대조할 수 있다.

## 4. Mac mini 서빙 구조

```text
/Users/iyen/gisul/
├── releases/
│   ├── 20260916.1/   ← rsync 로 배치, 읽기 전용
│   └── 20260917.1/
├── skills -> releases/20260917.1/skills      # 서빙 루트. 심볼릭링크 교체 = 배포, 되돌림 = 롤백
├── release.json -> releases/20260917.1/release.json
└── aliases.json
```

- 서버 walker는 루트 **내부**의 심볼릭링크는 따라가지 않지만 루트 자체가 링크인 것은 문제없다(`readdir(root)`가 대상 디렉터리를 읽음). 통합 테스트로 확인한다.
- 교체는 `ln -sfn` 후 `mv -T` 대신 macOS이므로 `ln -sfn releases/X/skills skills.tmp && mv skills.tmp skills`로 원자 교체한다.
- 서버는 시작 시와 `skills/list`마다 `release.json`을 읽어 응답 `_meta`에 넣는다(5절).

## 5. 서버 변경 (changeroa/gisul, `server/src/index.ts`)

| 변경 | 위치 | 이유 |
| --- | --- | --- |
| `GISUL_SKILL_ROOTS` id=dir 파서 | `SKILL_ROOTS` 상수 | URI 호환 (2절) |
| manifest 캐시: `(path, mtimeMs, size)` 키로 파일 digest를 메모리에 유지, 변경된 파일만 재해싱 | `buildSkillEntry` | 현재 `skills/list`·`get` 호출마다 전 파일(archify 8.29MB 포함)을 다시 읽어 해싱 |
| `skills/get`을 URI → 디렉터리 직접 해석 후 단일 entry 생성 | `registerSkillsExtension`의 get 핸들러 | 현재 전체 목록을 만든 뒤 find |
| `skills/list`, `skills/get` 응답에 `_meta: { release, commit, server_version }` | 동일 | 브리지·trace가 실제 적용 버전을 알기 위함 |
| `aliases.json` 처리 (`_meta.movedFrom`) | get 핸들러 | 2절 |
| 검색 보조: frontmatter `keywords: [..]`(배열)가 있으면 `skills/list`가 그대로 전달 | 변경 없음 (verbatim frontmatter) | 브리지 haystack에 포함 (6절) |
| stderr 로그에 요청별 `{method, uri, client_name, elapsed_ms}` JSON 한 줄 | 각 핸들러 | Mac mini 공용 로그에서 호출 상관관계 |

캐시 무효화: 심볼릭링크 교체로 루트 realpath가 바뀌면 캐시를 전부 버린다(`fs.realpath(root)`를 키에 포함).

## 6. 브리지 변경 (`server/src/codex.ts`)

**응답 확장**

- `load_skill` → `{ uri, release, commit, manifest_digest, changed, movedFrom?, markdown, files }`. `files`는 현재처럼 전체 URI 목록이되, 20개를 넘으면 `references/`·`scripts/` 등 디렉터리 단위로 접고 `read_skill_file`이 디렉터리 URI를 받으면 `resources/directory/read`로 펼친다(큰 스킬의 목록 비용 절감).
- `search_skills` haystack에 `frontmatter.keywords` 포함. 정렬은 URI 순 유지(재현성).

**연결 수명**

- 업스트림 transport `close`/`error` 시 상태를 `disconnected`로 두고, 다음 도구 호출에서 **최대 3회, 1s·3s·9s 백오프**로 재연결을 시도한다. 성공하면 `loaded` map의 각 entry를 `skills/get`으로 다시 받아 `resources` 비교 → 달라졌으면 `changed: true`를 다음 `read_skill_file`에서 알린다.
- 실패 시 구조화 오류: `{ code: "gisul_disconnected" | "gisul_upstream_outdated" | "gisul_verification_failed" | "gisul_not_loaded", message, origin }`. 로더 스킬은 이 code로 "연결 실패를 정확히 보고하고 독립 작업은 계속" 규칙을 적용한다.
- 현재 9월 16일의 `Not connected` 원인은 아직 미확인이다. 재연결 구현 전에 **재현 절차**를 먼저 만든다: 브리지를 띄운 채 macmini `sshd`를 재시작 / 노트북 절전 복귀 / 30분 유휴, 각 경우의 stderr를 수집한다.

**이벤트 로그** (04번 설계가 소비)

경로 `${CODEX_HOME:-~/.codex}/logs/gisul/events-<YYYYMMDD>.jsonl`, 한 줄 한 이벤트:

```json
{"ts":"2026-09-16T05:12:03.412Z","origin":"macmini","connection_id":"c_1758000000_4132",
 "event":"load_skill","uri":"skill://gisul/gisul/linear-delivery/SKILL.md",
 "release":"20260916.1","manifest_digest":"sha256:…","changed":false,"bytes":6120,"elapsed_ms":180}
```

event 종류: `connect`, `disconnect`, `reconnect`, `search`(query, total, returned), `load_skill`, `read_skill_file`, `error`(code). `connection_id`는 `c_<시작 epoch>_<pid>`. Codex session id는 MCP 프로세스가 알 수 없으므로 exporter가 시간 창과 cwd로 조인한다(04번 3절).

## 7. 배포 파이프라인 (changeroa/gisul에 추가)

`scripts/deploy-macmini.sh [ssh-host]`:

1. `cd server && npm ci && npm run build && npm test`
2. `rsync -a --delete server/dist server/bin server/package.json <host>:/Users/iyen/gisul/server/` 후 원격 `npm ci --omit=dev`
3. `launchctl kickstart -k gui/$(id -u)/com.iyendev.gisul-mcp` (원격)
4. smoke: `ssh <host> gisul` stdio로 `initialize` → `skills/list` → `_meta.release` 출력. HTTP도 `curl 127.0.0.1:8788/healthz`.
5. 로컬 플러그인 갱신: `node clients/codex/install.mjs --plugin` 이 `~/.codex/plugins/cache/personal/gisul/<new version>/`에 `runtime/codex.mjs`를 재빌드해 배치하고 `config.toml`의 `plugins."gisul@personal"`이 새 버전을 가리키는지 확인한다. 현재 install.mjs는 `codex mcp add` 경로만 지원하므로 플러그인 캐시 경로를 추가 구현한다.

`scripts/release-skills.sh <release-id>` (gisul-skills):

1. `validate.mjs` → `build-release.mjs`
2. `rsync -a dist/<id>/ macmini:/Users/iyen/gisul/releases/<id>/`
3. 원격에서 심볼릭링크 원자 교체, `skills/list`로 `_meta.release == <id>` 확인
4. `releases/CHANGELOG.md`에 `<id> | <commit> | 평가 run 링크(있으면)` 추가 후 commit·tag `release/<id>`

롤백: `ssh macmini 'cd ~/gisul && ln -sfn releases/<prev>/skills skills.tmp && mv skills.tmp skills'`.

## 8. 수용 기준

- [ ] `~/dev-tools/gisul` main을 배포한 뒤 `search_skills`가 `nextOffset`을 반환한다 (드리프트 해소의 증거).
- [ ] `skills/list` `_meta.release`가 `release.json`과 일치하고, 심볼릭링크를 이전 release로 되돌리면 값이 바뀐다.
- [ ] 이관한 스킬의 옛 URI로 `load_skill`하면 `movedFrom`이 채워진 새 entry가 온다.
- [ ] `validate.mjs`의 invalid 목록과 서버 stderr의 "Skipping skill" 목록이 동일하다.
- [ ] archify가 포함된 카탈로그에서 두 번째 `skills/list` 지연이 첫 번째의 20% 이하다 (캐시 효과, 수치는 측정 후 조정).
- [ ] sshd 재시작 후 다음 `load_skill`이 재연결 로그와 함께 성공한다.
- [ ] `events-*.jsonl`에 connect/search/load 이벤트가 기록된다.

## 결정됨 (2026-09-16)

- 저장소 이름 `gisul-skills`, private, `changeroa` 계정.
- codex 루트 28개 전부 채택, ouroboros-* 23개 삭제.
- `~/projects/eum-content-studio/dev-tools/gisul` 클론은 삭제 완료. 편집 원본은 `~/dev-tools/gisul` 하나다.
