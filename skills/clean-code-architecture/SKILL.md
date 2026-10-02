---
name: "clean-code-architecture"
description: "Clean Code 2판의 two values, independence, architectural boundaries, clean boundaries, Clean Architecture 원칙으로 시스템 구조를 설계·리뷰한다. business policy와 framework·database·UI·vendor detail 분리, use-case independence, dependency rule, adapters, replaceability, testability, deferred decisions를 판단할 때 사용한다."
---

# Clean Code: Architecture

소프트웨어가 오늘 동작하는 가치와 내일 바꿀 수 있는 구조적 가치를 함께 지킨다. business 정책을 UI, database, framework, protocol, vendor SDK 같은 세부사항에서 분리해 중요한 선택을 늦추고 테스트와 교체 비용을 낮춘다.

module·component 수준 SOLID와 dependency graph는 `clean-code-design`, 동시 실행 모델은 `clean-code-concurrency`가 주 책임이다. 판본과 23~27장 적용 범위는 `skill://gisul/gisul/clean-code/references/sources-and-guardrails.md`를 따른다.

## 모드와 권한

리뷰 요청은 읽기 전용이다. 파일 수정은 사용자가 구현·리팩터링을 요청한 범위에서만 수행한다. 테스트·빌드 실행, commit·push·PR·배포와 외부 효과는 호스트와 저장소 정책 및 명시된 권한을 따른다. 사용자의 기존 변경을 덮어쓰거나 무관한 작업을 되돌리지 않는다.

## 1. 정책과 세부사항을 식별한다

- **정책:** 사용 사례, business rule, domain invariant, 시스템이 제공하는 핵심 가치
- **세부사항:** database, web framework, UI toolkit, message broker, filesystem, server, protocol, vendor API, deployment mechanism

이름이나 directory만 믿지 말고 실행 경로를 추적한다. controller에 핵심 정책이 있을 수 있고 `domain` package가 framework type에 묶여 있을 수 있다.

1. 주요 use case와 actor를 나열한다.
2. 각 use case의 입력, 정책 결정, 상태 변화, 외부 effect와 출력을 추적한다.
3. 정책 코드가 import하거나 직접 생성하는 세부 구현을 찾는다.
4. 외부 type, schema와 lifecycle이 안쪽 모델로 새는지 본다.
5. 테스트가 UI·DB·network 없이 핵심 정책을 실행할 수 있는지 확인한다.

## 2. 독립성을 네 관점에서 본다

### Use-case independence

architecture를 보면 시스템이 무엇을 하는지 드러나야 한다. 핵심 use case가 framework callback과 SQL 사이에 흩어져 있지 않게 한다. 서로 다른 use case가 같은 UI나 저장 구현을 공유한다는 이유로 정책까지 강하게 결합하지 않는다.

### Operational independence

실제 throughput, latency, availability 요구를 만족하되 정책이 특정 process·thread·service topology에 불필요하게 묶이지 않게 한다. monolith, module, process, service 중 현재 운영 비용에 맞는 형태를 쓰고 추측으로 microservice를 만들지 않는다.

### Development independence

팀이 맡은 component가 서로의 내부 구현을 계속 수정하지 않고 좁은 계약으로 협업할 수 있는지 본다. Conway's Law를 맹목적으로 따르기보다 소유권과 배포 현실에 맞춘다.

### Deployment independence

build artifact와 설정을 수작업으로 조립하지 않고 반복 가능하게 배포할 수 있는지 본다. 작은 내부 정책 변경이 불필요한 전체 redeploy를 강제하는지 확인한다.

네 종류를 모두 최대화할 수 없을 때 현재 위험과 비용을 명시하고 tradeoff를 선택한다.

## 3. 가치 있는 결정을 늦춘다

결정을 미룬다는 것은 방치가 아니라 option을 보존하며 정보를 얻는 것이다.

- database와 schema 선택이 아직 정책을 바꾸지 않는다면 repository port 뒤에서 늦출 수 있는가?
- delivery가 아직 REST인지 message인지 미정이라면 use-case input/output을 protocol type과 분리할 수 있는가?
- framework를 선택했어도 core rule이 annotation, base class와 global container에 의존하지 않게 할 수 있는가?
- 실험과 사용자 피드백 뒤에 결정하는 편이 더 나은 항목은 무엇인가?

모든 세부사항에 adapter를 미리 만드는 것은 option 보존이 아니다. 변경 가능성이 낮고 API가 작고 안정적이며 테스트 seam도 필요 없다면 직접 의존이 더 단순할 수 있다. 늦출 가치와 boundary 비용을 비교한다.

## 4. 경계의 위치와 방향을 정한다

