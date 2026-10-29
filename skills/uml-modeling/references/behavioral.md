# 행동 모델의 의미와 표기

## 유스케이스

유스케이스는 공통 actor 목표로 묶인 시나리오다. 성공 경로만을 뜻하지 않는다. actor는 시스템 외부 역할이며 사람·외부 시스템 모두 가능하다.

1. 경계와 주 actor의 목표를 선언한다.
2. main success scenario를 actor↔system의 의도 단위로 쓴다.
3. 각 단계의 대안 조건·실패 조건을 열거한다.
4. extension의 발견 단계, 조건, 대응 단계, 복귀 또는 종료를 쓴다.
5. 사전조건, 성공 보장, 최소 보장, trigger가 오해를 줄일 때만 추가한다.
6. 유스케이스 수준이 사용자 목표인지, 업무 전체인지, 포함된 하위 흐름인지 표시한다. 소요시간으로 수준을 고정하지 않는다.
7. 기능 전달 계획의 단위와 요구사항 이해의 단위가 달라도 허용한다.

유스케이스 다이어그램은 actor, 타원, system boundary, 관계의 목차다. `«include»`는 포함하는 유스케이스에서 포함되는 쪽으로 향한다. `«extend»`는 확장하는 쪽에서 기본 유스케이스로 향하며 조건·확장 지점의 의미를 확인한다. extension 본문과 extend 관계는 같은 것이 아니다. 일반화와 include를 함수 호출 분해처럼 남발하지 않는다. 본문 양식은 UML 표준이 유일하게 정해 주는 것이 아니다.

## 시퀀스 다이어그램

대상은 보통 한 상호작용·시나리오다. 참여자 head와 세로 lifeline, 메시지, execution specification을 쓴다. `name:Type`의 이름과 타입은 각각 생략할 수 있다. UML 2 lifeline을 객체 다이어그램의 instance specification처럼 자동 밑줄 처리하지 않는다.

- 동기 호출은 채운 화살촉, 비동기는 열린 화살촉으로 구별한다. return은 점선 응답으로 구별한다.
- 구식 half-stick이나 도구별 화살표는 범례 없이 정식 표기로 제시하지 않는다.
- 실행 막대는 실행 구간·중첩 호출을 돕는다. 생략 가능하며 thread 점유·벽시계 시간과 같지 않다.
- self call과 재진입 callback은 중첩을 보존한다. return 이름을 이후 참여자와 연결하면 같은 값·대상임을 분명히 한다.
- 생성은 대상 lifeline이 시작하는 head에 도달하게 그린다. 소멸은 X로 표시한다.
- X는 파괴 사건이다. 단순 close나 GC 후보를 동일시하려면 로컬 의미를 명시하고 정식 파괴와 구별한다.
- found/lost message는 끝의 출처·수신처를 모르는 경우다. 단순 도면 밖 생략과 혼동하지 않는다.
- 위아래 배치는 사건의 순서 제약을 표현한다. 모든 lifeline 전체에 절대적 전순서나 실제 지연을 부여하지 않는다.
- 비동기는 기다리지 않는다는 뜻이지 delivery 성공, 병렬 실행, exactly-once 보장이 아니다.

### Combined fragment와 참조

프레임 왼쪽 위 operator와 operand별 guard를 표시한다.

- `alt`: 조건별 대안. guard가 겹치거나 모두 거짓일 때 의미를 확인한다. 명확한 의도라면 상호배타 조건과 else를 사용한다.
- `opt`: 선택 실행되는 한 operand.
- `loop`: 반복 구간. 횟수·범위·조건과 검사 시점을 의도에 맞게 명시한다.
- `par`: operand 사이의 가능한 interleaving. 각 operand 내부 순서는 보존한다.
- `critical`: 간섭을 제한하는 critical region. 시스템 전체 mutex나 실제 lock 구현으로 단정하지 않는다.
- `neg`: 유효하지 않은 상호작용 예. 전체 허용 행위의 완전한 정의는 아니다.
- `ref`: 별도 interaction 사용. 이름, 참여 lifeline, 필요한 인수·반환 연결을 확인한다.
- `sd`: interaction 전체 경계와 이름을 붙일 때 사용한다.

구식 message별 `*`, 단일 guard, pseudomessage, data tadpole은 버전·관례를 표시한다. 현행 정식 sequence 문법과 혼합하지 않는다. 알고리즘 상세가 주제가 되면 활동도·결정표·코드로 옮긴다.

