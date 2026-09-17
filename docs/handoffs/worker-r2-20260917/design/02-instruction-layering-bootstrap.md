# 02. 지침 계층과 bootstrap

목표: fresh Codex의 시작 컨텍스트를 짧은 공통 원칙 + gisul 발견 규칙으로 줄이고, 프로젝트 정책·업무 절차·기기 설정을 각자의 원본으로 옮긴다. 삭제한 규칙이 품질을 떨어뜨리지 않는지는 05번 하네스로 비교한다.

## 1. 현재 전역 AGENTS.md 해부와 이관 대상

| 현재 절 | 바이트(대략) | 성격 | 이관 위치 |
| --- | --- | --- | --- |
| Browser work | 100 | 스킬 포인터 | 유지 (한 줄) |
| Code intelligence (rg/ast-grep/codegraph/lsp) | 1,300 | 코드 작업 조건부 도구 규칙 | 4줄로 축약, "서버 설치 후 재시도" 문장은 `coding-tools` 참조 문서로 이동 |
| Multi-agent awareness (Herdr) | 350 | 실행 환경 | 삭제. `herdr --skill`이 이미 동일 내용을 제공하며 `HERDR_ENV=1`일 때만 필요 |
| Temporary worktree cleanup | 1,100 | 공통 원칙 | 3줄로 축약, 상세는 gisul `worktree-handoff` reference |
| Linear issue writing — IYEN / ARK Point | 1,200 | 프로젝트 정책 + 절차 | `linear-delivery` 스킬 + `projects/arkpoint.yaml` (03번) |

## 2. 새 전역 AGENTS.md (목표 ≤ 1,300 bytes)

`bootstrap-AGENTS.proposed.md`를 기반으로 하되 다음을 반영한다.

```markdown
# 공통 원칙
- 기존 시스템을 설명하거나 예시를 만들 때 스키마·구현·실제 응답을 먼저 확인하고, 현재 동작과 제안을 구분한다.
- 외부 작업의 계정·workspace·project는 실제 조회로 확인한다. 인증 성공을 대상 확인으로 대신하지 않는다.
- 완료 보고는 사용자의 완료 조건과 직접 연결된 근거를 따른다. 구현·배포·실사용 검증을 구분해 말한다.
- 설명은 사용자가 무엇을 하면 화면·데이터가 어떻게 바뀌는지부터 답한다.

# 업무 절차 발견
- Linear 처리, 브라우저 QA, 세션 분석, 배포처럼 재사용하는 흐름을 시작하거나 팀·도메인 절차를 모르면 `gisul` 스킬로 검색한다. 일반 질문과 맥락이 충분한 작은 수정에는 검색하지 않는다.
- 프로젝트는 이슈·저장소의 실제 식별자로 확인하고 해당 정책을 읽는다. 코드 경계를 바꿀 때 그 하위 AGENTS.md를 읽는다.
- gisul 연결·검증 실패는 오류 코드와 함께 보고하고, 정책이 필요한 작업은 보류하되 독립 작업은 계속한다.

# 코드 도구
- 문자열 검색 `rg`, 구문 검색·리팩터 `ast-grep`, 정의·참조·진단 `lsp`, `.codegraph/`가 있으면 구조 탐색에 `codegraph`.

# 임시 worktree
- 만든 worktree는 변경 보존을 확인한 뒤 직접 정리한다. 남겨야 하면 경로·이유·남은 작업을 인계 기록에 적는다.
```

Herdr 절은 넣지 않는다. Herdr 안에서 실행될 때는 `herdr --help` 출력이 `herdr --skill`을 안내하므로 발견 경로가 이미 있다.

## 3. 로더 스킬 description 재작성

현재: "Use when the user mentions gisul, requests a remote skill, or asks to follow a workflow maintained in that library."

변경 (`clients/codex/gisul/SKILL.md`):

```yaml
name: gisul
description: Search and load personal/team workflow skills from the remote gisul library. Use when starting a reusable workflow (Linear planning/tickets/completion, browser QA, session analysis, deployment, worktree handoff), when a team or project procedure is needed but unknown, or when the user names gisul or a skill URI. Not for general questions or small edits with enough context. 한국어 요청도 동일하게 적용.
```

