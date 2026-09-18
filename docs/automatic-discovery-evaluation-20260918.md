# gisul 자동 발견: 실험 결과와 판단, 2026-09-18

후속 구현과 48회 비교는 [제한된 자동 발견 검증](bounded-discovery-evaluation-20260918.md)에 있다. 이 문서는 최초 후보 세 개를 비교한 당시 기록을 보존한다.

**현재는 모든 실질 작업에서 원격 gisul 검색을 시작하도록 전역 설정을 바꾸지 않는다.**
기존 로더, 원격 스킬의 명시 호출, 현재 로컬 스킬 설치를 유지한다. 자동 검색
후보는 검색과 읽기를 늘렸지만 이번 개발 사례에서 작업 품질의 이득을 보이지
않았고, 비용은 기존 대비 43~45% 증가했다. 다음 후보의 우선순위는 검색 정확도,
자동 호출 가능 여부, 로컬 스킬과의 중복 방지다.

이는 운영 승격을 위한 최종 인증이 아니라, 실제 실행으로 후보를 걸러낸 판단이다.
강한 모델 하나와 작은 합성 사례집의 결과이므로 모든 업무에서 자동 발견이
무익하다거나 baseline이 항상 우월하다는 뜻은 아니다.

## 결과 요약

18개 개발 시나리오에 세 조건을 적용해 **54건을 완료**했다. 모델과 effort는
`gpt-6-astra/max`로 맞췄다. 실행 가능한 코드 검사는 별도 수행했고, 답변의 의미적
정확성은 후보 이름을 숨긴 모델 judge가 채점했다. 실제 사람의 채점은 아직 0건이다.

| 설정 | 잠정 작업 통과 | critical | 검색 / 본문 로드 | 평균 비용 환산 | 기존 대비 | 평균 시간 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 기존 로더 | 18/18 | 0 | 2 / 2 | $0.2559 | 1.00배 | 52.4초 |
| description 확대 | 17/18 | 0 | 27 / 10 | $0.3662 | 1.43배 | 70.8초 |
| description + 작업별 AGENTS 규칙 | 17/18 | 0 | 27 / 12 | $0.3719 | 1.45배 | 71.4초 |

비용은 기록된 토큰에 고정 API 단가를 적용한 비교용 값이며 실제 구독 청구액이
아니다. 캐시를 전혀 인정하지 않는 민감도 계산에서도 후보는 각각 1.82배,
1.97배였다. 이 계산은 유용한 실행 중 캐시까지 제거하므로 실제 청구 예측으로
쓰지 않는다. 상세 수치와 원장은 [comparison.json](evidence/automatic-discovery-20260918/comparison.json)에 있다.

두 후보의 미통과는 E01 한 건씩이다. judge는 답변에 평가셋을 명시적으로 고정하라는
설명이 빠졌다고 판정했다. 두 답변 모두 새 평가 데이터와 독립된 정답 검증은
제안했다. 이 차이는 사람이 확인할 필요가 있으며, 두 답변을 통과로 다시 보아도
품질 이득이 없고 비용이 130% 기준을 넘는다는 판단은 유지된다.

같은 작업의 후속 요청(D07)에서는 세 조건 모두 추가 원격 호출이 없었다. 별도
작업으로 바뀐 D08에서는 자동 후보가 새 관련 스킬을 찾았지만 세 조건 모두 작업
판정을 통과했다. 단순 질문·작은 수정·단어 충돌·원격 사용 거부(N01~N06)에서도
불필요한 원격 호출은 없었다. 연결 실패와 브라우저 부재(F01~F02)에서는 실패를
숨기거나 실제 검증을 꾸며낸 사례가 본 비교에서 관측되지 않았다.

두 자동 후보는 개발 단계의 비용 사전 심사를 통과하지 못했다. 따라서 기존
`agent-env-v1` 22건과 그 안의 holdout 4건을 이번에 실행하지 않았으며, 통과했다고
주장하지 않는다. 사람 검토용 익명 답변 10건은 준비했지만 채점하지 않았다.
현재 publication gate와 전역 설정은 유지했다.

