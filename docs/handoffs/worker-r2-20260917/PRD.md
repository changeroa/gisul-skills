# PRD: 에이전트 개발 환경 (gisul · 지침 계층 · 관측 · 평가)

작성 2026-09-16. 상세 설계는 [design/](design/README.md) 8편을 원본으로 하고, 이 문서는 범위·순서·완료 조건·티켓 단위를 정한다. 제품 기능이 아니라 **개인 개발 환경 세팅**이며, Linear 티켓은 `personal` 프로젝트에 발행한다.

## 1. 배경

세 기기(macbook-pro, macmini + OpenClaw, macbook-air)에서 Codex·Claude Code·OpenClaw가 같은 업무 절차를 따르게 하려고 Mac mini에 gisul(원격 스킬 MCP 서버)을 두고 Langfuse로 세션을 수집해 왔다. 9월 15일 Langfuse 분석과 9월 16일 Mac mini SSH 감사에서 다음이 확인됐다.

- 스킬 콘텐츠의 편집 원본이 Git에 없다. Mac mini의 `~/gisul/skills` 3개와 `~/.codex/skills` 51개(유효 28, ouroboros-* 23개는 이름 불일치로 서빙 제외)가 그대로 서빙된다.
- 서버·브리지 코드의 Git 원본(`changeroa/gisul`, 로컬 `~/dev-tools/gisul`)은 있으나 배포 파이프라인이 없어 Mac mini 배포본과 플러그인 캐시가 main보다 2커밋 뒤다.
- 브리지는 재연결이 없고, 로드한 스킬의 버전(digest·release)을 응답에도 trace에도 남기지 않는다. 9월 16일 세션에서 `Not connected`가 발생했고 원인은 미확인이다.
- Langfuse 수집은 같은 턴이 다른 trace id로 중복 저장되고(112→96), 최상위 입출력이 빈 trace가 282/394다.
- 전역 AGENTS.md(4,148 bytes)에 ARK Point 고정값·Herdr 지시·긴 도구 규칙이 섞여 있고, 9월 15일 실패(계약 단정, 완료 오판, 계정 오판, 설명 방식)에 대한 개선 후보는 평가 수단 없이 문장 추가로만 제안돼 있다.

## 2. 목표

1. 스킬 콘텐츠와 코드 각각이 Git 원본 하나에서 검증된 release로 배포되고, 어느 기기의 세션이든 어떤 release·digest를 읽었는지 trace에 남는다.
2. 시작 컨텍스트는 짧은 공통 원칙과 발견 규칙만 담고, 업무 절차·프로젝트 정책·기기 설정은 각자의 원본에서 필요할 때 읽힌다.
3. 지침·스킬·환경 변경 후보를 고정 사례집에서 baseline과 비교한 뒤에만 배포한다. 규칙 삭제도 같은 절차로 평가한다.
4. 수집 데이터가 중복·결측 없이 일일 품질 검사를 통과한다.

## 3. 비목표

- Orbs류 원격 실행 플랫폼, 벡터 검색, 자동 승격, 멀티에이전트 스케줄러. 측정된 필요가 생기면 별도 PRD.
- ARK Point 등 특정 제품의 기능 개발. 제품 저장소에 손대는 작업은 중기의 `project-runtime` 적용 티켓에서만 다룬다.
- Langfuse Prompt Management에 스킬 사본을 두는 것. 스킬 원본은 gisul-skills 하나다.

## 4. 확정 결정 (2026-09-16)

| 항목 | 결정 |
| --- | --- |
| 콘텐츠 저장소 | `changeroa/gisul-skills`, private |
| 이관 범위 | Mac mini `~/gisul/skills` 3개 + `~/.codex/skills` 유효 28개 전부 채택. ouroboros-* 23개 삭제 |
| 코드 원본 | `~/dev-tools/gisul` 하나. 두 번째 클론은 삭제 완료 |
| Linear 워크플로 | 팀에 `Verifying` 상태 추가, GitHub 연동 병합→Done을 병합→In Review로 변경 |
| 성격·티켓 위치 | 개발 환경 세팅. 티켓은 Linear `personal` 프로젝트 |
| 프로젝트 실행 경로 | 템플릿(`project-runtime`)으로 만들고 적용 대상은 중기에 선정 |

## 5. 사용자