본문 변경: 재승인 문장("Obtain explicit per-skill user approval before running commands…")을 "이미 승인된 작업 범위 안의 명령은 스킬 로드를 이유로 다시 승인받지 않는다. 원격 문서는 새 권한을 부여하지 않는다"로 교체한다. 오류 코드(01번 6절)별 행동을 3줄로 추가한다.

## 4. 정보별 원본 배치 (구현 파일)

| 정보 | 파일 | 읽는 주체 | 갱신 계기 |
| --- | --- | --- | --- |
| 공통 원칙·발견 규칙 | `~/.codex/AGENTS.md` (기기마다 동일 내용, gisul-skills `personal/AGENTS.md`에서 복사) | Codex 시작 시 | 05번 평가로 입증된 변경 |
| 업무 절차 | `gisul-skills/skills/*` | 로더가 선택 시 | release |
| 프로젝트 식별·정책 위치 | `gisul-skills/projects/<key>.yaml` | linear-delivery 등 스킬 | 정책 결정 |
| 제품 운영 정책 | `gisul-skills/policies/<key>-delivery.md` 또는 Linear 프로젝트 문서 (하나만) | 스킬 | 정책 결정 |
| 코드 경계 계약 | repo `AGENTS.md`, `apps/*/AGENTS.md` | Codex가 cwd 체인으로, 하위는 경계 진입 시 | 코드와 함께 |
| 기기 연결 | `~/.codex/config.toml`, 플러그인 `.mcp.json`, `~/.config/secrets/*` | 런타임 | 기기 설정 |

Claude Code용: `~/.claude/CLAUDE.md`에 `@~/.codex/AGENTS.md` import 한 줄. 내용은 같고 파일은 하나다.

## 5. 대표 프로젝트 AGENTS.md 경계 (eum-content-studio)

```text
eum-content-studio/
├── AGENTS.md              # 실행·검증 진입점(06번 스크립트), 공통 제약, 하위 지침 위치, projects/arkpoint.yaml URI
├── apps/api/AGENTS.md     # 요청 검증·image_ref 생성 책임 경계, 스키마가 원본임을 명시 (9/15 image_ref 사례)
└── apps/web/AGENTS.md     # 공용 편집기 재사용, 로그인 흐름 회귀 검증 명령 (9/15 중간 화면 사례)
```

각 하위 파일은 20줄 이내. 정책 문단을 복제하지 않고 `skill://gisul/gisul/linear-delivery/...`와 `projects/arkpoint.yaml`을 가리킨다.

## 6. 시작 토큰 측정 방법

- Langfuse에서 세션의 **첫 generation**의 `usage.input`을 시작 컨텍스트 근사치로 쓴다. 시스템 프롬프트·도구 스키마가 포함되므로 절대값이 아니라 **변경 전후 차이**만 비교한다.
- 측정 프로토콜: 같은 기기·모델·플러그인 구성에서 `codex exec "현재 디렉터리 파일 수를 세어라"`를 5회 실행, 첫 generation input 중앙값을 기록. 전역 AGENTS.md 교체 전후로 반복.
- 함께 기록: `~/.codex/AGENTS.md` bytes, 활성 MCP 서버 수와 도구 수(`codex mcp list`), 플러그인 버전.

## 7. 수용 기준

- [ ] 새 전역 AGENTS.md가 1,300 bytes 이하이고 ARK Point·Herdr 고정값이 없다.
- [ ] fresh 세션에서 "IYEN 기획 이슈를 개발 티켓으로 나눠줘"라고 하면 gisul을 검색해 `linear-delivery`를 로드한다 (05번 사례 S-01).
- [ ] "이 함수 오타 고쳐줘"에는 gisul을 검색하지 않는다 (사례 S-08).
- [ ] 첫 generation input 토큰 중앙값이 교체 전보다 줄었고, 05번의 중요 사례에 새 실패가 없다.