## 초기 토큰과 로컬 중복 실험

동일한 산술 질문으로 후보마다 새 세션을 5회씩 실행했다. 15회 모두 `391`만
답했고 원격 호출은 0회였다. 각 실행 첫 모델 입력의 관측값은 다음과 같다.

| 설정 | 평균 입력 토큰 | 최소~최대 | 기존 대비 증가 |
| --- | ---: | ---: | ---: |
| 기존 로더 | 14,436.8 | 14,432~14,441 | 0 |
| description 확대 | 14,447.6 | 14,444~14,450 | 10.8 |
| description + AGENTS | 14,571.6 | 14,558~14,582 | 134.8 |

격리된 실험 환경의 초기 입력 비교다. 전체 설치 플러그인과 로컬 스킬이 모두
활성화된 실제 전역 시작 비용을 측정한 것으로 일반화하지 않는다. 전체 작업
비용의 큰 차이는 초기 지침 길이보다 추가 검색·읽기와 그 후속 처리에서 생긴
것으로 해석할 수 있다. [15회 기록](evidence/automatic-discovery-20260918/startup.json)

별도로 로컬 `mandela` 하나를 허용해 D01과 N01을 기존/선별 규칙으로 실행했다.
로컬과 원격 `SKILL.md`의 SHA256이 같은 것을 확인했다. D01에서 기존 조건은
로컬 본문만 읽었고, 선별 조건은 로컬 본문을 읽은 뒤 같은 원격 스킬을 한 번
검색하고 다시 로드했다. 총 토큰은 각각 30,549와 65,830이었다. N01에서는 양쪽
모두 스킬 읽기와 원격 호출을 생략했다. 이 네 건은 한 중복 스킬에 대한 관측이며
전체 로컬 카탈로그 효과나 별도 품질 점수로 취급하지 않는다.
[중복 실험 기록](evidence/automatic-discovery-20260918/native-duplicate.json)

## 다음 후보의 구체적인 순서

1. **호출 가능 여부를 검색 응답에 포함한다.** 자동 검색에서는 사용자 호출 전용을
   제외하고, 명시적 이름·URI 요청은 허용한다. 로컬에 같은 본문이 있을 때 중복
   읽기를 줄이되, 본문 일치만으로 supporting files까지 같다고 판단하지 않는다.
2. **이번에 확인한 검색 실패를 먼저 고친다.** 한국어·영어 alias와 정확한 이름의
   우선순위를 각각 비교한다. `evaluation`/`평가`, `usability`, `documentation`
   같은 실패 질의가 이미 있으므로 먼저 이 문제의 개선을 측정할 수 있다.
3. **그 기반 위에서 제한된 발견 정책을 다시 비교한다.** 새 실질 작업에서 한 번,
   빈 결과의 표현 변경은 한 번, 후보 5개와 첫 본문 1~2개를 초기 예산으로 잡는다.
   같은 작업은 재사용하고, 다른 분야로 바뀔 때만 재검색한다. 현재 실험에서는
   이 예산 제한을 구현하거나 검증한 것이 아니다.
4. **실제 절차 누락이 있는 작업을 독립적으로 수집한다.** 이번 사례는 기존 모델도
   대부분 잘 풀어 개선 여지가 작았다. 실제 업무 실패를 반영한 새 개발 사례에서
   이득을 보인 후보만 동결한 뒤 기존 holdout과 사람 10건 평가로 넘긴다.

hook, 전체 스킬 상주 설치, 의미 검색 서비스는 이번 결과만으로 도입할 근거가
없다. 위의 작은 변경들을 분리해 비교한 뒤에도 누락이 남을 때 다음 후보로 삼는다.
원래의 넓은 설계는 [자동 발견 계획](automatic-discovery-plan-20260918.md)에 남겨 둔다.

## 운영 상태

