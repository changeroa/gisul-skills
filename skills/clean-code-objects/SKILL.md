---
name: "clean-code-objects"
description: "Clean Code 2판의 objects, data structures, clean classes 원칙으로 객체·데이터 모델과 클래스 응집도를 리뷰하거나 리팩터링한다. getter/setter 남용, anemic·hybrid object, feature envy, Law of Demeter, DTO, class responsibility, public surface, 객체 대 절차형 설계의 tradeoff를 다룰 때 사용한다."
---

# Clean Code: Objects and Classes

데이터 표현을 숨기고 행위를 요청하는 **객체**와, 데이터를 명시적으로 전달하는 **데이터 구조**를 의도적으로 선택한다. 둘을 섞어 양쪽의 단점만 얻지 않게 하고, 클래스나 모듈은 실제 변경 이유를 중심으로 응집시킨다.

함수 내부 정리는 `clean-code-functions`, 컴포넌트·서비스 수준 경계는 `clean-code-design` 또는 `clean-code-architecture`가 주 책임이다. 장별 근거와 적용 한계는 `skill://gisul/gisul/clean-code/references/sources-and-guardrails.md`를 따른다.

## 모드와 권한

리뷰 요청은 읽기 전용이다. 파일 수정은 사용자가 구현·리팩터링을 요청한 범위에서만 수행한다. 테스트·빌드 실행, commit·push·PR·배포와 외부 효과는 호스트와 저장소 정책 및 명시된 권한을 따른다. 사용자의 기존 변경을 덮어쓰거나 무관한 작업을 되돌리지 않는다.

## 1. 현재 모델의 역할을 확인한다

1. 대상 타입의 생성자, public API, 모든 호출자, serialization, persistence, framework binding과 테스트를 찾는다.
2. 어떤 불변식을 타입이 소유하는지, 누가 상태를 만들고 변경하며 검증하는지 추적한다.
3. 새 **타입**이 자주 추가되는지, 기존 데이터에 새 **연산**이 자주 추가되는지 변경 이력을 확인한다.
4. public contract와 저장 형식을 구분한다. 내부 구조를 바꿔도 API·DB·event schema가 자동으로 바뀌어서는 안 된다.
5. 해당 코드가 domain object, DTO, record/value, ORM entity, message, view model, configuration 중 무엇인지 식별한다.

레이어 이름이나 패턴만 보고 결함을 정하지 않는다. 이 타입이 보호해야 할 정책과 소비자가 실제로 필요한 표현이 판단 기준이다.

## 2. 객체와 데이터 구조를 의도적으로 고른다

### 객체가 적합한 경우

- 상태를 직접 꺼내 계산하기보다 의미 있는 행위를 요청할 수 있다.
- 불변식과 상태 전이가 타입 안에서 보호되어야 한다.
- 새 타입과 변형이 늘고 각 타입의 동작이 다르다.
- 표현을 바꿔도 호출자를 유지하고 싶다.

객체는 단지 private field와 getter/setter의 묶음이 아니다. `getX()`로 내부를 꺼낸 뒤 호출자가 규칙을 수행한다면 데이터 표현만 우회 공개한 것인지 본다. 대신 `approve()`, `totalPrice()`, `canTransitionTo()`처럼 정책을 요청할 수 있는지 검토한다.

### 데이터 구조가 적합한 경우

- 경계를 통해 값을 운반하거나 직렬화하는 것이 주 목적이다.
- 데이터 형태가 안정적이고 그 위에 새로운 연산이 자주 추가된다.
- SQL row, API payload, event, immutable value처럼 투명한 표현이 소비자에게 필요한 계약이다.
- 함수형·데이터 지향 설계가 언어와 성능 요구에 더 맞는다.

DTO나 record는 결함이 아니다. 억지 동작을 넣어 pseudo-object로 만들지 않는다. 데이터 구조에 많은 사업 동작을 붙이고 동시에 모든 필드를 노출하는 hybrid가 되면 표현 결합과 분산 정책이 함께 생기는지 점검한다.

## 3. 표현보다 추상적 계약을 노출한다

- public API는 저장 필드가 아니라 소비자가 수행해야 할 일과 확인해야 할 사실을 표현한다.
- setter로 어떤 값이든 허용한 뒤 외부에서 순서를 맞추게 하지 않는다. 유효한 생성과 전이를 제공한다.
- primitive가 단위, 식별자, 상태 규칙을 반복해서 잃게 만들면 value object나 domain type을 고려한다.
- 모든 primitive를 감싸지 않는다. 타입이 실제 오용을 막거나 공통 규칙을 모을 때만 가치가 있다.
- collection을 직접 반환할 때 mutation 권한, 정렬, 중복, snapshot 여부를 계약으로 정한다.
- 내부 ORM·SDK·framework 타입이 public contract로 새어 나가 변경을 전파하는지 본다.