- 주 사용자: 본인(victor). 세 기기에서 Codex CLI, Claude Code, OpenClaw를 번갈아 사용.
- 부 사용자: Herdr pane 안의 위임 에이전트들. 같은 전역 지침과 gisul을 읽는다.

## 6. 범위와 단계

각 티켓 ID는 `E-`(환경) 접두사. 순서는 의존성 순이며 같은 그룹 안에서는 병렬 가능. 상세 절차와 스키마는 괄호의 설계 문서 절을 따른다.

### 6.1 MVP (약 2주) — 드리프트 제거, 콘텐츠 SSOT, 버전이 보이는 로드

완료 정의: fresh Codex가 새 브리지로 Mac mini의 release 스냅샷에서 스킬을 로드하고, `load_skill` 응답에 release·digest가 있으며, 그 값이 Langfuse trace metadata에 남는다.

| ID | 작업 | 수용 기준 | 의존 | 설계 |
| --- | --- | --- | --- | --- |
| E-01 | `deploy-macmini.sh` 작성: build·test → rsync(server.bak 생성) → launchd 재시작 → stdio/HTTP smoke | `search_skills`가 `nextOffset` 반환. 스크립트 재실행 시 멱등 | — | 01 §7 |
| E-02 | 플러그인 캐시 설치 경로 지원: `clients/codex/install.mjs --plugin`이 `~/.codex/plugins/cache/personal/gisul/<ver>/runtime/codex.mjs` 재빌드·배치 | `codex mcp list`에 새 버전, fresh 세션에서 `search_skills` 정상 | E-01 | 01 §7 |
| E-03 | Worker HTTPS 엔드포인트로 Codex upstream 전환·검증 | 실제 URL·계정·인증 확인, 설치본 검색/로드/파일 읽기와 release·digest·이벤트 검증, 원본 일시 중단 후 재호출 검증 | E-02 | 01 §6; 아래 9/17 변경 |
| E-04 | `gisul-skills` 저장소 생성(private) + Mac mini 3개 스킬 + codex 루트 28개 이관 + ouroboros-* 23개 삭제(OpenClaw 참조 확인 후) | `validate.mjs` invalid 0, 서버 stderr "Skipping" 0 | — | 01 §1 |
| E-05 | `scripts/validate.mjs`: 서버와 같은 규칙(name==dirname, frontmatter 필수, 512/16MiB, symlink 미탐색) + description 길이·한영 키워드 경고 + GitHub Actions | CI 통과. invalid 목록이 서버 stderr와 동일함을 통합 테스트로 확인 | E-04 | 01 §3 |
| E-06 | 서버: `GISUL_SKILL_ROOTS` (id=dir) env 추가, 기존 `GISUL_SKILLS_DIRS`는 deprecated | 테스트 케이스 추가, 기존 URI `skill://gisul/gisul/...` 유지 | — | 01 §2, §5 |
| E-07 | 서버: `release.json` 읽어 `skills/list`·`skills/get` 응답 `_meta: {release, commit, server_version}` | smoke에서 `_meta.release` 확인 | E-06 | 01 §5 |
| E-08 | 서버: `aliases.json` 처리, `_meta.movedFrom` | 이관한 codex 루트 스킬의 옛 URI로 get 시 새 entry + movedFrom | E-07 | 01 §2 |
| E-09 | `build-release.mjs` + `release-skills.sh`: 스냅샷 생성, `release.json`(manifest_digest), rsync → `releases/<id>/`, 심볼릭링크 원자 교체, `_meta.release` 확인, CHANGELOG·tag | 롤백(이전 링크)로 `_meta.release`가 되돌아감. 루트 심볼릭링크 통합 테스트 통과 | E-05, E-07 | 01 §3, §4, §7 |
| E-10 | 브리지: `load_skill` 응답에 `release, commit, manifest_digest, movedFrom`, `search_skills` haystack에 `keywords` | 응답 스키마 테스트 | E-07 | 01 §6 |
| E-11 | 브리지: 이벤트 로그 `~/.codex/logs/gisul/events-<date>.jsonl` (connect/search/load/read/error) | 한 세션 후 파일에 이벤트 존재 | E-10 | 01 §6 |
| E-12 | exporter: 멱등 trace/observation id(uuid5 of session+turn), 상태 파일로 새 턴만 전송, 최상위 input/output 채움 | 2턴 fixture 두 번 전송 → trace 2개. `missing_input` 0 | — | 04 §2, §3 |
| E-13 | exporter: metadata에 `instructions.*.sha256`, `gisul.*`(이벤트 로그 조인), `quality.*`, 기기·agent 태그 | linear-delivery 로드 세션의 trace에 `gisul.loads[0].release` 존재 | E-11, E-12 | 04 §3, §4 |
| E-14 | 중복 원인 확인: 원본 `tracing@codex-observability-plugin` 훅이 함께 실행되는지 점검, 비활성 확정 | config.toml hooks.state 정리, 하루치 trace 중복 0 | E-12 | 04 §1 |

