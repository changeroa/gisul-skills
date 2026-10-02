---
name: "clean-code-craft"
description: "Clean Code 2판의 craftsmanship 장들로 개발 실행 방식과 팀 규율을 개선한다. 위험 책임, emergency patch cleanup, repeatable proof, small commits, continuous integration/build/deployment, relentless improvement, sustainable productivity, pairing·knowledge sharing, honest estimates, professional respect와 learning plan을 다룰 때 사용한다."
---

# Clean Code: Craftsmanship

깨끗한 코드를 개인 스타일이 아니라 팀이 지속적으로 안전한 변경을 전달하는 방식으로 만든다. 동작과 구조의 결함을 알고도 쌓지 않고, 위험에 비례한 증거를 만들며, 작은 통합 주기와 정직한 소통을 유지한다.

이 스킬은 Clean Code 2판 28~37장의 실천을 운영 절차로 바꾼 것이며, 팀·통합·release 실천을 담당한다. 구체적인 코드 구현과 구조 리뷰는 해당 `clean-code-*` 전문 스킬로 넘긴다. 개인을 도덕적으로 평가하거나 특정 개발 방법론을 강요하는 데 사용하지 않는다. 출처와 적용 한계는 `skill://gisul/gisul/clean-code/references/sources-and-guardrails.md`를 따른다.

## 모드와 권한

리뷰 요청은 읽기 전용이다. 파일 수정은 사용자가 구현·리팩터링을 요청한 범위에서만 수행한다. 테스트·빌드 실행, commit·push·PR·배포와 외부 효과는 호스트와 저장소 정책 및 명시된 권한을 따른다. 사용자의 기존 변경을 덮어쓰거나 무관한 작업을 되돌리지 않는다.

## 1. 해를 줄이는 책임을 구체화한다

작업 시작 시 어떤 위험과 이해관계가 걸려 있는지 확인한다.

- 사람의 안전과 건강
- 개인정보와 보안
- 금전, 결제, 거래와 회계
- 데이터 무결성과 복구 가능성
- 중요한 공공·업무 서비스의 가용성
- 고객 신뢰, 규정과 계약
- 다음 개발자의 변경 능력

위험이 클수록 review, 독립 검증, staging, rollback, monitoring과 승인 수준을 높인다. 완벽한 지식을 약속하는 대신 알려진 위험, 증거, 미확인 범위와 go/no-go 조건을 명시한다.

시스템이 준비되지 않았다는 근거가 있으면 역할과 직급에 관계없이 조기에 알린다. “요구받은 대로 했음”을 안전성 검토의 대체물로 쓰지 않는다. 동시에 불확실한 우려를 확정 사고처럼 과장하지 않는다.

## 2. 동작과 구조의 결함을 누적하지 않는다

- 동작을 만든 뒤 같은 작업 주기 안에서 구조를 정리한다.
- 새 기능을 알려진 나쁜 구조 위에 계속 쌓지 않는다.
- dead code, disabled legacy path, stale flag와 임시 우회를 제거할 시점과 책임자를 정한다.
- 구조 개선이 불가능한 deadline이면 debt의 위치, 위험, 최소 cleanup 조건을 기록하고 다음 행동에 실제 시간을 배정한다.
- 코드베이스를 만질 때 범위 안에서 조금 더 낫게 남기되, 무관한 대규모 cleanup으로 현재 변경을 숨기지 않는다.

production 사고 중 quick fix는 허용할 수 있다. 안전한 복구와 영향 차단을 우선하고, 안정화 뒤 원인 분석·회귀 테스트·구조적 수정·임시 코드 제거를 별도 완료 조건으로 둔다.

## 3. 빠르고 반복 가능한 증거를 제공한다

release마다 요구 동작을 누구나 같은 방식으로 확인할 수 있어야 한다.

- 자동 테스트는 명확한 pass/fail을 내고 초·분 단위의 유용한 피드백을 준다.
- test command, 환경, seed, fixture와 artifact를 재현 가능하게 만든다.
- 사람의 수동 판단이 필요한 항목은 절차와 확인자를 명시하고 자동 증거와 구별한다.
- green build가 shipping confidence를 주려면 flaky·ignored·항상 통과하는 테스트를 방치하지 않는다.
- 테스트는 수학적 완전 증명이 아니다. 위험에 맞는 coverage와 다른 검증을 함께 사용한다.

CI 결과, local 결과, production 관찰을 섞지 않고 어떤 revision과 환경에서 확인했는지 기록한다.

## 4. 작은 통합 주기를 유지한다

- 한 commit은 하나의 설명 가능한 의미 단위를 담고 build 가능한 상태를 유지한다.
- mainline에 자주 통합해 merge와 feedback 지연을 줄인다.
- incomplete behavior를 통합해야 하면 안전한 feature flag와 default-off 경로를 사용한다.
- 장기 branch는 독립성이 실제로 필요하고 incremental integration이 불가능할 때만 사용한다.
- deploy script와 migration도 코드처럼 test한다.
- business가 언제 release할지와 기술적으로 언제 deploy-ready인지 구별한다.
- build 실패는 새 작업보다 먼저 복구하고 실패 테스트를 삭제·disable해 green을 연출하지 않는다.

feature flag에는 owner, 대상, 기본값, 관찰 방법과 제거 조건을 둔다. flag가 legacy path를 영구 보관하는 방식이 되지 않게 한다.

## 5. 개선 신호를 올바르게 사용한다

