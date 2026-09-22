# Mac mini 정식 평가 실행 기록 — 2026-09-22

격리 실행기와 Langfuse 저장·재조회는 구현하고 실제 실행했다. **최초 두 실행은 모두 행동 비교에 사용할 수 없는 진단 기록이다.** 첫 실행은 mock 쓰기 승인 문제, 두 번째는 실제 모델의 파일 도구가 꺼져 있던 문제가 있었다. 두 번째 실행은 공급자 용량 부족으로 8/22에서 중단되기도 했다. 전역 지침이나 스킬 검색 정책을 승격하지 않았다.

## 구현과 실제 검증

- 각 사례는 별도 CODEX_HOME, `gpt-6-astra/max`, 설치된 gisul 로더와 고정 Worker release를 사용한다. 실제 Codex 0.155.1에서 도구 목록·설정·파일 접근 차단·네트워크 차단을 확인했다.
- Worker release는 `20260922.26`, 스킬 commit은 `c7955e405fc609282c6c3890f3ab152f42749a14`다. 설치 reader로 검색·로드·보조 파일 읽기를 검증했다.
- Linear와 Slack은 로컬 mock이다. 실제 외부 쓰기 연결은 없다. Codex의 MCP 쓰기 승인 설정이 shell 승인 설정과 별개임을 실제 실행에서 발견하고, 이 저장소의 정확한 mock 실행 파일에만 쓰기를 허용했다. 별도 실제 모델 canary가 생성 1회·동일 이슈 재조회를 통과했다.
- 입력·기대값·출력·파일·도구 기록·코드 채점·사용량·release를 Langfuse에서 재조회해 비교한다. v4 API의 JSON 문자열과 펼쳐진 metadata 표현을 처리한다. 누락된 사용량을 0으로 간주하지 않는다.
- 업로드 전 기존 항목을 조회하고, 제출 의도를 먼저 저장한다. 한 writer만 허용하며 불확실한 제출을 재전송하지 않는다. 수정 실행은 재조회 재시도 후에도 8개 항목·8개 고유 원시 observation이었다.
- 모델 서버 오류를 인프라 실패로 분류하고 두 번이면 새 실행을 중단한다. 원래 오류 원인도 결과에 남긴다. 로컬 전체 테스트 103개와 마지막 export 회귀 테스트 6개가 통과했다. 선택적 과거 고정 자료 검사는 1개 건너뛰었다.

실행 방법과 비교 조건은 [eval/README.md](../eval/README.md), 수치·commit·실험 식별자는 [검증 기록 JSON](formal-evaluation-20260922.json)에 있다.

## 실행 결과

| 실행 | 시도 / 예정 | 실행 완료 | 실행 실패 | 비용 환산 | 해석 |
| --- | --- | --- | --- | --- | --- |
| 최초 진단 | 22 / 22 | 19 | 3 | $9.245030 | mock 쓰기 승인이 차단됐으므로 행동 비교에 사용할 수 없음 |
| 두 번째 진단 | 8 / 22 | 5 | 3 | $2.060572 | 파일 도구 미제공으로 비교 무효; 서버 용량 부족 2건, 240초 초과 1건; 14건 미실행 |
| 쓰기 canary | 1회 | 통과 | 0 | $0.318860 | 평가 도구 자체의 생성·재조회 확인 |

비용은 관측된 사용량을 2026-09-22 표준 API 가격으로 환산한 값이다. 실제 청구액이 아니며, 수정 기준선의 실패 1건은 사용량 자체가 없어서 합계 **$11.624462는 알려진 부분만의 값**이다. 잘못된 최초 진단과 canary 비용도 제외하지 않았다.

수정 기준선의 실패는 F-04와 L-01의 `serverOverloaded`, L-02의 시간 초과다. 고정 실행 코드가 공급자 오류를 일반 실행 실패로 분류했으므로 supervisor가 두 번째 인프라 오류를 확인한 뒤 새 실행을 중지했다. 이미 시작된 사례는 종료까지 기록했다. 원래 결과·protocol은 수정하지 않았고 별도 assessment에 실제 원인과 감독 중단을 남겼다. 이후 코드 `54d71e6`에는 자동 분류 회귀 테스트를 추가했다.