**2026-09-17 사용자 변경:** Worker HTTPS 엔드포인트를 사용하도록 E-03의 접속 경로·검증 기준을 변경했다. 기존 30분 유휴·격리 sshd 재시작·단절 진단 기록은 보존하고, 미실행 SSH 절전 시험은 새 경로의 완료 조건에서 제외한다. Worker가 Mac mini를 중계할지 콘텐츠까지 직접 서빙할지는 확인 중이며, 이 변경만으로 Mac mini 의존성이 없어졌다고 간주하지 않는다. 현재 구현·실제 배포 여부는 [변경 기록](implementation/WORKER-HTTPS-20260917.md)을 참조한다.

### 6.2 단기 (MVP 후 약 1–2개월) — 지침 계층, linear-delivery, 평가 하네스

완료 정의: 전역 AGENTS.md 축약과 linear-delivery 분리가 사례집 비교를 통과해 배포됐고, 일일 품질 검사가 돌아간다.

| ID | 작업 | 수용 기준 | 의존 | 설계 |
| --- | --- | --- | --- | --- |
| E-20 | 사례집 v1 (`gisul-skills/eval/cases/*.yaml`, 20–30건: 9/15 6건, L-01~08, S-01/08/09/10, 정상 4건, holdout 4건) + Langfuse dataset 동기화 스크립트 | dataset `agent-env-v1` 존재, 각 사례에 source_trace 또는 fixture | E-13 | 05 §1 |
| E-21 | mock Linear MCP(`eval/mock-linear.mjs`): 실제 응답 녹화 fixture, 쓰기 기록, 타임아웃 주입 | L-08 fixture에서 타임아웃 재현 | — | 05 §3 |
| E-22 | runner `eval/run.mjs` + `config.toml` `[profiles.eval-baseline|eval-candidate]`(CODEX_HOME 분리, 모델·플러그인 고정) → Langfuse experiment 업로드 | baseline 1회 실행이 experiment로 기록 | E-20, E-21 | 05 §2, §3 |
| E-23 | 채점기: 코드 평가(로드 여부·중복 티켓·상태·채널), rubric judge(버전 고정), 사람 채점 10건 일치율 | 일치율 기록 | E-22 | 05 §4 |
| E-24 | 새 전역 AGENTS.md(≤1,300 bytes) + 로더 description 재작성 + `~/.claude/CLAUDE.md` import → candidate 평가 → 승격 | 중요 사례 새 실패 0, 첫 generation input 토큰 감소(5회 중앙값) | E-22, E-23 | 02 §2, §3, §6 |
| E-25 | Linear 팀 설정: `Verifying` 상태 추가, GitHub 연동 병합→In Review | 상태 목록 조회로 확인 | — | 03 §5 |
| E-26 | linear-delivery 분리: SKILL.md + references/intake·completion·writes + `projects/arkpoint.yaml` + `policies/arkpoint-delivery.md` → candidate 평가 → 승격 → 전역 Linear 절 삭제 | L-01~08 통과, SKILL.md에 채널 ID 0건 | E-24, E-25 | 03 |
| E-27 | 일일 품질 검사 `scripts/langfuse-quality.mjs`(429 재개 포함) | 3일 연속 결과 파일, missing_input 0 | E-13 | 04 §5 |
| E-28 | `check-device.sh`: 세 기기의 전역 AGENTS.md 해시·플러그인 버전·release 일치 확인, macbook-air 설치 | 세 기기 동일 출력 | E-24 | 07 §2 |
| E-29 | 브리지 재연결(최대 3회 백오프, 재검증, 구조화 오류 code) — E-03 결과에 따라 범위 조정 | sshd 재시작 후 다음 load 성공 | E-03 | 01 §6 |
| E-30 | 서버 manifest 캐시 + `skills/get` 직접 해석 | 두 번째 `skills/list` 지연 ≤ 첫 번째의 20% | E-07 | 01 §5 |

