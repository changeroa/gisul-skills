---
name: "clean-code-tests"
description: "Clean Code 2판의 testing disciplines, clean tests, acceptance testing 원칙으로 테스트 전략과 test code를 작성·리뷰·개선한다. TDD, TCR, small bundles, FIRST, Arrange-Act-Assert, brittle test, slow/flaky test, test DSL, acceptance criteria, regression proof와 refactoring safety를 다룰 때 사용한다."
---

# Clean Code: Tests

테스트를 구현 뒤의 장식이 아니라 동작을 반복 가능하게 증명하고 구조를 안전하게 바꾸는 도구로 만든다. 테스트 수나 coverage 숫자보다 요구 동작을 틀리게 바꿨을 때 빠르고 분명하게 실패하는지를 본다.

이 스킬은 테스트 전략·코드와 실행 가능한 수용 조건을 담당한다. production 함수·객체·아키텍처 자체의 구조 개선은 해당 `clean-code-*` 전문 스킬로 넘기되, 필요한 회귀 증거는 여기서 설계한다. 판본, 14~16장과 부록의 TDD 논쟁은 `skill://gisul/gisul/clean-code/references/sources-and-guardrails.md`에서 확인한다.

## 모드와 권한

리뷰 요청은 읽기 전용이다. 파일 수정은 사용자가 구현·리팩터링을 요청한 범위에서만 수행한다. 테스트·빌드 실행, commit·push·PR·배포와 외부 효과는 호스트와 저장소 정책 및 명시된 권한을 따른다. 사용자의 기존 변경을 덮어쓰거나 무관한 작업을 되돌리지 않는다.

## 1. 테스트할 계약을 정한다

1. 요구사항, 공개 API, 실제 소비자와 실패 조건에서 관찰 가능한 동작을 적는다.
2. 구현 세부사항, 현재 우연한 출력, 의도된 계약을 구별한다.
3. 정상 경로, 경계값, 실패·복구, 중요한 부수 효과와 순서를 포함한다.
4. 단위 테스트, 통합 테스트, 수용 테스트 중 가장 낮은 비용으로 계약을 검증할 수 있는 층을 고른다.
5. GUI, 네트워크, clock, hardware, vendor framework처럼 자동화가 어려운 경계를 얇게 만들고 핵심 정책은 격리해 테스트한다.

기존 구현을 고정하는 characterization test는 리팩터링 안전망이지만 그 동작이 올바른 요구라는 증거는 아니다. 알려진 버그까지 영구 계약으로 만들지 않는다.

## 2. 상황에 맞는 짧은 규율을 선택한다

다음 중 하나를 팀과 작업에 맞게 선택한다. 어느 하나만 전문적인 방식이라고 강요하지 않는다.

- **TDD:** 실패하는 작은 테스트, 통과에 필요한 최소 구현, 설계 정리를 짧게 반복한다.
- **TCR:** 명시적인 commit 권한과 격리된 작업 공간이 있을 때, 테스트가 통과한 agent-owned 변경만 commit하고 실패한 해당 변경만 버려 매우 작은 green step을 유지한다. 사용자의 기존 변경과 섞였거나 안전하게 분리할 수 없으면 되돌리지 말고 중단해 상태를 보고한다.
- **Small bundles:** 응집된 작은 코드 묶음과 테스트를 같은 주기에 완성한다. 코드와 테스트의 선후는 유연하지만 묶음이 커지기 전에 green 상태를 만든다.

어떤 규율이든 공통 요구는 같다.

- 피드백이 빠르고 반복 가능하다.
- 코드를 working 상태로 만든 뒤 구조를 검토하고 정리한다.
- 테스트를 나중으로 무기한 미루지 않는다.
- 큰 설계와 architecture는 테스트 한 개의 전술적 루프와 별도로 생각한다.
- passing tests를 좋은 설계의 증명으로 착각하지 않는다.

TDD가 흐름을 방해하거나 너무 전술적으로 만들면 더 큰 coherent bundle을 사용할 수 있다. 반대로 bundle이 커져 debugging 범위와 누락 위험이 커지면 주기를 줄인다.

## 3. 읽기 쉬운 테스트를 쓴다

한 테스트는 실패했을 때 어떤 계약이 깨졌는지 바로 알려야 한다.

- **Arrange:** 의미 있는 입력과 전제 상태를 만든다.
- **Act:** 핵심 행동을 한 번 수행한다.
- **Assert:** 관찰 가능한 결과와 필요한 부수 효과를 검증한다.

“assert 하나”를 문자 그대로 적용하지 않는다. 하나의 논리적 결과에 여러 검증이 필요할 수 있다. 대신 서로 다른 Act와 시나리오를 한 테스트에 연속으로 넣어 원인을 흐리지 않는다.

- 테스트 이름은 조건, 행동, 기대 결과 중 필요한 맥락을 드러낸다.
- fixture와 helper는 도메인 언어를 만들되 테스트 본문에서 중요한 값과 차이를 숨기지 않는다.
- 반복되는 저수준 준비와 검증은 builder, factory, custom matcher, composed assertion으로 표현한다.
- 테스트 DSL은 실제 반복에서 점진적으로 만든다. 예상 사용을 위해 거대한 framework를 먼저 만들지 않는다.
- 실패 메시지에는 비교 대상과 의미 있는 차이가 드러나게 한다.
- parameterized test는 같은 계약의 사례 표에 적합하다. 서로 다른 이유의 실패를 한 표에 억지로 합치지 않는다.