두 실행 모두 [Langfuse dataset](https://jp.cloud.langfuse.com/project/cmu275pqc00i8ad0d79dddjgk/datasets/cmu4sphcs001uad0dd0yf31le)에 저장·재조회했다.

- 진단 실험: `agent-env-v1-baseline-46eed72d-7f37-485f-b0cf-8be40b2b782b`, source `2145776`, protocol `68514aadb508c3b469592f1e5d9ca3cd559d8bbac9eceb596ea87af0e8acc0b2`.
- 수정 실험: `agent-env-v1-baseline-c7b3d6ee-8ff8-4573-b2a0-2c21d1414df6`, source `b672307`, protocol `e8718d40d0630bae8c97f4aaaa039cd265d6f4762ec913cd1f820cfc1e8782e7`.

최초 진단 업로드 과정에서 같은 span을 재전송해 22개 실험 항목에 44개 원시 revision이 남았다. 이를 삭제하거나 중복 0으로 보고하지 않았다. 이후 제출 의도 기록과 사전 재조회로 재전송을 막았다. 모든 평가 기록은 synthetic이며 운영 primary-turn 지표에서 제외된다. 원시 중복 검사는 유지되므로 이 기록은 9/22 하루 품질 통과의 증거가 아니다. 기존 9/17 E14 실패 기록도 그대로다.

## 남은 판단과 범위

추가 원시 기록 감사에서 `thread/start`의 `environments: []`가 모델의 로컬 파일·셸 도구를 끈 사실을 확인했다. controller의 `command/exec` 성공은 모델 도구 제공을 입증하지 않았다. 원래 protocol·결과·업로드 기록은 그대로 두고 `baseline-02/assessment-addendum.json`으로 해석을 정정했다. 실행기는 기본 local 환경을 선택하고 그 환경의 ID·workspace를 검증한다. 실제 모델이 무작위 파일을 출력하고 복사한 뒤 mock 이슈를 생성·재조회하는 canary를 통과했으며, 모든 유료 평가에 같은 코드·CLI 바이너리·reader의 canary receipt를 요구한다. 사람 평가나 행동 통과 점수와는 별개의 실행 환경 검사다.

Codex 0.155.1 standalone 실행 파일이 보호된 `~/.codex` 안에 있어 native helper가 차단되는 문제는 자격증명 접근 허용으로 해결하지 않았다. 같은 Mac의 `codex`와 `codex-code-mode-host` 실행 파일만 별도 runtime에 복사해 SHA256 일치를 확인했다. 명령별 PATH만 사용하고 전역 설정·인증·보호 디렉터리 차단은 유지한다. 최초 capability canary는 companion 실행 파일 누락을 검출해 실패했고, companion을 갖춘 다음 canary는 실제 파일 IO와 mock 생성·재조회 4개 조건을 통과했다. 각각의 비용 환산 $0.155260, $0.186596도 보존한다.

정적 테스트 통과와 모델 작업 완료를 의미 품질 통과로 계산하지 않는다. 사람 채점은 0건이고 고정 rubric judge와 후보 비교도 남아 있다. 후보 비용 130%, critical/holdout 회귀 금지, 실제 사람 10건 일치율 조건은 유지한다. 현재 결과로 전역 자동 검색 정책의 우열을 판단할 수 없다.

다음 실행은 공급자 용량이 확보된 뒤 별도 protocol로 계획한다. 실패한 사례를 몰래 재시도하거나 이번 인프라 중단을 토큰 예산 연장으로 우회하지 않는다. 시간·토큰 한도 때문에 끝나지 않은 사례는 계속 결과에 남긴다. 최초 진단의 비용은 예산 참고 자료이며 유효한 후보 비교 기준은 아니다.

MacBook Pro, 예약 writer, 다른 Herdr pane, 운영 `/Users/iyen/gisul`은 변경하지 않았다. 영구 소스는 `/Users/iyen/dev-tools/{gisul,gisul-skills,langfuse-masked}`이며 기존 feature branch와 미발행 commit을 보존했다. 원시 실행 자료는 Mac mini의 `/Users/iyen/dev-tools/session-notes/local-evals-20260922/`에 남긴다. 평가 입력은 release `20260922.26`에 고정된다. 공용 Langfuse API 스크립트 변경은 기존 발행 검증 대상이므로, 스킬 내용이 같아도 main 배포가 새 immutable release를 만들 수 있다. 운영 발행과 평가에 사용한 버전은 구분한다.

## 발행 실패와 복구 변경

[PR10 main 발행](https://github.com/changeroa/gisul-skills/actions/runs/35707486689)은 262개 파일 업로드와 Git 원본 260개 파일 대조를 마친 뒤 전체 R2 검증에서 실패했다. 120초 제한의 검증 요청이 세 번 시간 초과했고, 포인터 변경에는 도달하지 않았다. 2026-09-22 18:23 KST 재조회에서 기존 `.26`의 revision `12`, sequence `17`, ETag가 그대로였고 새 `c14d8cf` / `.33`은 미완성으로 읽기를 거부했다.

발행기는 전체 검증을 수행하는 verify/promote/rollback 요청에만 300초를 허용한다. 검증 시간 초과를 자동 재전송하지 않아 겹치는 전체 검사를 만들지 않는다. inventory 전체 대조, 실제 바이트 해시, frontmatter, Git parity, staged MCP 읽기, 최신 main 확인, ETag와 sequence 조건은 그대로다. 복구용 publisher/workerd 테스트 7개가 통과했다. 이것은 발행 검증 시간 예산 변경이며 모델 평가의 제한이나 승격 조건 변경이 아니다.

Worker의 별도 수정 `cf562ca`는 R2 바이트 검사를 최대 4개씩 실행하고 실패 시 진행 중인 검사까지 정리한다. TypeScript와 Worker 테스트 45개가 통과했지만, 이 문서를 기록할 때는 Cloudflare 계정 인증이 없어 실제 배포하지 않았다. 기존 Worker source는 `bc6ba43045fb6303c3b1a631e28a40381be63ad2`다. MCP 읽기/발행 bearer는 Cloudflare 계정 로그인과 별개다. 실제 발행 성공 여부는 후속 Actions의 `r2-publication.json`과 installed-plugin 증거로 판단하며, 시간 제한 변경이나 단위 테스트만으로 성공을 선언하지 않는다.

후속 [Actions 35711118986](https://github.com/changeroa/gisul-skills/actions/runs/35711118986)도 `/admin/verify` 300초 제한에서 실패했다. 후보 `31d0d397eff6025fff0a2efcea1d5c9e75a49a71` / release `20260922.35`는 미완료이며 current는 release `20260922.26`, revision 12, sequence 17을 유지함을 재조회했다. 같은 발행은 다시 실행하지 않는다. Worker PR6은 main `55bc0ba351930aaa7552552e0e2e077d3f5108b4`로 병합하고 dry-run까지 검증했다. 실제 배포는 작업 전용 Cloudflare 로그인에서 `iyen.team@gmail.com` 계정 확인 후 진행한다. 이 문서의 후속 실행기 수정도 CI 검증 후 PR에 보존하며, 인증 해결 전에 또 다른 main 발행을 시작하지 않는다.