## 통신 다이어그램

참여자와 link의 공간적 연결이 중심이고 메시지 순서는 번호로 표현한다. UML 1의 collaboration diagram이라는 이름과 collaboration 요소 자체를 구별한다.

- 중첩 호출은 `1`, `1.1`, `1.2`, `1.2.1`처럼 표현해 호출 소유를 드러낸다.
- flat numbering은 이해를 도울 수 있으나 중첩 의미가 사라지므로 스케치 관례로 표시한다.
- 스레드 식별자를 쓰면 번호만으로 병렬성이 자명하다고 보지 말고 범례를 둔다.
- iteration·guard를 쓸 때 적용 메시지와 반복 범위를 분명히 한다.
- local·parameter·global 같은 구식 link 표시는 지속 association과 구별하고 현행 표준 키워드로 단정하지 않는다.
- 복잡한 호출 순서가 핵심이면 시퀀스로 전환한다. 둘을 모두 만들 의무는 없다.

## 상태기계 다이어그램

한 대상의 여러 사건에 대한 수명 행동을 보여준다. 둥근 상태, 초기 pseudostate, 전이, final state를 사용한다. transition의 기본 형태는 `trigger [guard] / effect`다.

1. 외부에서 관찰하는 사건과 대상이 수행하는 효과를 분리한다.
2. 상태별 허용 사건·guard·결과·부수효과를 전이표로 쓴다.
3. guard 미충족과 미처리 사건의 정책을 정한다. 항상 무시해도 된다고 가정하지 않는다.
4. 둘 이상 enabled일 때 의도치 않은 비결정성이 없는지 검사한다. guard 상호배타는 명료성 규칙이지 모든 UML 모델의 적법성 조건은 아니다.
5. state에서 출발하는 trigger 없는 전이는 completion 의미와 완료 조건을 확인한다. initial·choice·junction·history 등 pseudostate의 outgoing transition은 해당 pseudostate의 의미로 읽는다.
6. `entry`, `exit`, `do`와 internal transition을 구분한다.
7. internal transition은 해당 상태를 나갔다 들어오지 않으며 외부 self transition은 exit·entry를 일으킬 수 있다. local transition 등 복합상태 세부 의미는 별도 확인한다.
8. do behavior는 진행 중 중단 가능성을 가진다. effect를 실제 0시간 연산으로 단정하지 않는다.
9. 공유 전이를 composite state에 올릴 때 모든 substate에 적용되는지 확인한다.
10. orthogonal region은 여러 활성 상태 축이다. OS thread를 자동 생성한다는 뜻은 아니다.
11. history pseudostate는 이전 활성 구성을 복원한다. shallow/deep, 첫 진입 default, 재진입 범위를 확인한다.
12. final state는 해당 region의 완료를 나타낸다. 객체 삭제나 모든 외부 자원의 해제를 자동 의미하지 않는다.

구현은 명시적 transition table, State 패턴, 단순 분기 중 현재 복잡도와 언어에 맞게 고른다. 어느 한 방식도 의무가 아니다. 생성·재진입·취소·실패 경로를 포함해 모델과 코드를 대조한다. 모든 클래스에 상태도를 만들지 않는다.

## 활동 다이어그램

활동은 action들과 edge의 흐름이다. 상태기계의 상태 전이로 환원하지 않고 token 흐름으로 읽는다.

- initial node: 흐름 시작.
- action: 수행 단위. call behavior의 rake 표시와 operation 호출을 구별한다.
- decision: 조건에 따른 대안 선택. guard를 명시하고, 모두 거짓인 경우가 요구상 가능한지 확인한다. 그 경우를 별도 경로로 처리해야 하면 else를 사용한다.
- merge: 대안 흐름의 합류. 동기화가 아니다.
- fork: 병행 흐름으로 분기.
- join: 필요한 입력을 동기화. 기본 all-input 의미와 명시 joinSpec을 구별한다.
- activity final: 도달하면 전체 activity 실행을 끝낸다. 다중 입력에 implicit join이 있다고 가정하지 않는다.
- flow final: 해당 token·흐름만 끝낸다. 다른 흐름은 계속될 수 있다.

### Token walkthrough