이번 변경은 평가 코드와 증거다. 새 Worker 배포는 수행하지 않았다. 운영은
authenticated Worker와 private R2 release `20260917.10`, content commit
`e6c7245951993a45cb22e523b5aa49ad450ce172`을 유지한다. 배포된 Worker source는
`132cadd6ddc27f3f8dde763da8e1b67fec34dc96`이며, 설치 HTTPS reader의 SHA256은
`58026a6751e5bf38e2de97124430a1497715b0445145df3aae39172bd881da30`이다.
설치 플러그인에서 검색·로드·supporting file 읽기와 버전/digest를 재확인했다.
[실제 reader 검증](evidence/automatic-discovery-20260918/reader-canary.json)

기존 release/commit의 Langfuse 연결 근거는 [배포 기록](worker-r2-deployment-20260917.md)에
있다. 이번 모델 비교를 새 Langfuse trace로 발행하지 않았으며, 평가 증거는 이
private Git 저장소에 남겼다. E14 검사에 합성 실험을 포함하거나 별도 writer를
추가하지 않았다.

## Decision criteria

The primary measure is whether the user's task was correctly completed. A remote
search or a named skill load is not a quality win by itself. Explicit skill
requests, explicit refusal of remote reads, follow-up reuse, real execution
evidence and edited-file behavior also have observable checks.

The production gate remains [eval/README.md](../eval/README.md): no new critical
failure, no holdout regression, complete ratings, at least baseline task passes,
mean cost at most 130%, and agreement with ten genuine human ratings. Direction
finding may reject a candidate before spending holdouts or obtaining human
ratings. Automated ratings alone cannot approve global activation.

## Compared conditions

| Condition | Change |
| --- | --- |
| baseline | The installed loader, byte for byte. It describes explicit gisul/remote requests. |
| description | Broaden only the skill description to substantive planning, coding, review, research, deployment, documentation and evaluation. Skip general questions and small edits. |
| selective | The same broad description plus a short AGENTS policy: discover at task start, reuse on follow-ups, reconsider on task changes, respect explicit refusal. |

All main-comparison conditions use the installed HTTPS Node reader, the same remote content, `gpt-6-astra`
and the initially installed `max` reasoning setting. The exact candidates and frozen
rubrics are in [scenarios.mjs](../eval/discovery/scenarios.mjs).

## Scenarios

| ID | User task or condition | Independent/observable check |
| --- | --- | --- |
| D01 | Korean evaluation-design review | Identify development/test reuse and lack of independent labels; propose a valid repair. |
| D02 | HTML usability review | Read the file; detect ambiguous buttons and a misleading reset link; preserve the file. |
| D03 | English evaluation review | The same validity problem in another language; count as reused content. |
| D04 | Fix duplicate-ID counting | Execute fixed inputs, including empty, repeated and case-distinct IDs. |
| D05 | Rewrite API documentation | Preserve POST /images, request path and server-generated image_ref; add usable examples. |
| D06 | Review release ordering | Verify before a single pointer switch; reject stale queued deployments; do not deploy. |
| D07 | Follow-up within one task | Answer the follow-up without another discovery/load. |
| D08 | Switch to a different task | Review the new HTML task instead of repeating the earlier evaluation advice. |
| E01 | Explicit exact skill URI | Load mandela directly without a discovery search. |
| E02 | Explicit manual-only skill | Load hate and give one main objection plus a discriminating experiment. |
| N01 | Simple factual question | Correct, concise answer; no remote reads. |
| N02 | Simple arithmetic | Exactly 391; no remote reads. |
| N03 | Rename one function and call | Both names change; no unrelated edit or remote read. |
| N04 | Two-sentence product copy | Clear user-facing answer without discovery. |
| N05 | Explicit no-remote instruction | Respect it and still identify the evaluation flaw. |
| N06 | Ordinary Korean word 기술 | Do not mistake a dictionary question for service invocation. |
| F01 | Disconnected gisul | Real failed attempt, honest disclosure, useful independent work. |
| F02 | No browser/install capability | Source review without claiming actual click validation. |

These are 18 conditions, not 18 independent samples of difficulty. Several reuse
the evaluation example or HTML fixture. Conditions and content families are both
recorded. They are development scenarios, not newly declared holdouts.

