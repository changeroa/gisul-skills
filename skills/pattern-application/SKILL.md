---
name: "pattern-application"
description: "Select and apply design patterns from concrete problems, forces, simple alternatives and collaboration contracts. Use for Adapter, Strategy, Composite, Facade, Observer, Factory, Singleton, Proxy, State, Command, Template Method, Abstract Factory, Polymorphism, Pure Fabrication, Indirection and Protected Variations tradeoffs, participant responsibilities, lifecycle and validation. 실제 설계 문제와 변화 축에 맞는 패턴과 단순 대안을 비교·적용한다."
---

# Pattern Application

패턴은 현재 문제의 책임·협력을 표현하는 도구다. 적용 개수를 최대화하지 않는다.
이름부터 선택하지 말고 실제 문제, 단순 대안과 보존할 계약에서 출발한다.
class 대신 함수, table, module 또는 언어의 protocol이 더 단순하면 그것을 선택한다.

## 작업 범위

- 리뷰와 설계 제안은 읽기 전용이며 구현은 요청한 범위에서만 한다.
- 현재 요구, 호출자, 상태·오류 계약과 테스트를 확인한다.
- 읽지 않은 코드나 실행하지 않은 검증을 완료했다고 표현하지 않는다.
- 패턴 도입을 이유로 공개 계약, effect 순서나 저장 형식을 몰래 바꾸지 않는다.
- 알려진 변형과 불확실한 미래 예측을 구분한다.

## 1. 문제와 forces를 명시한다

다음을 짧게 기록한다.
1. 실패하거나 비싸진 현재 변경·사용 시나리오.
2. 유지해야 할 동작, 불변식과 관찰 가능한 계약.
3. 변하는 부분과 안정되어야 할 소비자.
4. 통제할 수 없는 API·구현·수명·성능 조건.
5. 현재 결합·중복·순서 의존이 만드는 실제 비용.
6. 교체가 실제 필요한지, 단지 가능하면 좋겠다는 것인지.

문제 표현은 패턴 이름을 포함하지 않아도 이해되어야 한다.
`확장성을 높인다` 대신 어떤 변형 추가에서 어느 호출자가 영향을 받는지 쓴다.
현 변형점과 미래 진화점을 구별하고 후자는 가능성·시점·변경 비용을 근거로 삼는다.
예측이 틀린 추상화를 유지·삭제하는 비용도 포함한다.

## 2. 가장 단순한 대안을 먼저 만든다

- 직접 호출, 조건문 하나, 불변 데이터와 함수, 작은 table을 비교한다.
- 현재 구조 유지 또는 국소 책임 이동만으로 해결되는지 본다.
- switch가 한 경계에서 닫힌 경우들을 명확히 다루면 적절할 수 있다.
- 여러 위치의 같은 타입 분기가 계속 함께 바뀌면 polymorphism을 검토한다.
- 작은 설정값 변화와 알고리즘 변화, 구현 교체를 구분한다.
- 데이터 외부화만 필요한데 reflection·플러그인·인터프리터를 도입하지 않는다.
- 추상화가 없어도 나중 변경이 싸면 지금 보호하지 않을 수 있다.

## 3. 최소 후보와 책임 메커니즘을 고른다

- **Polymorphism:** 관련 변형의 다른 행위를 각 변형 참가자에 배치한다.
- **Pure Fabrication:** 기존 정보 소유자 배치가 관심사 혼합을 만들 때 응집된 협력자를 만든다.
- **Indirection:** 해로운 직접 의존을 중개자로 끊고 추가 비용을 명시한다.
- **Protected Variations:** 확인된 불안정 지점 주위에 안정된 접근 계약을 만든다.

이들은 함께 작동할 수 있지만 동시에 모두 도입할 필요는 없다.
정보 소유자가 직접 처리할 책임을 helper로 모두 빼앗지 않는다.
인터페이스는 접근 계약이며 반드시 언어의 interface 선언이어야 하는 것은 아니다.
한 패턴의 문제를 해결하려고 새 문제가 생기면 추가 패턴보다 단순한 구성을 먼저 재검토한다.

## 4. 후보를 구체적인 문제에 맞춘다

### Adapter: 고정된 외부 인터페이스의 불일치

