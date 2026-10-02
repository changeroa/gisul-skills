---
name: "clean-code-design"
description: "Clean Code 2판의 simple design, SOLID, component principles, continuous design을 적용해 software design을 리뷰하거나 점진적으로 개선한다. YAGNI, real duplication, testability, SRP/OCP/LSP/ISP/DIP, component cohesion·coupling, dependency cycle, over-abstraction, changeability를 판단할 때 사용한다."
---

# Clean Code: Design

현재 요구를 분명하게 구현하면서 다음의 가능성 있는 변경 비용을 낮춘다. 설계 원칙은 패턴을 많이 사용하거나 diagram을 이상적으로 만드는 규칙이 아니다. 무엇을 보호하고 무엇을 쉽게 바꿀지 결정하는 도구다.

한 함수·클래스의 국소 정리는 각각 `clean-code-functions`, `clean-code-objects`를 우선한다. 시스템 정책과 framework·database 경계는 `clean-code-architecture`가 주 책임이다. 장별 근거와 한계는 `skill://gisul/gisul/clean-code/references/sources-and-guardrails.md`를 따른다.

## 모드와 권한

리뷰 요청은 읽기 전용이다. 파일 수정은 사용자가 구현·리팩터링을 요청한 범위에서만 수행한다. 테스트·빌드 실행, commit·push·PR·배포와 외부 효과는 호스트와 저장소 정책 및 명시된 권한을 따른다. 사용자의 기존 변경을 덮어쓰거나 무관한 작업을 되돌리지 않는다.

## 1. 현재 변화와 비용을 조사한다

1. 요구사항과 주요 use case, public contract, 불변식, 외부 effect를 확인한다.
2. 변경 이력과 호출 경로에서 무엇이 실제로 함께 바뀌고 무엇이 독립적으로 바뀌는지 찾는다.
3. module·package·component dependency와 build/release 단위를 그린다.
4. 테스트 경계와 배포 경계를 확인한다. 테스트하기 어려움과 작은 변경의 큰 redeploy가 결합의 증거인지 본다.
5. 현재 문제, 곧 필요한 변화, 단지 상상한 미래를 구별한다.

한 파일이나 class 모양만 보고 architecture 결론을 내리지 않는다. 실제 소비자와 수정 경로를 최소 한 번 추적한다.

## 2. 단순 설계를 우선순위로 판단한다

다음 질문을 순서대로 사용하되 뒤 항목을 위해 앞 항목을 희생하지 않는다.

1. **동작 증거:** 요구 동작이 빠르고 신뢰할 수 있는 테스트로 확인되는가?
2. **의도 표현:** 이름, 구조와 경계가 정책을 드러내는가?
3. **의미 중복:** 같은 지식과 변경 이유가 여러 표현으로 흩어졌는가?
4. **불필요한 크기:** 위 세 가지를 지키면서 더 적은 개념과 코드로 표현할 수 있는가?

작은 코드가 항상 단순한 것은 아니다. 숨은 상태, 압축된 한 줄, 거대한 generic framework는 line 수가 적어도 이해와 변경 비용이 클 수 있다.

## 3. YAGNI를 위험 결정으로 적용한다

아직 필요하지 않은 기능과 extension point에는 현재 비용이 있다. 다음을 비교한다.

- 그 변화가 실제로 일어날 가능성과 시점
- 나중에 추가할 때 드는 migration·호환성 비용
- 지금 abstraction을 유지·학습·테스트하는 비용
- 잘못 예측한 abstraction을 제거하는 비용
- 지금 되돌릴 수 있는 결정인지

나중 변경 비용이 작고 필요성이 불확실하면 구현하지 않는다. 반대로 public data format, irreversible migration, regulatory boundary처럼 뒤늦게 바꾸기 매우 비싼 선택은 미리 보호할 수 있다. YAGNI를 설계 사고 금지나 기술 부채 정당화로 쓰지 않는다.

## 4. SOLID를 구체적인 변경 압력에 적용한다

### Single Responsibility Principle

module을 메서드 개수로 나누지 않는다. 서로 다른 actor와 이유로 바뀌는 정책이 결합되어 한 변경이 다른 정책을 위험하게 만들 때 분리한다. 함께 변하는 것은 가까이 둔다.

### Open–Closed Principle

자주 추가되는 변형 때문에 안정된 정책의 여러 위치를 계속 수정한다면 table, strategy, polymorphism, registration 같은 extension seam을 검토한다. 모든 축을 무한히 열려고 하지 말고 실제로 반복되는 변화만 보호한다.

### Liskov Substitution Principle

subtype이 base contract의 precondition을 강화하거나 postcondition을 약화하고, 호출자가 type check와 예외 처리로 보정해야 한다면 잘못된 추상화인지 본다. method signature가 같다는 사실보다 관찰 가능한 행동 계약을 비교한다.

### Interface Segregation Principle

