# Mac mini 정식 평가 실행 기록 — 2026-09-22

**실행기 수정과 실제 부분 실행은 검증했지만, 유효한 22건 전체 기준선은 아직 없다.** 최신 실행은 14건을 시도해 11건 완료, 시간 초과 1건, 디스크 부족으로 중단된 2건을 기록했다. 나머지 8건은 미실행이다. E22의 전체 기준선과 E23의 의미 채점·실제 사람 10건 검토는 완료하지 않았다. 이 결과로 전역 스킬 검색 정책을 변경하거나 후보를 승격하지 않았다.

## 검증한 동작

각 사례는 별도 CODEX_HOME, `gpt-6-astra/max`, 작은 gisul 로더와 설치된 reader를 사용한다. 스킬 내용은 release `20260922.26`, commit `c7955e405fc609282c6c3890f3ab152f42749a14`에 고정했다. 실제 모델의 파일 읽기·쓰기와 mock 이슈 생성·재조회를 별도 canary에서 확인했다. 모델은 정답·자격증명·다른 사례를 읽을 수 없고, 외부 네트워크와 실제 Linear/Slack 앱도 연결하지 않는다.

최초 실행에서 mock 쓰기 승인 누락을 발견했다. 후속 감사에서는 `thread/start`의 `environments: []`가 모델의 파일·셸 도구를 끄는 문제를 확인했다. controller의 파일 접근 검사 성공만으로 모델의 실제 도구 제공을 입증할 수 없었다. 실행기는 기본 local 환경과 workspace를 검증하며, 같은 실행 코드·모델·reader·CLI 바이너리에서 무작위 파일 출력·정확한 복사·mock 생성·재조회를 통과한 receipt를 모든 유료 실행 전에 요구한다.

Codex 0.155.1의 실행 파일과 `codex-code-mode-host`만 같은 Mac에서 별도 runtime으로 복사하고 SHA256을 대조했다. 보호된 `~/.codex`의 읽기 차단과 전역 PATH는 유지한다. 이 runtime의 경로는 `/Users/iyen/.local/share/gisul-eval-runtime/0.155.1`이다.

최신 실행의 저장 오류를 반영해 다음을 추가했다.

- 유료 canary·사례 시작 전에 출력 파일시스템의 512 MiB 여유를 확인한다. 공간을 예약하는 기능은 아니다.
- 비동기 로그 쓰기 오류가 나면 모델을 중단하고 세션·임시 인증 정리를 수행한다. 불완전한 증거와 사용량은 명시한다. 디스크가 완전히 차면 최종 결과 저장도 실패할 수 있어 원시 로그와 감독 복구 기록이 필요하다.
- 한 번 허용된 추가 토큰 단계에서도 인프라·격리·저장·사용량 누락 조건은 최초 단계와 합산한다. 토큰 한도만 새 단계에 적용한다.
- Langfuse 업로드는 native 명령·파일 동작, 복구 출처, 불완전 표시까지 보존하고 재조회로 비교한다. 제출 의도를 먼저 저장하고 불확실한 요청을 재전송하지 않는다.

전체 로컬 테스트 **112개 통과, 선택적 과거 자료 검사 1개 생략**. 여기에는 실제 native 환경과 publisher/workerd 검사가 포함된다. 저장 오류·추가 단계·export 집중 회귀 검사 16개도 통과했다. 새 저장 처리 코드를 넣은 뒤 유료 모델 실행은 추가하지 않았다. 새 실행에는 변경된 코드에 맞는 새 canary가 필요하다.

## 실제 실행과 비용

| 실행 | 시도 / 예정 | 실행 완료 | 실패 | 관측 비용 환산 | 해석 |
| --- | --- | --- | --- | --- | --- |
| baseline-01 | 22 / 22 | 19 | 3 | $9.245030 | 쓰기 승인과 파일 도구 결함으로 행동 비교 무효 |
| baseline-02 | 8 / 22 | 5 | 3 | $2.060572 | 파일 도구 결함으로 비교 무효; 공급자 오류 2건과 시간 초과 1건 |
| baseline-03 | 14 / 22 | 11 | 3 | $7.099412 | 시간 초과 1건, 저장 오류 중단 2건; 8건 미실행 |
| 쓰기 canary | 1 | 통과 | 0 | $0.318860 | mock 생성·재조회만 입증한 과거 검사 |
| capability canary-01 | 1 | 0 | 1 | $0.155260 | companion 실행 파일 누락 검출 |
| capability canary-02 | 1 | 통과 | 0 | $0.186596 | 실제 파일 출력·복사·mock 생성·재조회 통과 |

합계 **$19.065730는 알려진 사용량만의 하한**이다. 표준 API 가격 환산이며 실제 청구액이 아니다. baseline-02의 1건은 사용량이 없고 baseline-03의 2건은 사용량이 불완전하다. 실패한 진단과 canary 비용도 포함했다.

baseline-03은 source `cf860ef9dd36978b06b76ab9a75fcccc6f98031a`, protocol `85660db379049b28338806b0cf24b7aebcc133ed985ff952b07734ea7b16305f`에서 실행했다. 앞선 실행과 동일한 지침·모델·release를 유지했고 후보를 조정하지 않았다. 최초 단계의 12건 뒤 토큰 한도에 도달했고, 비용 검토 후 미실행 사례에만 한 번 허용한 추가 단계가 L-07/L-08 실행 중 ENOSPC로 중단됐다. 최초 12개 결과와 원시 이벤트는 변경하지 않았다. 두 중단 사례는 남은 이벤트·mock 기록·파일을 바탕으로 실패 결과를 복구했으며 정확한 종료 시각이나 완전한 사용량을 주장하지 않는다. 해당 모델 프로세스가 모두 종료됐음을 확인하고 남은 임시 인증 파일 2개를 제거했다. 이 추가 단계를 재개하지 않는다.