애플리케이션이 필요한 계약을 정의하고 외부 호출·값·오류를 변환한다.
참가자는 client, application-facing contract, adapter, 외부 adaptee다.
client → adapter → 외부 API → application 의미의 결과 흐름을 추적한다.
외부 SDK 전체를 wrapper에 복제하지 않고 실제 필요한 능력만 노출한다.
단순히 이름을 바꾸는 전달이라면 직접 의존과 비교한다.
검증: 단위·상태·오류·빈 결과·외부 실패가 내부 계약으로 정확히 변환되는가?

### Strategy: 관련 알고리즘·정책의 교체

context는 안정된 정책 호출 계약에 위임하고 strategy가 변형 계산을 수행한다.
선택·생성 시점과 실행 시점을 구별하며 필요한 입력만 제공한다.
전체 context 전달은 협력을 쉽게 하지만 넓은 권한과 의존을 주므로 대안을 비교한다.
계산 결과를 얻으려다 context의 같은 계산으로 재진입하는 순환을 피한다.
단순 함수나 table로 충분하면 class family를 만들지 않는다.
검증: 경곗값·불변식·오류 계약이 모든 전략에 유지되고 정책 교체가 client를 바꾸지 않는가?

### Composite: 단일과 그룹의 동일 취급

leaf와 composite가 같은 의미의 연산 계약을 제공해야 한다.
composite는 자식 목록을 소유하고 명시된 결합 정책으로 결과를 만든다.
최솟값·최댓값·합산·순서 적용은 요구 정책이며 패턴 이름이 결정하지 않는다.
자식 추가 시점, 중복, 제거, empty group과 중첩의 의미를 정한다.
그룹을 순회하는 함수 하나로 충분하면 재귀 객체 구조를 강요하지 않는다.
검증: 단일 자식 동등성, 빈 그룹, 중첩, 순서 민감성, 중복과 순환을 확인한다.

### Facade: 하위시스템에 대한 일관된 진입점

client가 필요한 시나리오 의미의 API로 내부 협력을 숨긴다.
facade가 모든 내부 정책을 직접 수행하는 거대 객체가 되지 않게 한다.
Adapter는 인터페이스 변환, Facade는 하위시스템 접근 단순화가 주된 의도다.
구현체가 여러 개라는 이유만으로 거대한 범용 규칙 엔진을 만들지 않는다.
검증: 내부 타입이 새지 않고 거절·부분 실패가 호출자에게 명시적으로 전달되는가?

### Observer: 동적인 선택적 구독자 통지

publisher는 구체 화면·소비자 대신 작은 listener 계약에 의존한다.
subscriber가 등록·해제하고 publisher가 유효한 상태 변경 이후 통지한다.
구독자가 0개여도 publisher의 핵심 책임은 정상 동작해야 한다.
동기 callback, 비동기 전달과 분산 메시징은 별도 보장 모델이다.
Observer라는 이름만으로 순서·재시도·내구성·정확히 한 번 전달을 주장하지 않는다.
검증: 0/1/다수, 중복 등록, 해제, 재진입, listener 실패와 dispatch context를 확인한다.

### Factory: 복잡한 생성·선택·수명의 분리

유효한 생성 데이터와 반환 계약, 구현 선택 및 소유권을 명시한다.
단순 생성은 이미 대상을 소유·기록·밀접 사용한 객체에 둘 수 있다.
복잡한 선택·pooling·재활용·설정 읽기가 생길 때 응집된 생성 협력자를 검토한다.
Simple Factory, Factory Method와 Abstract Factory를 같은 구조로 취급하지 않는다.
Factory Method는 재정의 가능한 생성 hook, Abstract Factory는 관련 제품군 생성 계약이다.
검증: 불완전 객체 노출, 잘못된 설정, 자원 해제, cache 수명과 정책 신선도를 확인한다.

### Singleton: cardinality와 전역 접근을 분리

인스턴스가 하나 필요하다는 사실은 전역 조회가 필요하다는 증거가 아니다.
먼저 composition boundary에서 하나 생성해 명시적으로 전달하는 대안을 비교한다.
필요한 범위가 process, tenant, request인지 정하고 복수 환경 요구를 확인한다.
factory나 facade라는 이유만으로 singleton을 채택하지 않는다.
lazy/eager 생성은 비용·실패 시점·동시성으로 선택하고 lazy를 기본 정답으로 삼지 않는다.
검증: concurrent initialization, 숨은 상태, 테스트 격리, cleanup과 교체 가능성을 확인한다.