정보 은닉은 테스트를 어렵게 만드는 비밀주의가 아니다. public behavior로 불변식을 검증할 수 있어야 하고, 필요하면 경계에서 간단한 데이터 표현을 사용한다.

## 4. 협력 객체를 탐색하는 코드를 줄인다

객체가 다른 객체의 내부 구조를 연쇄적으로 탐색하고 그 데이터를 조작하면 결합이 깊어진다.

- `a.getB().getC().doD()`가 객체 내부를 아는 것인지, 단순 DTO 구조를 읽는 것인지 구별한다.
- 객체라면 필요한 동작을 가장 가까운 소유자에게 요청해 collaborator의 표현을 숨길 수 있는지 본다.
- 데이터 구조라면 field navigation 자체를 Law of Demeter 위반으로 몰지 않는다.
- method chaining이나 fluent API는 내부 탐색과 다르다. 반환 객체가 같은 추상화의 연속 연산인지 확인한다.
- behavior를 옮길 때 새 클래스가 너무 많은 외부 의존성을 끌어들이거나 순환 참조를 만드는지 본다.

feature envy는 이동 후보이지 자동 결함이 아니다. 계산에 필요한 데이터의 소유자, 변경 이유, 계층 경계를 함께 고려한다.

## 5. 클래스와 모듈의 응집도를 판단한다

클래스 크기는 메서드 수보다 **변경 이유와 정책의 결속**으로 본다.

- 한 actor의 요구가 바뀔 때 함께 바뀌는 상태와 동작을 모은다.
- 세금, 할인, 저장, 표시처럼 서로 다른 이유로 변하는 정책이 한 타입에서 얽히면 분리를 검토한다.
- 대부분의 메서드가 일부 field만 사용하고 서로 다른 field 집합이 반복되면 숨은 책임이 있는지 본다.
- 이름을 짓기 위해 `Manager`, `Processor`, `Data`, `Utils` 같은 모호한 단어가 필요하다면 실제 책임을 다시 찾는다.
- public method를 줄이고, 안정된 작은 interface 뒤에 충분한 기능을 숨기는 깊은 모듈을 선호한다.
- façade가 소비자에게 일관된 진입점을 제공한다면 내부 정책을 위임해도 유지할 수 있다.
- 클래스와 파일을 동일시하지 않는다. 언어의 module, package, namespace, closure도 책임 경계가 될 수 있다.

“한 메서드당 한 클래스”나 “필드가 N개 이상이면 분리” 같은 수치 규칙은 쓰지 않는다. 작은 클래스가 탐색과 wiring만 늘리면 더 나쁜 설계일 수 있다.

## 6. OO와 절차형·데이터 지향 설계의 tradeoff를 쓴다

- 새 타입을 자주 추가하고 기존 연산을 유지한다면 polymorphism이 변경을 국소화할 수 있다.
- 타입 집합이 안정적이고 새 연산을 자주 추가한다면 데이터 구조와 별도 함수가 더 단순할 수 있다.
- switch가 한 경계에서 명시적으로 모든 경우를 처리하면 적절할 수 있다.
- 동일한 switch가 여러 모듈에 복제되어 새 타입마다 함께 바뀐다면 factory, table, polymorphism을 검토한다.
- 성능·메모리·vectorization 요구가 중요한 경우 데이터 지향 표현이 우선할 수 있다. 측정 없이 OO가 항상 느리거나 항상 깨끗하다고 단정하지 않는다.
- 언어가 algebraic data type, pattern matching, protocol, typeclass를 제공하면 해당 관용구를 사용한다.

패턴 선택은 현재 변화 축을 위한 결정이다. 모든 미래 연산과 타입에 동시에 열려 있는 설계를 만들려 하지 않는다.

## 7. 안전하게 책임을 이동한다

1. 기존 public behavior와 불변식을 테스트로 고정한다.
2. 이름과 value object처럼 작은 변환으로 개념을 드러낸다.
3. 관련 데이터 가까이 계산을 옮기고 기존 API에서 위임한다.
4. 다른 이유로 변하는 정책을 추출하되 새로운 interface의 실제 소비자를 확인한다.
5. 생성과 dependency wiring을 composition point에 모은다.
6. transition 동안 adapter나 façade로 호환성을 유지한다.
7. dead forwarding method와 사용되지 않는 abstraction은 소비자 migration 후 제거한다.
8. 각 단계에서 serialization, equality/hash, persistence, transaction, validation과 오류 계약을 확인한다.

대규모 hierarchy 재작성보다 한 변경 이유를 국소화하는 최소 이동을 선호한다. 요구가 아직 없는 extension point를 미리 만들지 않는다.

## 결과

리뷰에서는 타입의 역할, 소유한 불변식, 실제 변경 축, 현재 표현이 만드는 결합을 근거로 설명한다. “anemic”, “Demeter 위반”, “SRP 위반” 같은 라벨만 제시하지 않는다. 수정했다면 이동한 책임, 유지한 public/저장 계약, 추가한 테스트와 실행한 검사를 보고한다.