코드 채점은 최신 실행에서 pass 1, fail 3, unverified 10이다. 실행 완료나 코드 검사 통과를 의미 품질 통과로 계산하지 않는다. 사람 채점은 0건이다. 후보 비용 130%, critical/holdout 회귀 금지, 실제 사람 10건 일치율 조건은 유지한다.

## Langfuse 증거

세 실행은 [agent-env-v1 dataset](https://jp.cloud.langfuse.com/project/cmu275pqc00i8ad0d79dddjgk/datasets/cmu4sphcs001uad0dd0yf31le)에 저장했다. 입력·기대값·출력·파일·도구·사용량·코드 채점·release와 실행 불완전 상태를 재조회해 대조했다.

| 실행 | 실험 ID | 검증 항목 / 원시 기록 |
| --- | --- | --- |
| baseline-01 | `agent-env-v1-baseline-46eed72d-7f37-485f-b0cf-8be40b2b782b` | 22 / 44 |
| baseline-02 | `agent-env-v1-baseline-c7b3d6ee-8ff8-4573-b2a0-2c21d1414df6` | 8 / 8 |
| baseline-03 | `agent-env-v1-baseline-27a3171b-b575-4038-a7af-f176db3e66fd` | 14 / 14 |

최초 업로드의 중복 원시 revision 44개는 보존했다. 이후 실행의 재조회에서는 각 항목과 원시 observation 수가 일치했다. 앞선 두 실행은 별도 experiment-level `harness_valid_for_behavior=false` 점수로 무효 판정을 기록·재조회했으며 기존 span을 고쳐 쓰지 않았다. 이는 사람이 매긴 품질 점수가 아니다. 모든 평가는 synthetic이며 운영 primary-turn 지표에서 제외된다. 이번 14개 기록 검사는 하루 전체 중복 0 증거가 아니고 기존 9/17 E14 실패도 바꾸지 않는다.

수치·해시·복구와 재조회 식별자는 [검증 JSON](formal-evaluation-20260922.json), 실행 조건은 [eval/README.md](../eval/README.md)에 있다.

## 발행 상태

운영 Worker source는 **`bc6ba43045fb6303c3b1a631e28a40381be63ad2`**, R2 current는 **release `20260922.26` / `c7955e405fc609282c6c3890f3ab152f42749a14`**, revision 12, sequence 17이다. 설치된 실제 플러그인의 검색·로드·보조 파일 읽기를 재검증했고 [별도 synthetic trace](https://jp.cloud.langfuse.com/project/cmu275pqc00i8ad0d79dddjgk/traces/172e6423d37d5f18d7abe0033228aecc)에서 버전 연결과 동일 ID 재조회를 확인했다.

[PR10 발행](https://github.com/changeroa/gisul-skills/actions/runs/35707486689)은 262개 업로드와 Git 원본 260개 바이트 대조 후 전체 검증 요청 120초 시간 초과로 실패했다. [PR11](https://github.com/changeroa/gisul-skills/pull/11)은 전체 검증 제한을 300초로 늘리고 자동 재시도를 제거했다. 그러나 [후속 발행](https://github.com/changeroa/gisul-skills/actions/runs/35711118986)도 한 번의 300초 제한에 걸렸다. Cloudflare의 해당 요청 기록은 `outcome=canceled`, wall time 299994ms였다. candidate `.35`는 미완료 상태이며 current `.26`은 유지됐다.

[Worker PR6](https://github.com/changeroa/gisul/pull/6)의 최대 4개 병렬 R2 검증은 main `55bc0ba351930aaa7552552e0e2e077d3f5108b4`에 병합했다. Worker 테스트 45개, TypeScript, CI와 dry-run이 통과했지만 **아직 배포하지 않았다**. inventory·실제 바이트 digest·frontmatter·최신 main·ETag·sequence 검증은 모두 유지했다.

브라우저에서 `iyen.team@gmail.com` / `iyen`, account `8277c1acc712e4a9d00479255015c200`을 확인했다. 작업 전용 Wrangler의 새 권한 승인은 아직 완료되지 않았으며 이전 device code는 만료됐다. 기존 다른 계정의 전역 인증은 보존한다. MCP bearer와 Cloudflare 배포 인증은 별개다. [실행기 PR12](https://github.com/changeroa/gisul-skills/pull/12)는 검증한 코드와 결과를 보존하되, Worker 배포 복구 전에 main에 병합해 같은 실패 발행을 반복하지 않는다.

## 남은 작업과 보존 범위

로컬 디스크 여유를 확보한 다음 새 capability receipt와 새 protocol로 22건 기준선을 계획해야 한다. 현재 부분 실행을 전체 성공으로 바꾸거나 실패 사례를 몰래 재시도하지 않는다. 이후 고정 의미 judge, 실제 사람 10건 검토, 동일 조건 후보 비교가 필요하다. 배포는 올바른 Cloudflare 권한 승인 뒤 Worker 변경을 먼저 적용하고 Actions 발행·최신 연결·기존 pinned 파일 읽기를 검증한다.

MacBook Pro와 예약 writer, 다른 Herdr pane, 운영 `/Users/iyen/gisul`은 변경하지 않았다. 영구 소스 `/Users/iyen/dev-tools/{gisul,gisul-skills,langfuse-masked}`의 기존 branch와 미발행 commit을 보존했다. 원시 실행 자료는 `/Users/iyen/dev-tools/session-notes/local-evals-20260922/`에 남긴다.