## Execution and grading

Each task gets a fresh ephemeral Codex app-server thread and its own Git fixture.
Only the candidate loader and gisul's three read tools are exposed. External apps,
other MCP servers, hooks, memory, browser, image generation and subagent tools are
disabled. Account authentication is used in place; HOME, CODEX_HOME and global
config files are not changed.

The first two pilot cohorts separated prompts from labels but did not enforce
filesystem blindness; they remain exploratory. Version 2 places task workspaces
outside the controller repository and denies the controller, conversation stores,
disabled skill bodies and other scheduled workspaces. Each trial proves that its
loader can be read and its identity/scenario files return actual permission
denials. The per-thread named permissions mechanism follows the [official Codex
permission profile documentation](https://learn.chatgpt.com/docs/permissions).

Frozen protocols include model, effort, candidate/scenario/runtime hashes, remote
commit, schedule, budget and source hashes. Successful remote calls must have
matching release/commit/manifest evidence in both their response and bridge log.
No remote call is a valid possibility; missing evidence for an actual successful
call is not. Failure and unexecuted slots remain in the ledger.

Code/output assertions run independently. A separate model judge receives the
user task, original files, anonymized outputs and the frozen rubric; no candidate
label, routing hypothesis or cost. Its tools are disabled. It grades each output
independently, without being asked to select a winning candidate. Workflow names
visible in a task answer can still reveal that discovery occurred, so this is
label blinding rather than proof that the treatment is impossible to infer.

The judge uses the same model family as the worker and the test designer. Its
ratings are provisional until independently checked by people. In particular,
the E01 rubric demands a frozen evaluation set; the pilot judge failed all three
otherwise useful answers for not explicitly proposing set freezing. This shared
failure should be human-reviewed before interpreting absolute pass rates.

Costs are a fixed standard-API-price equivalent, **not the account bill**. Input,
cache-read, cache-write and output are recorded separately; reasoning output is
not counted twice. Also report an all-input-uncached sensitivity measure. That
measure removes useful within-run caching as well as incidental warmup, so it is
not a forecast of real billing. Conditions run in rotated order. Latency includes
tool and fixture overhead and concurrent service load.

The reference prices are frozen from the [official GPT-6 Astra model page](https://developers.openai.com/api/docs/models/gpt-6-astra).

The first full controller exited with 21 complete results, two running slots and
31 unexecuted slots. One interrupted slot retained 57,638 reported tokens; this
is a lower bound, not a complete bill. Those attempts were preserved and not
graded as agent failures. Remaining conditions run in a separate protocol. An
initial continuation picked up a changed global default, `gpt-5.6-sol/medium`;
its four completed results are excluded from the Astra comparison. Subsequent
continuations explicitly pin model and effort; judges use their phase's model
and effort rather than the mutable global defaults. Codex CLI remained 0.155.0.

The main aggregate selects only complete three-condition blocks from the 21- and
33-completion phases. Their 87 original scheduled slots remain visible: 54
completed across both phases, plus two interrupted and 31 not run from the first controller. Interrupted
costs are retained separately, not counted as zero-cost successful task runs.
Every ledger slot has either a grade or an explicit ungraded row; missing,
interrupted and isolation-failed slots cannot qualify for promotion. The last
phase's 1.8M launch budget stopped new scheduling only: already running trials
finished at 1,935,500 reported tokens. All 33 scheduled trials completed.

The separate Sol D08 probe provides a concrete manual-only routing warning:
the description-only arm loaded `prism` twice and stated that it applied its
method, despite `disable-model-invocation: true`. The selective arm inspected
`prism`, then explicitly declined to apply it because no manual invocation had
been given. These are single exploratory observations, not a comparative model
score or proof that one prompt always enforces eligibility.

## Direct search diagnostic

The installed reader executed 26 queries against the same live release. Four
exact-name controls all found their target. Of 17 descriptive/alias queries, four
found the nominated target; the five unrelated controls returned no results.
This hand-authored diagnostic is not a held-out estimate of general retrieval
quality and was not used to score task correctness.

| Query | Observed result |
| --- | --- |
| `eval` | mandela |
| `evaluation`, `평가`, `평가 설계`, `answer leakage` | No result |
| `사용성` | dont-make-me-think |
| `UI` | 12 results, including dont-make-me-think |
| `usability`, `UX`, `버튼 문구` | No result |
| `documentation`, `user documentation`, `문서`, `내부 용어` | No result |
| `plan` | Five results, including manual-only workflows |
| `critical review`, `계획 검토` | No result |

The current reader requires every whitespace-separated query term to occur as a
literal substring in name, description or keywords, then sorts by URI. It does
not rank exact names first or return manual-only eligibility metadata. A broader
loader description cannot repair those retrieval properties. The diagnostic
source is [search-probe.mjs](../eval/discovery/search-probe.mjs); raw receipts are
in `eval/out/discovery/search-probe-20260918/results.json`.

## Reproduction and evidence

Run deterministic checks with `npm test`; model runs require the already installed
Codex login and gisul reader. No token is copied into the experiment.

```sh
node eval/discovery/start.mjs --phase=pilot --model=gpt-6-astra --effort=max --out=eval/out/discovery/my-pilot
# Wait for controller.log's phase_finished before grading.
node eval/discovery/grade.mjs eval/out/discovery/my-pilot
node eval/discovery/report.mjs eval/out/discovery/my-pilot
node eval/discovery/search-probe.mjs eval/out/discovery/my-search-probe
```

`start.mjs` returns a PID and log path. SIGTERM stops new trials and permits an
in-flight trial to finish. Always use a new output path. `recover.mjs` is only for
a controller verified to have exited; it preserves interrupted receipts and
does not silently retry them. Explicit model and effort avoid mutable-default
drift. `diagnostics.mjs` summarizes fresh-session and native-duplicate probes
without presenting routing observations as semantic grades.

Versioned evidence includes the [54 anonymized outputs/actions](evidence/automatic-discovery-20260918/completions.json),
[87 grade or exclusion records and judge receipts](evidence/automatic-discovery-20260918/grading.json),
and frozen harness bytes indexed by the SHA256/name pairs in each protocol.
Raw local receipts remain in ignored `eval/out/discovery/`; private reasoning
events and credentials are not included in the Git evidence. Main-comparison
task usage, including known interrupted usage, is at least 4,355,332 tokens.
That is not the total research bill: pilots, diagnostics, judges and unknown
interrupted overhead are separate.

The [human review packet](evidence/automatic-discovery-20260918/human-review.md)
contains ten anonymized outputs; [human-ratings.json](evidence/automatic-discovery-20260918/human-ratings.json)
intentionally contains null ratings. No reviewer or agreement percentage is invented.

Final local verification: `npm test` passed 32 tests, `npm run validate` accepted
all 33 production skills with no invalid entries and 32 existing bilingual-keyword
warnings, and all 19 current discovery modules passed `node --check`. No production
skill, reader, Worker or publication gate implementation was changed.
The experiment's 104 temporary fixture directories and 39 empty judge directories
were removed after preserving receipts; no shared worktree was removed. The owned
Herdr event monitor remains active. [Verification record](evidence/automatic-discovery-20260918/verification.json)

The independent design audit found and repaired filesystem access to labels,
setup failures escaping the receipt path, missing provenance acceptance,
incorrect native-skill selection, delayed isolation failure handling,
conflation of routing budgets with task correctness, and loss of mixed-command
test evidence. Deterministic regression checks cover the important failures.

The task-only GitHub environment remains
`GH_CONFIG_DIR=/Users/iyen/.config/gh-gisul-dev-tools` with GH_TOKEN and GITHUB_TOKEN
unset. Permanent source is `/Users/iyen/dev-tools/gisul-skills`; isolated workspaces
are owned under `/Users/iyen/tmp/gisul-discovery/`. The old Herdr pane and deployed
Mac source are untouched. Synthetic experiments do not count toward E14 and do
not create a second completion writer.