경계는 다음 조건 중 하나 이상일 때 가치가 있다.

- 외부에서 통제하고 변경 주기가 다르다.
- business vocabulary와 외부 API vocabulary가 다르다.
- 교체·upgrade·test double이 현실적으로 필요하다.
- 실패, transaction, serialization 같은 별도 정책이 있다.
- 세부사항 변화가 여러 use case로 전파된다.

경계에서는 정책 쪽이 필요한 작은 interface와 data shape를 정의하고, 바깥 세부 구현이 이를 구현·변환하게 한다. object creation과 binding은 바깥 composition point에 모은다.

- business rule이 vendor SDK를 직접 호출하지 않는다.
- UI view model, ORM row, transport DTO를 core entity로 그대로 전달하지 않는다.
- 경계를 넘는 데이터는 use case에 필요한 단순한 구조로 변환한다.
- control flow가 바깥으로 향해도 source dependency는 안쪽 정책을 향하게 할 수 있다.
- adapter는 application use case의 언어를 사용하고 vendor API 전체를 복제하지 않는다.

## 5. Dependency Rule을 적용한다

source-code dependency는 더 높은 수준의 안정된 정책을 향하게 한다. 안쪽 코드는 바깥 layer의 이름, framework type, data format과 lifecycle을 몰라야 한다.

대표적인 책임은 다음처럼 나눌 수 있지만 layer 개수를 고정하지 않는다.

- domain/entity: 장기적으로 안정된 규칙과 invariant
- use case/application: application-specific orchestration
- interface adapter: controller, presenter, gateway와 data conversion
- framework/driver: DB, web, UI, device, vendor mechanism

작은 시스템에 네 package를 억지로 만들지 않는다. 두 모듈과 함수 경계만으로 dependency direction이 선명하면 충분하다. 반대로 하나의 monolith 안에서도 module boundary와 dependency rule은 적용할 수 있다.

## 6. 외부 경계를 깨끗하게 유지한다

- 외부 library를 직접 쓰는 위치를 소수로 제한한다.
- application이 필요한 좁은 interface를 정의한다. library의 수십 method를 그대로 wrapper에 복사하지 않는다.
- upgrade 전에 learning test로 실제 API behavior를 탐색하고, boundary test로 우리가 의존한 behavior를 고정한다.
- third-party exception, status와 data type을 경계에서 application 의미로 변환한다.
- retry, timeout, idempotency와 circuit 정책이 여러 adapter에 흩어지지 않게 한다.
- framework annotation과 callback이 core object 생성·lifecycle을 지배하는 범위를 최소화한다.

thin wrapper가 아무 의미 없이 이름만 바꾸면 제거한다. boundary는 변화 흡수, test seam, vocabulary 변환 중 실제 가치를 제공해야 한다.

## 7. architecture를 점진적으로 바꾼다

1. 가장 가치 있는 use case 하나를 선택한다.
2. 현재 정책과 세부사항이 만나는 지점과 그 때문에 어려운 변경·테스트를 적는다.
3. 보호할 contract를 테스트로 고정한다.
4. 정책이 필요로 하는 작은 port와 경계 data를 정의한다.
5. 기존 세부 구현을 adapter로 이동하고 기존 진입점에서 위임한다.
6. composition root에서 연결해 behavior를 유지한다.
7. 한 use case가 독립적으로 실행·테스트되는지 확인한다.
8. 효과가 입증된 뒤 다음 경로로 확장한다.

전체 시스템을 한 번에 Clean Architecture diagram으로 재작성하지 않는다. adapter를 추가한 뒤 수정 지점과 테스트 setup이 실제로 줄었는지 확인한다.

## 8. 검증 질문

- 핵심 정책을 UI, DB, network 없이 실행할 수 있는가?
- database나 framework upgrade가 business rule 파일을 바꾸는가?
- 바깥 data format이 안쪽 public type으로 새는가?
- 한 use case 변경이 무관한 use case의 배포와 테스트를 강제하는가?
- 실제 운영 요구 없이 process/service 경계를 만든 것은 아닌가?
- 경계를 우회해 table, SDK, global container를 직접 쓰는 경로가 있는가?
- dependency graph가 의도한 안쪽 방향을 따르는가?
- 새 layer가 정책을 보호하는가, 단순 전달만 하는가?

## 결과

architecture 리뷰에는 대상 use case, 정책과 세부사항의 구분, 현재 dependency path, 변경·테스트·배포에 주는 실제 비용, 가장 작은 boundary 대안을 적는다. 수정했다면 이동한 정책, 새 port/adapter, 유지한 외부 contract, 실행한 단위·integration·build 검사를 보고한다. diagram의 모양이나 layer 수만으로 결함을 선언하지 않는다.