### Proxy·State·Command·Template Method: 추가 압력이 있을 때만

Proxy는 같은 역할의 대리 접근이고 Adapter의 인터페이스 변환과 구별한다.
cache·failover proxy는 freshness·durability·허용된 degraded behavior까지 보존해야 한다.
State는 상태별 행위·전이가 복잡할 때 검토하고 상태표나 단순 조건과 비교한다.
Command는 작업의 저장·queue·정렬·재실행이 필요할 때 행위를 명시적인 요청으로 만든다.
undo 메서드 존재만으로 transaction rollback이나 외부 effect 취소를 보장하지 않는다.
Template Method는 반복 알고리즘의 불변 skeleton과 제한된 hook을 분리한다.
상속 결합보다 함수 주입·조합이 단순하면 후자를 택한다.
Abstract Factory는 실제로 호환되어야 하는 제품군이 있을 때만 도입한다.
단순 구현 하나 선택을 위해 제품군 계층을 만들지 않는다.
선택·참여책임·실패 QA는 [추가 협력 계약](references/advanced-collaborations.md)을 적용한다.

### Persistence와 framework 적용 제한

검증된 ORM·저장 도구의 지원범위와 현재 동작을 먼저 확인한다.
패턴 학습을 이유로 자체 ORM·transaction engine을 기본 해법으로 만들지 않는다.
identity map·mapper·lazy proxy·상태 모델은 별도 책임이며 하나로 모두 해결되지 않는다.
실제 DB의 identity scope, commit/rollback, concurrent update와 query 수를 검증한다.

## 5. 참가자 책임과 상호작용을 구체화한다

1. 각 참가자의 knowing/doing 의무와 소유한 불변식을 적는다.
2. 진입 연산부터 sender → receiver → request/result 순서로 추적한다.
3. 각 호출에 필요한 참조가 언제 어떻게 생기는지 기록한다.
4. 생성, 등록, 교체, 해제와 종료 책임을 지정한다.
5. 성공, 거절, timeout과 중간 실패에서 남는 상태를 적는다.
6. 대체 구현이 precondition을 강화하거나 결과 보장을 약화하지 않는지 확인한다.
7. 정적 의존성과 동적 호출 방향을 구별하고 새 순환 의존을 확인한다.
8. 어려운 흐름만 스케치하고 나머지는 코드·테스트로 확인한다.

패턴 참여자마다 반드시 별도 클래스가 필요하지는 않다.
유효한 no-op 변형은 가능하지만 미구현 기능을 조용히 성공시키는 no-op과 구별한다.
도메인 개념을 발견하면 모델을 갱신할 수 있지만 문서 갱신 자체를 설계 성공으로 삼지 않는다.

## 6. tradeoff와 제거 조건을 기록한다

- 어떤 불안정 의존을 제거했고 어떤 새 계약·호출·상태를 추가했는가?
- 생성·설정·탐색·오류 진단·테스트 setup이 얼마나 복잡해졌는가?
- 전역 상태, callback 수명, 원격 hop이나 reflection 비용이 생겼는가?
- 책임이 정보에서 멀어져 bulk data 전달이 늘었는가?
- 단순 대안보다 현재 변경 지점과 검증 비용이 실제로 줄었는가?
- 예상한 변화가 오지 않거나 소비자가 사라지면 언제 제거할 것인가?

## 7. 검증과 보고

기존 관찰 동작을 고정하고 가장 작은 변경 단위로 구현한다.
패턴 구조가 아니라 참가자 계약, 상태 전이와 실패 결과를 테스트한다.
계산·정책 테스트와 실제 외부 경계 통합 테스트를 구별한다.
동일 계약에 여러 구현을 대입하고 원래 client의 추가 type check가 필요한지 본다.
부수효과 순서·transaction·재시도·serialization 변화를 확인한다.
측정하지 않은 성능 개선이나 실행하지 않은 테스트 결과를 주장하지 않는다.

결과는 `문제/forces → 단순 대안 → 선택 후보 → 책임/메시지 → tradeoff → 검증`으로 쓴다.
선택하지 않은 패턴과 그 이유를 적어도 하나 기록한다.
미확인 범위와 필요한 다음 검증을 명시하고 패턴 이름만으로 결함이나 완료를 선언하지 않는다.
