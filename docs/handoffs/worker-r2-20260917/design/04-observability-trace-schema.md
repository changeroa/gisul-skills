# 04. 관측: trace 스키마와 exporter

목표: 9월 15일 분석에서 드러난 중복 trace·빈 최상위 입출력을 없애고, 각 trace에 "어떤 지침·스킬 버전으로 실행됐는가"를 남겨 05번 비교가 가능하게 한다. 대상은 `langfuse-masked@personal` 플러그인(`plugins/tracing/src/*`, langfuse/codex-observability-plugin 072c5f1 기반)이다.

## 1. 확인된 수집 결함과 원인 가설

| 결함 | 수치 (9/15) | 원인 가설 | 확인 방법 |
| --- | --- | --- | --- |
| 같은 sessionId·timestamp·input·output이 다른 trace id로 중복 | 112 → 96 (dedupe 후) | Stop 훅이 턴마다 세션 rollout 전체를 다시 파싱해 이전 턴을 새 trace id로 재전송 | `src/trace.ts`에서 trace id 생성 방식 확인, 2턴 세션 fixture로 export 횟수 측정 |
| 최상위 input/output 비어 있음 | 282 / 394 | trace 레벨에 사용자 메시지·최종 응답을 채우지 않고 observation에만 기록 | `src/instrumentation.ts` trace 생성부 |
| 합성 테스트·heartbeat 혼입 | 미집계 | OpenClaw 자동 실행이 같은 프로젝트로 전송 | 메타데이터 `synthetic`, `agent_kind` 부재 |

원본 `tracing@codex-observability-plugin` 훅의 `hooks.state`가 config.toml에 남아 있다. `enabled`가 없어 비활성으로 보이지만, 중복 원인 배제를 위해 두 플러그인이 같은 Stop에서 모두 실행되는지 `codex hooks list`(또는 동등 명령)로 먼저 확인한다.

## 2. 멱등 식별자

```text
trace_id        = uuid5(NS, session_id + ":" + turn_index)
observation_id  = uuid5(NS, session_id + ":" + turn_index + ":" + item_index)
```

