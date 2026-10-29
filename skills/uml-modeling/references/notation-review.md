# 의미·버전·표기 리뷰

## 1. 모델 헤더

각 모델 또는 묶음에 다음 정보를 둔다.

- 해결할 질문과 독자.
- 탐색 스케치 / 전달 명세 / 실행 모델.
- 개념 / 설계 / 구현 관점.
- 현재 / 제안 / 혼합 여부.
- 기준 시점, 범위, 생략한 정보.
- 정식 UML의 대상 버전 또는 UML-inspired임을 나타내는 표시.
- 로컬 키워드·색·선의 범례.
- 사실·추론·미확인의 구분.

버전·의도 불명확한 입력은 그대로 해석을 확정하지 않는다. 필요한 의미만 질문하거나 명시적 가정으로 남긴다.

## 2. 표기 적합성은 설계 타당성과 다르다

1. 표기의 종류를 식별한다. 클래스, 인스턴스, part, component, artifact, node가 섞이지 않았는가?
2. 모든 선을 문장으로 읽는다. 연관, 일반화, 의존, realization, message, control flow, connector 중 무엇인가?
3. 방향과 끝의 symbol을 검사한다. diamond는 whole 쪽, 빈 삼각형은 일반적인 쪽, dependency는 supplier 쪽인가?
4. 다중성을 양끝에서 별도로 읽는다. qualifier당 제약과 전체 개수를 혼동하지 않는가?
5. 기울임, 밑줄, 점선, 실선, 열린/채운 화살촉이 의도적으로 사용되었는가?
6. source에서 생략한 정보가 renderer default로 새로 생기지 않았는가?
7. 타깃 도구가 지원하지 않는 요소가 조용히 일반 선으로 변환되지 않았는가?
8. UML-inspired 도구 문법 통과를 OMG 의미 검증으로 보고하지 않는다.

## 3. 구식·로컬 관례의 격리

다음은 오래된 자료·팀 관례에서 볼 수 있으므로 읽을 수 있어야 하지만 새 정식 모델로 자동 복사하지 않는다.

- sequence의 half-stick 비동기 화살표, message별 반복 표시, pseudomessage와 data tadpole.
- sequence lifeline head에 객체 instance처럼 밑줄을 긋는 관례.
- 짧은 interface/abstract 약자와 정의하지 않은 guillemet 키워드.
- frozen·temporal·global·local·parameter 같은 표기의 버전별 상태 또는 로컬 의미.
- class superclass를 lollipop으로 표현하거나 시퀀스 lifeline에 lollipop을 붙여 다형성을 나타내는 관례.
- 일반 class box의 ball/socket 직접 결합을 정식 assembly라고 부르는 관례.
- template binding을 일반화 실선처럼 그리는 구식 표기.
- communication의 flat message numbering.
- active classifier의 굵은 외곽선이나 구식 component 외부 돌출 아이콘.
- 패키지의 직교 분류 축을 실제 단일 namespace처럼 보이는 방식으로 그리는 관례.
- class diagram 위 message arrow와 패턴 역할 배지.

정식 표준 keyword, profile stereotype, 임의 label은 동일한 범주가 아니다. guillemet이 있다고 모두 stereotype이라 하지 않는다. 엄격한 profile 정의가 필요한 경우 metaclass 확장과 stereotype 적용 의미를 별도 확인한다.

## 4. 최신 의미로 자동 승격하면 안 되는 설명

- 특정 자료의 diagram type 개수는 그 버전·분류에 속한다. 지원 목록을 UML 전체의 불변 목록이라고 하지 않는다.
- interface는 단순히 'public operation만 가진 특수 클래스'로 제한하지 않는다.
- generalization set의 disjoint·covering default를 버전 확인 없이 추론하지 않는다.
- 연관 클래스의 끝값 조합이 반드시 유일하다고 자동 가정하지 않는다.
- final state를 객체 파괴라고 해석하지 않는다.
- state에서 출발하는 무trigger 전이의 completion 조건과 initial·choice·junction·history 등 pseudostate의 outgoing transition 의미를 구분한다.
- guard의 상호배타를 모든 상태기계의 문법상 필수 조건이라고 하지 않는다.
- activity final을 모든 incoming token을 기다리는 join처럼 해석하지 않는다.
- '여러 incoming edge는 implicit join'을 모든 node·pin·object flow에 무차별 적용하지 않는다.
- 합성을 불변 링크·DB cascade·언어 GC와 동일시하지 않는다.
- 'derived'를 저장되지 않는 필드라는 구현 사실로 확정하지 않는다.
- 시퀀스 세로 위치를 시스템 전체의 단일 전순서나 실제 duration으로 읽지 않는다.
- thread·active·parallel 표기를 실제 scheduler 정책이나 race-free 증거로 취급하지 않는다.

확인하지 못한 표준 세부 의미가 결과를 바꾸면 해당 구문을 단순화하거나 미검증으로 보고한다. 기억만으로 현행 규격 준수를 선언하지 않는다.

## 5. 교차 뷰 일관성

- 유스케이스의 actor 목표와 외부 성공 결과가 시퀀스의 종료 결과와 맞는가?
- 메시지 수신자의 책임·연산과 해당 클래스·interface가 일치하는가?
- 지속 연관이 없다는 이유로 매개변수·로컬 메시지를 불법이라고 하지 않았는가?
- 상태 guard와 시퀀스·활동의 분기 조건이 같은 정책인가?
- object example이 클래스의 다중성·소유·분류 제약을 만족하는가?
- component 계약, part/port 연결, artifact 배치가 서로 다른 추상화로 유지되는가?
- package dependency와 runtime request arrow를 혼동하지 않았는가?
- diagram omission과 실제 부재를 구별했는가?
- 현재 구현과 제안 모델 사이의 차이가 명시되어 있는가?

## 6. 실패모드와 최소 수정

- 모든 클래스를 그린 난독도: 질문에 불필요한 요소를 줄이고 설명용 뷰를 나눈다.
- 구조만 있고 책임을 설명하지 못함: 대표 시나리오를 실행해 메시지를 책임 owner에 배치한다.
- 도메인 전문가가 해석하지 못함: 구현 용어·표기를 줄이고 용어·사례를 먼저 검증한다.
- 단순 업무를 include/extend 계층으로 과분해: 사용자 목표 수준 본문으로 되돌린다.
- 분산 제어가 getter-chain과 순환을 늘림: 책임 이동의 실제 변경 비용을 비교한다.
- alternative를 join하여 deadlock: merge와 join을 token walkthrough로 구분한다.
- timeout 뒤 이미 성공한 작업을 취소: 실제 사건 순서와 부수효과를 확인하고 승자 결정 정책을 적는다.
- 멋진 그림을 실제 구현으로 오인: 근거·현재/제안·미검증 표시를 복구한다.
- 모델과 코드가 어긋남: 구현이 틀렸는지 모델이 낡았는지 요구 계약부터 확인한다.

## 7. 보고와 유지

결과에는 핵심 질문의 답, 선택한 뷰, 표기·버전 가정, 설계 tradeoff, 근거 범위, 미확인 사실을 남긴다. 리뷰 finding은 단순 'UML 위반' 대신 어떤 독자가 어떤 행동을 오해하며 어떤 계약이 깨지는지 설명한다.

검증 상태를 구분한다: 수동 의미 검토, 대상 도구 문법 검사, 코드 근거 대조, 실행 검증, 현행 규격 세부 확인. 실행하지 않은 검사를 통과했다고 하지 않는다. 모델 갱신 owner와 기준 revision을 남기고, 더 이상 질문에 답하지 않는 상세 뷰는 폐기한다.