- coverage는 개발자가 놓친 경로를 찾는 도구로 사용하고 개인 평가나 맹목적 gate로 쓰지 않는다.
- 중요한 규칙에는 mutation testing으로 assertion의 실제 민감도를 표본 검사할 수 있다.
- 같은 종류의 defect가 반복되면 개인 주의보다 test, API, tooling, review checklist와 경계를 개선한다.
- 작은 cleanup이 계속 어려우면 시스템의 rigidity 신호로 기록한다.
- 문서, 배포 절차, 계획과 일정도 코드와 마찬가지로 조금씩 개선한다.

metric이 목표가 되면 쉽게 조작된다. coverage, commit 수, story point, PR 수를 품질이나 생산성의 직접 대리값으로 사용하지 않는다.

## 6. 전체 개발 시스템의 생산성을 본다

typing speed보다 build, test, debug, deploy, requirement clarification, meeting과 interruption의 대기 시간을 줄인다.

1. 최근 작업의 lead time을 단계별로 나눈다.
2. 반복되는 가장 큰 대기와 수작업을 측정한다.
3. 한 bottleneck을 자동화하거나 제거한다.
4. 변경 전후 시간을 비교한다.
5. 최적화가 품질과 팀 협업을 해치지 않는지 본다.

build와 빠른 test suite는 자주 실행할 수 있을 만큼 짧게 유지한다. 실제 DB·network·device가 필요 없는 대부분의 테스트에는 작은 seam과 test API를 사용한다. 배포는 반복 가능하고 되돌릴 수 있게 자동화한다.

집중 시간을 보호하되 개인의 몰입을 팀 가용성과 동일시하지 않는다. 불필요한 회의를 줄이고, 필요한 결정·상태 공유·collaboration에는 참여한다. 시간 관리 기법은 실험하고 팀과 개인에 맞는 것을 채택한다.

## 7. 팀 지식을 분산한다

- 핵심 시스템에 한 사람만 알고 있는 경로와 운영 절차가 없는지 찾는다.
- pairing, mobbing, review rotation, runbook rehearsal로 실제 작업 중 지식을 공유한다.
- 업무를 나눌 때 영구적인 subsystem silo보다 overlap과 backup owner를 만든다.
- remote team은 실시간 협업이 필요한 overlap 시간을 합의하고 비동기 기록을 남긴다.
- 도움 요청과 질문이 무능으로 취급되지 않는 환경을 만든다.

모든 작업을 pair로 강제하지 않는다. 위험, 학습 가치, 복잡성과 비용을 보고 적용한다. knowledge sharing이 meeting 수만 늘리고 실제로 다른 사람이 업무를 수행할 수 없으면 방식이 실패한 것이다.

## 8. 추정과 약속을 분리한다

추정은 불확실성의 표현이고 약속은 책임 있는 의사결정이다.

- 이미 정해진 날짜에서 숫자를 역산해 “estimate”라고 부르지 않는다.
- 단일 날짜보다 best/likely/worst 또는 확률 범위로 정확도를 표현한다.
- accuracy와 precision을 구별한다. 좁은 숫자가 더 정확하다는 뜻은 아니다.
- 여러 작업의 범위를 단순 합산할 때 상관관계와 통합 위험을 고려한다.
- known/unknown, 외부 dependency, 탐색이 필요한 항목을 분리한다.
- 일정 압박을 받으면 근거 없는 확답 대신 범위, tradeoff, scope option과 확인 시점을 제시한다.
- “해보겠다”를 숨은 확약으로 쓰지 않는다. 실현 가능한 계획과 필요한 조건을 함께 말한다.

새 정보가 나오면 추정을 갱신하고 이전 수치와 차이를 숨기지 않는다. 추정 실패를 처벌하면 팀은 불확실성을 숨기므로 학습 가능한 원인을 다룬다.

## 9. 존중과 학습을 작업에 포함한다

동료는 직무 관련 행동, 기술, 협업과 윤리 기준으로 평가한다. 정체성, 배경과 개인적 특성을 기술 판단에 섞지 않는다. 의견 충돌에서는 사람 대신 코드, 계약, 위험과 증거를 다룬다.

학습은 남는 시간에만 하는 선택으로 두지 않는다.

- 현재 stack 밖의 언어·paradigm·오래된 기초 자료를 정기적으로 접한다.
- 책, course, conference, user group, code reading과 작은 실험을 섞는다.
- 배운 원칙을 실제 코드에 시험하고 반례와 tradeoff를 기록한다.
- 팀에 공유하되 새 기법을 즉시 표준으로 강제하지 않는다.
- 주간 또는 월간 작은 학습 시간을 일정에 넣고 결과를 회고한다.

## 10. 작업 완료 점검

- 위험과 승인 조건을 공개했는가?
- 요구 동작과 구조가 모두 받아들일 상태인가?
- quick fix와 feature flag에 제거 계획이 있는가?
- 같은 revision을 반복 검증할 command와 artifact가 있는가?
- commit·PR·release 단위가 작고 독립적으로 설명되는가?
- build가 green이고 실패를 숨기지 않았는가?
- 운영·코드 지식이 한 사람에게만 묶이지 않았는가?
- 추정과 약속의 불확실성이 정직하게 전달됐는가?
- 다음 변경을 더 쉽게 만드는 학습이 남았는가?

## 결과

보고에는 위험 수준과 근거, 완료 증거, 임시 부채와 제거 조건, 통합·배포 상태, 결정이 필요한 사람과 시점을 적는다. 개인의 성실성이나 전문성을 근거 없이 평가하지 않는다. 실행하지 않은 테스트, 합의되지 않은 일정, 준비되지 않은 release를 완료라고 표현하지 않는다.