- **2026-09-16 구현 정정:** [Langfuse v4 공식 문서](https://langfuse.com/faq/all/tracing-data-updates)는 같은 ID의 재전송을 안전한 upsert로 보장하지 않는다. ID는 상관관계 식별에 쓰고, 완료된 턴만 내보낸다. observation별 pending/acknowledged 전송 영수증을 남기며, 응답이 불확실하면 API 재조회로 확인한 항목만 acknowledged로 바꾼다. 확인되지 않은 항목은 자동 재전송하지 않는다.
- `turn_index`는 rollout 파일 안의 사용자 메시지 순번. session_id는 Codex rollout 파일명의 UUID.
- 마지막으로 전송한 `(session_id, turn_index)`를 `~/.codex/langfuse-masked.state.json`에 기록해 Stop 훅이 **새 턴만** 전송한다. 상태 파일은 전송 성공 후 갱신한다. 손상되면 `~/.codex/langfuse-masked.exports/`의 영수증으로 복구하고, 영수증도 유실되면 원격 데이터 확인 없이 재전송하지 않는다. 기존 무작위 ID exporter의 `.langfuse` 이력은 재개한 세션의 과거 턴을 다시 보내지 않도록 유지한다.

## 3. trace 스키마

trace 레벨:

| 필드 | 값 |
| --- | --- |
| `name` | 첫 사용자 메시지 앞 80자 |
| `input` | 해당 턴 사용자 메시지 (마스킹 후) |
| `output` | 해당 턴 최종 assistant 메시지 |
| `session_id` | Codex session UUID |
| `user_id` | 기기 식별자 (`macbook-pro` / `macmini-openclaw` / `macbook-air`) |
| `tags` | `agent:codex|openclaw`, `device:*`, `synthetic` (해당 시) |

`metadata` (context manifest, gisul-environment-plan 제안 표를 구현 필드로 고정):

```json
{
  "run": { "turn_index": 3, "cwd": "/Users/victor/projects/eum-content-studio", "git_commit": "abc1234", "model": "gpt-6-astra", "codex_version": "…" },
  "instructions": {
    "global_agents_md": { "path": "~/.codex/AGENTS.md", "sha256": "…", "bytes": 1280 },
    "project_agents_md": [ { "path": "AGENTS.md", "sha256": "…" }, { "path": "apps/api/AGENTS.md", "sha256": "…" } ]
  },
  "gisul": {
    "origin": "macmini", "release": "20260916.1",
    "searches": [ { "query": "linear 티켓", "total": 2, "returned": 2 } ],
    "loads": [ { "uri": "skill://gisul/gisul/linear-delivery/SKILL.md", "manifest_digest": "sha256:…", "changed": false } ],
    "reads": [ "skill://gisul/gisul/linear-delivery/references/intake.md" ],
    "errors": [ { "code": "gisul_disconnected", "ts": "…" } ]
  },
  "quality": { "truncated": false, "missing_input": false, "missing_output": false, "export_error": null, "synthetic": false }
}
```

- `instructions.*.sha256`는 훅 실행 시점의 파일 해시다. 턴 실행 시점과 다를 수 있으므로 `hashed_at`을 함께 둔다.
- 실제 입력 토큰은 generation `usage`에 이미 있으므로 metadata에 복제하지 않는다.
- 값을 얻지 못한 항목은 `null`로 남기고 `quality`에 사유를 적는다. 추정치를 실측처럼 쓰지 않는다.
- **2026-09-17 분류 정정:** 자동 실행과 합성 테스트는 별개다. 실제 업무를 수행하는 Codex 예약 실행은 `run.thread_source=automation`과 `thread:automation`으로 식별하고 품질 모집단에 포함한다. 명시적으로 테스트로 지정한 실행만 `synthetic`으로 제외한다. 실제 Codex automation 입력은 `codex_app.automation_update` 레코드에서 얻으며 `run.input_source`에 출처를 남긴다. 과거 trace를 분류 수정 목적으로 재전송하지 않는다.

## 4. gisul 이벤트 조인

01번 6절의 `~/.codex/logs/gisul/events-*.jsonl`을 Stop 훅이 읽는다.

```text
조인 조건: event.ts ∈ [turn.start_ts − 2s, turn.end_ts + 2s]
          AND (rollout에 gisul MCP tool call이 있으면 그 호출 순서와 이벤트 순서를 대조)
```

- rollout의 MCP tool call 레코드(`search_skills`, `load_skill`, `read_skill_file`)와 이벤트를 **순서·URI**로 1:1 매칭한다. 매칭 실패는 `quality.gisul_join = "partial"`.
- 새 브리지 응답의 `connection_id`로 동일 연결인지 먼저 확인한다. 현재 Codex의 `item_completed/McpToolCall` 레코드도 읽는다. 시간만 일치하는 다른 pane의 로그는 채택하지 않는다.
- 같은 시간 창에 다른 Codex 세션이 있으면(Herdr 다중 pane) 이벤트가 겹칠 수 있다. tool call 레코드 쪽이 세션에 귀속되므로 tool call을 기준으로 잡고 이벤트는 release·digest 보강용으로만 쓴다.

## 5. 수집 품질 검사 (일일, agent-improvement 1단계 입력)

**2026-09-17 구현 정정:** 새 검사는 Observations API v2의 `isRootObservation=true`와 cursor를 사용한다. 따라서 아래 초기안의 trace 최상위 필드 집계와 모집단이 다르다. 결과에 API·모집단을 명시하고 직접 증감 비교하지 않는다. 합성·heartbeat는 명시적 태그/metadata로만 제외하고, 턴 식별자 누락과 표본 0은 통과시키지 않는다. HTTP 429는 Retry-After와 소비하지 않은 cursor를 저장해 같은 날짜로 재개한다. 현재 매일 09:00 KST 품질 검사만 설치됐으며 모델 분석·후보 자동 PR은 아직 설치하지 않았다.

`scripts/langfuse-quality.mjs --date 2026-09-16 --tz Asia/Seoul`:

- 모집단: 해당 일자 trace 수, 고유 `(session_id, turn_index)` 수, 중복 수.
- 결측: `missing_input`, `missing_output` 비율.
- 혼입: `synthetic` 태그 수, agent_kind별 수.
- 조인: `gisul.loads`가 있는 trace 수, `gisul_join = partial` 수.
- 출력은 JSON + Markdown 표. 429를 만나면 페이지 커서를 저장해 재개한다(9/15 조회가 429로 중단됐음).

## 6. 수용 기준

- [ ] 2턴 세션 fixture를 Stop 훅으로 두 번 내보내도 Langfuse trace가 2개다.
- [ ] 9월 17일 이후 일일 품질 검사에서 `missing_input`이 0이다 (합성·heartbeat 제외).
- [ ] `linear-delivery`를 로드한 세션의 trace metadata에 `gisul.loads[0].release`가 채워진다.
- [ ] OpenClaw 발 trace에 `agent:openclaw`가 붙고, 명시적으로 지정한 합성 테스트 실행에만 `synthetic` 태그가 붙는다. 실제 업무 자동화는 품질 모집단에 포함한다.