소비자가 쓰지 않는 operation과 dependency를 함께 알아야 한다면 역할별 interface를 검토한다. interface가 잘게 쪼개져 wiring과 탐색만 늘면 소비자 기준으로 다시 묶는다.

### Dependency Inversion Principle

바뀌기 어려운 high-level policy가 volatile detail에 직접 의존하면 policy가 필요로 하는 interface를 안쪽에 정의하고 detail이 구현하게 한다. 모든 class에 interface를 만들거나 DI container를 도입할 필요는 없다. 구성과 구체 타입 의존은 작은 composition boundary에 모을 수 있다.

“SOLID 위반”만으로 발견 사항을 만들지 않는다. 어떤 요구 변화에서 몇 곳이 잘못 바뀌고 어떤 오용이나 재배포 비용이 생기는지 설명한다.

## 5. 중복과 추상화 비용을 비교한다

- 같은 정책, 공식, schema, validation rule이 반드시 함께 바뀐다면 권위 있는 한 표현으로 모은다.
- 비슷한 텍스트라도 다른 actor와 lifecycle을 가지면 우연한 유사성일 수 있다.
- 공통화 후 flag, optional hook, type check가 늘어난다면 서로 다른 개념을 억지로 합친 것인지 본다.
- abstraction은 이름, 좁은 interface와 안정된 invariant를 제공해야 한다.
- 단순 pass-through layer와 factory chain이 독자의 탐색만 늘리면 제거하거나 합친다.
- 새 dependency나 framework가 해결하는 현재 capability와 표준 대안을 비교한다.

“세 번째 중복부터 추출” 같은 숫자도 heuristic일 뿐이다. 변경 이유와 지식의 동일성이 판단 기준이다.

## 6. 컴포넌트 응집도를 release와 reuse로 본다

component/package 경계에는 서로 충돌하는 세 힘이 있다.

- 함께 release·versioning해야 하는 코드를 모은다.
- 같은 이유와 시점에 바뀌는 코드를 모아 변경 배포 범위를 줄인다.
- 함께 재사용되지 않는 코드는 소비자에게 억지 dependency로 묶지 않는다.

프로젝트 초기에는 developability와 common change가 reuse 순도보다 중요할 수 있다. 실제 reuse와 독립 release 요구가 생기면 경계를 다시 조정한다. component 수를 미리 최대화하지 않는다.

## 7. 컴포넌트 의존성을 관리한다

- dependency graph의 cycle이 build, initialization, test, release와 ownership에 실제 문제를 만드는지 확인한다.
- cycle을 끊을 때 interface inversion 또는 양쪽이 공통으로 의존할 새 component를 검토한다.
- 불안정하고 자주 변하는 component가 안정적이고 많은 소비자를 가진 component를 지배하지 않게 한다.
- 매우 안정된 component는 확장을 허용할 abstraction이 필요할 수 있고, 쉽게 교체할 volatile leaf는 concrete여도 된다.
- coupling·instability metric은 이상 지점을 찾는 진단 도구로만 쓴다. 모든 package를 계산표에 맞추지 않는다.

component 구조는 처음부터 완성되는 것이 아니다. module 설계, release와 팀 현실에서 점진적으로 나타나게 한다.

## 8. 지속적으로 설계한다

모든 feature 변경을 작은 설계 피드백으로 사용한다.

- **Clarity:** 의도와 정책이 드러나는가?
- **Conciseness:** 불필요한 개념 없이 표현되는가?
- **Confirmability:** 동작을 빠르고 반복 가능하게 확인할 수 있는가?
- **Cohesion:** 한 단위의 요소가 같은 목적과 변경 이유를 공유하는가?

추정할 때 작은 요구가 현재 구조에서 비정상적으로 어렵다면 design resistance로 기록한다. feature를 억지로 밀어 넣기 전에 가장 작은 구조 개선을 수행한다. 그러나 매번 전체 redesign을 조건으로 만들지 않는다.

## 9. 변경과 검증

1. 해결하려는 현재 변경 시나리오와 보호할 policy를 한 문장으로 적는다.
2. 현 구조를 유지하는 대안, 작은 국소 변경, 큰 redesign의 비용을 비교한다.
3. 테스트로 현재 behavior와 새 extension contract를 고정한다.
4. 이동·rename·interface 도입을 작은 단계로 나누고 각 단계 후 build와 test를 실행한다.
5. public API, serialization, deployment와 dependency graph 변화를 확인한다.
6. 새 abstraction에 실제 소비자가 있고 기존보다 수정 지점과 탐색 비용이 줄었는지 확인한다.
7. speculated future만을 위한 hook, unused implementation, compatibility shim의 제거 조건을 남긴다.

## 결과

리뷰 결과에는 보호할 policy, 실제 change scenario, 현재 dependency가 만드는 비용, 최소 개선과 선택하지 않은 큰 대안을 적는다. 수정했다면 component/API 변화, 보존한 계약, 실행한 테스트와 build를 보고한다. 원칙 이름이나 metric만으로 merge-blocking 결론을 내리지 않는다.