## 4. FIRST 특성을 유지한다

### Fast

가장 자주 실행할 테스트는 빠르게 유지한다. 느린 테스트를 별도 층으로 분리할 수 있지만 아무도 실행하지 않는 suite로 방치하지 않는다. 실제 외부 시스템이 필요하지 않은 테스트에서 network, sleep, 전체 앱 시작을 제거한다.

### Isolated

테스트 간 순서, 공유 mutable fixture, 공용 계정, 이전 실행 결과에 의존하지 않는다. 각 테스트가 필요한 상태를 만들고 정리한다. 병렬 실행에서도 충돌할 자원 이름과 포트를 통제한다.

### Repeatable

시간, 난수, timezone, locale, scheduler, network와 환경 변수를 제어한다. 단순히 retry해서 green으로 만드는 대신 flaky 원인을 찾는다. 실제 경쟁 조건을 보는 테스트는 반복·seed·환경을 기록한다.

### Self-validating

사람이 로그나 화면을 해석해야만 성공을 아는 테스트 대신 명확한 pass/fail oracle을 둔다. 승인 테스트나 visual snapshot은 의도된 변경과 noise를 구별할 review 절차를 포함한다.

### Timely

production code와 같은 변경 주기에 테스트를 작성한다. 테스트하기 어려움이 나타나면 설계 결합의 신호로 사용하되, 테스트만을 위해 public API를 왜곡하지 않는다.

## 5. 구현이 아닌 행위를 검증한다

- private method 호출, 내부 collection 모양, 정확한 call count처럼 계약이 아닌 세부사항에 과결합하지 않는다.
- mock은 외부 effect를 격리하거나 상호작용 자체가 계약일 때 사용한다. 모든 collaborator를 mock해 실제 조합을 검증하지 못하는 상태를 피한다.
- state 검증과 interaction 검증 중 요구사항에 가까운 쪽을 택한다.
- 테스트를 통과시키기 위해 production abstraction을 불필요하게 노출하지 않는다.
- production 변경 하나가 수십 테스트의 fixture를 같은 방식으로 깨뜨리면 test API와 coupling을 정리한다.
- 테스트 코드는 production과 다른 성능 기준을 가질 수 있지만 명료성과 신뢰성은 낮춰도 된다는 뜻이 아니다.

## 6. 수용 테스트로 완료를 정의한다

수용 테스트는 기능 수준의 실행 가능한 요구사항이다.

1. 이해관계자와 입력, 행동, 기대 결과를 Given–When–Then 또는 AAA 형태로 표현한다.
2. happy path뿐 아니라 권한, 잘못된 입력, 외부 실패, 취소와 복구를 포함한다.
3. business analyst·QA·product가 읽고 의도를 승인할 수 있는 언어를 사용한다.
4. 개발자가 초안을 자동화할 수 있지만 요구 의도를 독자적으로 발명하지 않는다.
5. feature의 완료는 합의된 수용 조건이 모두 통과할 때로 정의한다.
6. CI에서 단위·통합·수용 suite를 적절한 주기로 실행하고 실패를 정상 상태로 누적하지 않는다.

수용 테스트가 모든 탐색적 테스트, 성능·보안·사용성 검증을 대신하지 않는다. 자동화 가능한 계약의 증거 범위를 명시한다.

## 7. coverage와 mutation을 올바르게 사용한다

- coverage는 실행되지 않은 위험 경로를 찾는 피드백 도구다. 높은 비율만으로 강한 assertion과 올바른 oracle을 증명하지 못한다.
- 목표 숫자를 맞추려고 가치 없는 테스트를 만들거나 unreachable code를 억지로 실행하지 않는다.
- mutation testing은 테스트가 의미 변화에 반응하는지 표본 점검하는 데 유용하다. 전체 저장소에 항상 강제하지 말고 중요한 규칙과 의심스러운 coverage에 적용한다.
- surviving mutant는 누락된 assertion, equivalent mutation, 죽은 코드 중 무엇인지 분류한다.
- 테스트 suite가 의도된 semantic change에는 실패하고 안전한 구조 변경에는 유지되는지 본다.

## 8. 테스트 리뷰와 개선 순서

1. 실패가 설명하려는 계약을 확인한다.
2. flaky·느린·순서 의존 테스트부터 신뢰를 회복한다.
3. 한 테스트에 섞인 시나리오와 Act를 나눈다.
4. 반복 setup/assertion에서 작은 도메인 언어를 추출한다.
5. 구현 결합을 줄이고 observable behavior로 assertion을 옮긴다.
6. 빠른 suite와 실제 경계 suite의 역할을 명시한다.
7. 변경 전후에 관련 suite를 실행하고 test-only failure도 숨기지 않는다.

테스트 정리 중 production behavior를 바꾸지 않는다. test와 production을 동시에 바꿔 이전 실패를 지워야 한다면 요구사항 변경인지 먼저 확인한다.

## 결과

테스트 제안에는 보호할 계약, 실패할 조건, 가장 알맞은 테스트 층, 필요한 fixture와 oracle을 적는다. 구현했다면 새 테스트가 실제로 이전 결함이나 mutation을 잡는지, 실행 시간과 isolation이 어떤지 보고한다. 실행하지 않은 suite, 외부 환경 때문에 미검증인 계약, 실제 이해관계자 승인이 필요한 수용 조건을 구분한다.