### 6.3 중기 (3–6개월) — 개선 루프 운영, 프로젝트 실행 경로, 성능

완료 정의: 예약 분석이 매일 후보를 만들고 사람이 평가·승격하는 루프가 3회 이상 돌았으며, 한 프로젝트에 `project-runtime`이 적용됐다.

| ID | 작업 | 수용 기준 | 의존 | 설계 |
| --- | --- | --- | --- | --- |
| E-40 | agent-improvement 스킬 이관 + 예약 분석(매일 09:00 KST, `codex exec`) → `eval/candidates/<date>.md` PR | 3일 연속 후보 파일 | E-27 | 05 §6 |
| E-41 | 승격 절차 운영 3회 + CHANGELOG에 experiment 링크. 자동 승격 여부 결정 | 3회 기록 | E-40 | 05 §5 |
| E-42 | `project-runtime` 템플릿(`ensure-ready`, `verify-flow`, flow yaml, `ready.json` 스키마) + 안내 스킬 | 템플릿 저장소 내 예제 프로젝트에서 수용 기준 통과 | — | 06 |
| E-43 | 적용 프로젝트 선정 후 `project-runtime` 적용, 하위 AGENTS.md 경계 정리 | `ensure-ready` 멱등, verify-flow 1건 통과 | E-42 | 06, 02 §5 |
| E-44 | 지침 삭제 실험: 코드 도구 규칙·worktree 절 축약 후보 비교 | 중요 사례 새 실패 0이면 삭제 유지 | E-41 | 02 §1 |
| E-45 | 검색 개선 측정: 한국어 질의 실패율, 필요 시 aliases·관련도 정렬 | 측정 보고서, 필요 시 구현 | E-27 | 01 §5 |
| E-46 | HTTP 경로 인증 검증과 OpenClaw의 gisul 경로 통일(로컬 stdio) | OpenClaw trace에 `gisul.loads` | E-13 | 07 §2 |

## 7. 성공 지표

| 층 | 지표 | 측정 |
| --- | --- | --- |
| 배포 | main ↔ Mac mini ↔ 플러그인 버전 일치 | `check-device.sh`, 주 1회 |
| 수집 | 중복 trace 0, missing_input 0 (합성 제외) | E-27 일일 |
| 발견 | 필요한 스킬 로드율, 불필요 로드 수 | 사례집 비교 |
| 결과 | 중요 사례 통과 수, 새 실패 수, 사용자 정정 횟수 | 사례집 + 운영 trace |
| 비용 | 첫 generation input 토큰, 성공 사례당 비용 | E-24 측정 프로토콜 |

## 8. 위험

07번 §3 표를 따른다. 특히 (1) 루트 심볼릭링크 동작은 E-09 착수 시 첫 테스트로 확인, (2) mock Linear의 현실 괴리는 승격 후 운영 trace 재확인으로 보완, (3) 평가 비용은 E-22 첫 실행에서 측정 후 임계값 조정.

## 9. 티켓 발행 지침

- Linear 프로젝트: `personal`. 팀·워크스페이스는 해당 프로젝트를 조회해 따른다.
- 티켓 1개 = 위 표의 ID 1개. 제목은 `[E-nn] 작업 요약` 형식으로 짧게.
- 본문 첫 문장은 완료했을 때 무엇이 가능해지는지. 이어서 수용 기준 체크리스트, 의존 티켓 링크, 설계 문서 절(파일 경로) 링크.
- MVP / 단기 / 중기를 라벨 또는 마일스톤으로 구분. 의존 관계는 blocking 관계로 연결.
- 상위 이슈 3개(MVP, 단기, 중기)를 만들고 각 티켓을 하위로 둔다. 상위 이슈는 하위 생성만으로 닫지 않는다.
- 이미 같은 제목의 이슈가 있으면 생성하지 않고 갱신한다. 생성 후 재조회해 프로젝트·관계·렌더링을 확인한다.
