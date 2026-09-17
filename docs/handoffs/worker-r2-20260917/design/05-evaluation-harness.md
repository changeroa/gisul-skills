# 05. 평가 하네스와 agent-improvement

목표: 지침·스킬·환경 변경 후보를 같은 사례집·같은 조건에서 baseline과 비교하고, 결과를 Langfuse experiment로 남긴다. "지침 삭제" 후보도 같은 절차로 평가한다.

## 1. 사례집 (dataset)

저장 위치: `gisul-skills/eval/cases/*.yaml` (원본), Langfuse dataset `agent-env-v1`(동기화본). 20–30개로 시작.

```yaml
id: S-01
kind: search            # search | decision | action
title: 저장소 밖 Linear 기획 요청
input:
  cwd: fixtures/empty
  prompt: "이 기획 이슈를 개발 티켓으로 나눠줘 https://linear.app/iyen/issue/IYEN-123"
  fixtures: [linear/IYEN-123.json]
expected:
  must_load: ["skill://gisul/gisul/linear-delivery/SKILL.md"]
  must_not_load_more_than: 2
  rubric: "미결정 정책은 기획 결정 이슈로 분리했는가"
tags: [linear, discovery]
source_trace: https://jp.cloud.langfuse.com/project/cmu275pqc00i8ad0d79dddjgk/traces/6576a43d…
```

초기 구성:

| 묶음 | 사례 | 출처 |
| --- | --- | --- |
| 9/15 실패 | image_ref 계약 단정, 로그인 중간 화면, 서비스 계정 오판, 설명 재요청, 폴링 선택, 문서 가독성 | prompt-recommendations.md 6건 |
| Linear | L-01~L-08 | 03번 |
| 발견 | S-01 gisul 필요, S-08 오타 수정(검색 불필요), S-09 한국어 질의로 영어 스킬 찾기, S-10 gisul 미연결 시 보고 | 02번 |
| 정상 | 단순 설명 2건, 작은 코드 수정 2건 | 신규 |
| 보류(holdout) | 위 묶음에서 4건을 빼 특정 trace 맞춤 수정 검출용 | — |

## 2. 실행 조건 고정

```json
{ "run_id": "exp-20260918-01", "model": "gpt-6-astra", "reasoning": "max",
  "codex_version": "…", "global_agents_md_sha256": "…",
  "gisul_release": "20260916.1", "plugin_versions": { "gisul": "…", "langfuse-masked": "…" },
  "dataset_version": "agent-env-v1@3", "evaluator_version": "ev-2" }
```

baseline과 candidate는 **하나의 변수만** 다르다(전역 지침 / gisul release / 환경 스크립트 / 모델). 둘 이상을 바꾼 비교는 원인 귀속 불가로 기록한다.

## 3. Runner

**2026-09-17 확인:** 현재 설치된 `codex exec --help`의 `--profile`은 `$CODEX_HOME/<name>.config.toml`을 사용한다. 아래 초기 설계의 `[profiles.*]` 설정을 검증 없이 그대로 구현하지 않는다. 22개 사례(holdout 4개 포함), 실제 Linear 응답 형태 fixture와 lost-response mock은 준비됐으나 모델 runner·experiment·judge/사람 일치율은 미실행이다. 후보는 `eval/candidates/`에 격리하며 아직 전역 지침이나 운영 스킬로 승격하지 않았다.

`gisul-skills/eval/run.mjs --dataset agent-env-v1 --profile candidate`:

1. 사례별 격리 cwd를 `fixtures/<name>`에서 임시 디렉터리로 복사한다.
2. Linear·Slack은 **녹화 fixture MCP 서버**(`eval/mock-linear.mjs`)로 대체한다. 쓰기 호출은 기록만 하고 성공 응답을 돌려준다. L-08은 타임아웃을 주입한다.
3. gisul은 실제 macmini를 쓰되 `--origin` 과 `GISUL_SKILL_ROOTS`로 candidate release 경로를 가리킨다(01번 4절의 `releases/<id>/skills`를 직접 지정).
4. `codex exec --profile eval-<profile> "<prompt>"`로 비대화 실행. profile은 `config.toml`의 `[profiles.eval-baseline]`, `[profiles.eval-candidate]`에 모델·플러그인·AGENTS.md 경로(`CODEX_HOME` 분리)를 고정한다.
5. 결과: 최종 응답, tool call 목록, mock 쓰기 기록, gisul 이벤트, 토큰 사용량을 `eval/out/<run_id>/<case_id>.json`으로 저장하고 Langfuse experiment run에 업로드한다.

`kind: action`(파일 수정·명령 실행)은 격리 저장소 fixture 안에서만 실행하고 diff를 채점한다. 실제 배포·외부 쓰기는 하네스에서 하지 않는다.

## 4. 채점

| 항목 | 방식 | 코드/judge |
| --- | --- | --- |
| 필요한 스킬 로드 여부, 불필요 로드 수 | tool call 목록 대조 | 코드 |
| 중복 티켓·수동 알림·금지 채널 | mock 쓰기 기록 대조 | 코드 |
| 상태 전환 정확성 | mock 기록의 state 이름 | 코드 |
| 계정 확인 전 단정, 계약 단정 | 응답에서 "확인했다"는 주장 vs tool call 존재 | 코드 + judge |
| 설명이 화면 변화로 시작하는가, 문서 가독성 | rubric judge (모델·프롬프트 버전 고정) | judge, 사람 채점 10건과 일치율 기록 |
| 비용·지연 | usage 합계, wall time | 코드 |

주지표는 "중요 사례 통과 수"와 "새로 실패한 중요 사례 수". 토큰·지연은 보조.

## 5. 승격 정책 (초기, 수동)

candidate를 stable로 올리는 조건:

1. 중요 사례(9/15 6건 + L-02/L-03/L-08)에서 새 실패 0.
2. 전체 통과 수 ≥ baseline.
3. 평가 누락·evaluator 오류 0 (누락을 통과로 세지 않음).
4. 사례당 평균 비용이 baseline의 130% 이하 (초기 임계값, 조정 가능).
5. holdout 4건에서 baseline 대비 하락 없음.

충족 시 01번 7절 `release-skills.sh`로 배포하고 `releases/CHANGELOG.md`에 experiment run URL을 남긴다. 자동 승격은 이 절차가 3회 이상 문제없이 돈 뒤 별도 결정.

## 6. agent-improvement 스킬과 예약 실행

- 초안 `agent-improvement/SKILL.md`와 references 4개를 `gisul-skills/skills/agent-improvement/`로 옮긴다. 본문의 "원격 로더가 반환한 manifest의 정확한 resource URI로 해석한다" 문장은 유지.
- `references/triage.md` 1단계는 04번 5절 품질 검사 스크립트 출력을 입력으로 받는다.
- 예약: launchd(macbook-pro) 또는 Codex 예약 실행으로 **매일 09:00 KST** `codex exec`에 agent-improvement를 로드해 전날 trace를 분석하고 후보를 `gisul-skills/eval/candidates/<date>.md`에 쓴다. 후보는 PR로 올리고, 평가·승격은 사람이 트리거한다.

## 7. 수용 기준

- [ ] `run.mjs`가 baseline/candidate 두 프로파일로 사례집을 돌려 Langfuse에 experiment 2개를 만든다.
- [ ] L-08(타임아웃 주입)에서 mock 기록에 생성 호출이 1회다.
- [ ] judge 채점과 사람 채점 10건의 일치율이 기록돼 있다.
- [ ] 전역 AGENTS.md 축약(02번) 비교에서 중요 사례 새 실패 0을 확인한 뒤에만 실제 적용한다.