1. 초기 token과 각 입력 object token을 놓는다.
2. decision에서는 선택 가능한 guard와 모두 거짓인 경우의 의미를 검사한다. guard가 필요한 경우를 이미 포괄한다면 else 부재 자체를 결함으로 판정하지 않는다.
3. fork 뒤 가능한 interleaving을 적는다. 순서를 정하지 않았다는 것과 실제 동시 실행을 구별한다.
4. join에 필요한 token이 모두 올 수 있는지 확인한다. 대안 경로 두 개를 동시에 기다리는 deadlock을 찾는다.
5. action의 다중 incoming edge·pin 의미를 확인한다. 암묵적 규칙에 기대지 말고 merge·join을 드러낸다.
6. flow final·activity final 도달로 남은 작업이 어떻게 되는지 추적한다.
7. 중단과 timeout 경합에서 이미 발생한 외부 부수효과가 되돌아가는지 별도 확인한다.

### 책임·이벤트·데이터

partition은 책임 주체나 분류 축이다. swimlane은 한 형태이며 thread나 배치 호스트를 뜻하지 않는다. 다차원 분류는 필요할 때만 쓴다.

- send signal과 accept event는 서로 다른 동작이다. incoming flow가 있는 accept는 언제부터 대기하는지 확인한다.
- time event에는 절대 시각·상대 지연과 단위를 적는다.
- 연결선 우회용 connector를 쓰면 짝 이름을 일치시킨다.
- object node와 pin은 데이터·자원을 나타낸다. pin의 타입·다중성·buffering을 모두 단순 control flow와 같다고 하지 않는다.
- transformation은 출력에서 입력으로의 값 변환이다. 부수효과 없는 표현을 사용하고 타입을 맞춘다.
- expansion region은 컬렉션 원소별 처리다. parallel/iterative/stream 등 사용 mode를 명시하고 묵시적 동시성에 기대지 않는다.
- 필터링으로 출력 원소 수가 줄어들 수 있다. 거절된 원소의 token 종료와 전체 완료 조건을 확인한다.
- joinSpec은 입력 label과 논리식을 연결한다. 누적 데이터·가격 비교 같은 정책을 넣으면 그 값의 owner와 원자성은 별도 검증한다.

활동도는 병행 가능한 순서를 표현하지만 shared data의 경쟁·transaction 정확성을 그 자체로 보증하지 않는다.

## 상호작용 개요

activity-style 제어 흐름의 노드로 interaction 또는 interaction use를 배치한다. 대안 interaction 뒤 merge, 병행 interaction 뒤 join을 구별하고 ref의 입출력·참여자를 확인한다. 내부 시퀀스를 지나치게 축소해 읽을 수 없으면 별도 시퀀스로 참조한다. 혼합 표현보다 단일 활동도나 시퀀스가 더 명확하면 그것을 쓴다.

## 타이밍

가로 시간축에 대상별 상태·값 변화를 표현한다. 적은 상태는 높이가 바뀌는 state-line 방식, 상태가 많은 경우 label·area 방식이 유용할 수 있다.

- 제약의 시작 사건과 끝 사건을 선명하게 연결한다.
- duration과 절대 time constraint를 구별한다.
- `>`, `>=`, `<`, `<=`를 자연어 요구와 일치시킨다.
- 단위, clock 기준, 허용 오차를 필요에 따라 적는다. 선의 길이만으로 실제 값을 추론하지 않는다.
- 정상 trace와 경계 trace를 비교한다. 상태 전이도만으로 시간 보장이 검증되었다고 하지 않는다.

## Collaboration

collaboration은 여러 참여 역할이 협력하는 구조·행동의 묶음이다. 별도의 만능 diagram type으로 부르지 않는다. 역할은 구현 클래스와 일대일일 필요가 없다.

- dashed ellipse와 역할 구조를 쓰고 필요하면 interaction을 함께 둔다.
- 참여자 표기는 `participant/role:Type`처럼 역할과 실제 타입을 구별한다.
- collaboration use의 역할 바인딩을 실제 classifier·property와 대조한다.
- 한 클래스가 여러 역할을 맡는 경우를 허용하고 역할별 계약을 확인한다.
- 패턴 이름·역할을 붙이는 로컬 주석은 유용하지만 정식 UML 요소라고 단정하지 않는다.
- 역할 재사용을 설명할 필요가 없으면 일반 구조·시퀀스와 간단한 설명으로 충분하다.
