# 추가 협력 계약

## Proxy와 fallback

- 문제를 접근 지연, 접근 제어, cache, 장애 대행 중 무엇인지 한정한다.
- proxy와 real service가 공유할 계약을 쓰고 추가 보장과 차이를 드러낸다.
- 호출자는 proxy를 통해 요청하고 proxy는 정책에 따라 원본·cache·허용된 대안을 선택한다.
- memory cache와 crash 이후 살아남는 저장을 구분한다.
- read cache-first와 write remote-first/store-forward는 서로 다른 상태·내구성 계약이다.
- stale data 허용 범위, miss+remote failure, cache 무효화와 재연결 책임을 정한다.
- fallback을 정상 최신 결과나 확정 승인으로 조용히 가장하지 않는다.
- 원본 성공 후 응답 유실은 실패 확정이 아니다. ambiguous outcome으로 처리한다.
- replay·중복 제거·durable queue와 원자성은 별도 설계하고 실제 경계에서 검증한다.
- 검증: stale/miss, crash/restart, 응답 유실, 재접속과 중복 전달의 허용 결과를 확인한다.
- 직접 호출과 명시적 fallback 함수가 충분하면 투명 proxy를 추가하지 않는다.

## State

- 상태별 행위가 여러 연산에 반복 분산되는 문제를 먼저 확인한다.
- 상태·사건·guard·전이·effect·거절 결과를 상태표로 정의한다.
- context는 현재 상태와 불변식을 소유하고 state participant는 해당 상태의 행위를 담당한다.
- 전이 권한과 상태 교체 시점을 지정하고 새 state가 context 상태를 중복 소유하지 않게 한다.
- 단순 유한 상태이면 enum과 명확한 조건으로 충분할 수 있다.
- 상태 객체 계층은 허용된 전이 자체의 정확성을 증명하지 않는다.
- 검증: 모든 허용 전이, 금지 전이, 반복 사건과 실패 후 상태를 확인한다.
- 메모리 상태 전이와 DB transaction 상태는 동일하지 않다.

## Command

- 작업을 값처럼 보관·예약·queue·정렬할 현재 요구가 있는지 확인한다.
- request는 입력과 작업 정체성을, invoker는 실행 시점을, receiver는 실제 업무를 소유한다.
- 성공 결과, 실패 결과와 재실행 가능성을 명시한다.
- 순서가 중요하면 의존 관계로 정하고 이름이나 작업 타입 정렬에 의존하지 않는다.
- undo는 역연산이 실제 정의될 때만 제공한다. 빈 undo로 취소 가능성을 가장하지 않는다.
- 외부 송신·결제·파일 effect의 보상은 DB rollback과 다르다.
- 이미 commit된 결과, 중간 실패와 재실행에서 중복 effect가 가능한지 본다.
- 검증: 작업 순서, 실패 지점, 재시도, 부분 완료와 보상 실패를 확인한다.
- 단순 함수 호출을 감싸기만 하면 객체화·queue 체계를 추가하지 않는다.

## Template Method와 framework hook

- 여러 구현이 공유하는 알고리즘 순서와 변동 단계를 분리한다.
- base skeleton은 순서와 불변식을 소유하고 hook은 제한된 변형만 제공한다.
- framework가 hook을 호출한다는 제어 역전을 호출 흐름으로 보여준다.
- hook이 선행 단계를 생략하거나 불변식 밖의 상태를 변경할 수 없는지 확인한다.
- hook의 입력·오류·호출 횟수·재진입·정리 책임을 문서화한다.
- 상속보다 strategy·함수 주입·조합이 결합과 테스트 비용을 줄이는지 비교한다.
- 검증: 최소 구현 두 개가 동일 순서·오류·cleanup 계약을 만족하는지 확인한다.
- 기능 하나를 위해 일반 framework를 만들지 않는다.

## Abstract Factory와 제품군

- 함께 호환되어야 하는 둘 이상의 제품 역할과 잘못 섞였을 때의 실패를 적는다.
- factory는 제품군 일관성과 생성 구성을 소유하고 제품은 각 업무 계약을 소유한다.
- client가 concrete product를 다시 생성해 family 보장을 우회하지 않는지 확인한다.
- 검증: 호환 조합, 거절할 혼합 조합, 교체와 자원 수명을 확인한다.
- 단순 selector나 composition 함수가 같은 보장을 제공하면 그쪽을 택한다.

## Persistence에 적용할 때의 경계

- 먼저 사용 중인 ORM·DB 버전과 지원되는 extension point를 확인한다.
- 새로운 persistence framework 구축을 기본 권고로 삼지 않는다.
- mapper는 저장 표현 변환, identity map은 scope 안의 객체 정체성을 책임진다.
- lazy proxy는 materialization을 미루며 accessor에 I/O·latency가 숨을 수 있다.
- State·Command 조합만으로 완전한 transaction·locking·security를 얻었다고 주장하지 않는다.
- identity scope, connection/transaction 수명, 동시 갱신과 restart를 실제 도구로 시험한다.
- lazy loading은 query count, N+1, 종료된 transaction 접근과 serialization을 검사한다.
- commit/rollback 후 메모리 상태와 DB 상태가 무엇을 의미하는지 명시한다.
- 기술 superclass를 domain에 넣으면 기술 결합·단일상속 제약과 편의 이득을 비교한다.
- ID 형식, association table 구조와 query 방식을 패턴 이름에서 추론하지 않는다.
- 실패·동시성·query·collection·보안 범위를 검증하지 않았다면 미완료로 표시한다.
