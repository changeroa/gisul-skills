# 관점과 정체성

## 모델 헤더

각 모델에는 목적, 독자, 시간상 지위, 추상화 수준, 기준 revision·환경·시각, 요소 종류, 관계 의미,
생략 범위, 근거, 가정과 갱신 조건을 붙인다.
시간상 지위는 current/proposed로 구분하고, 개념/소프트웨어 설계/구현·배포의 추상화 수준을 별도로 적는다.
현재 개념 모델과 제안 개념 모델을 모두 표현할 수 있어야 한다. 논리·프로세스·배포 등의 관점도 별개의 축이다.
current logical model과 proposed deployment model을 연결할 때는 그 차이를 표시한다.

## 관점 선택표

| 결정 질문 | 필요한 관점 | 핵심 근거 | 금지할 추론 |
|---|---|---|---|
| 변경이 어디로 전파되는가 | 논리 | 책임·imports·공개 계약 | 폴더 근접성=결합 |
| 누가 어떤 순서로 효과를 만드는가 | 런타임 | 진입점·호출·상태 변화 | 화살표=실행 확인 |
| 동시 실행과 상태 소유권은 | 프로세스 | worker·thread·IPC·scope | 모듈=프로세스 |
| 어디에 무엇이 실행되는가 | 배포 | artifact·설정·환경 관찰 | 설정=live 상태 |
| 데이터 의미와 일관성은 | 데이터 | schema·변환·transaction | 객체=table |
| 반복 가능한 build·개발은 | 구현·개발 | build graph·명령·설정 | source=배포 산출물 |
| 누가 어느 경계를 통과할 수 있나 | 보안 투영 | 실제 guard·권한 결정 | 색상=보안 보장 |

같은 모델에서 여러 요소 종류를 쓸 수는 있지만 종류와 관계를 명시한다.
논리 모듈과 물리 DB를 하나의 계층처럼 표현하는 것은 의미 혼합이다.
별도 배포 관점에 DB를 놓고 logical persistence 책임과 mapping으로 잇는다.

## 정체성 ledger

| ID | 종류 | 책임·소유권 | 다른 관점 ID | mapping 의미 | 근거·지위 |
|---|---|---|---|---|---|
| 안정 ID | module/process/artifact 등 | 소유한 계약 | 대응 ID들 | realizes/executes/contains 등 | 위치·시각 |

- 이름이 같아도 개념, type, instance는 다른 정체성이다.
- 한 module→여러 artifact/process/instance 관계를 허용한다.
- 하나의 artifact가 여러 module을 포함할 수 있다.
- process와 node는 같지 않으며 execution environment는 node 안에서 중첩될 수 있다.
- component는 제공·요구 계약으로 교체하려는 단위이고 package는 조직·namespace 단위다.
- artifact는 실제 build·배포되는 파일 또는 묶음이며 component와 자동으로 일대일이 아니다.
- 요청·작업·사용자·tenant·세션·업무 entity 식별자를 따로 기록한다.
- 정체성 전환에는 변환 위치와 유효 범위를 남긴다.

## 관계 ledger

관계마다 종류, 방향, 양 끝의 정체성, 계약과 근거를 적는다.
source dependency는 client가 supplier의 정의에 의존한다는 뜻이다.
runtime call은 어느 instance가 어느 instance에 요청하는지 나타낸다.
data flow는 이동하는 값과 의미·소유권 변화를 나타낸다.
deployment mapping은 artifact와 실행 환경의 배치를 나타낸다.
관계를 하나로 합치면 없어진 의미가 없는지 확인한다.

## 공통 시나리오

선택한 시나리오에 actor, 시작 상태, 입력, 중요 분기와 기대 결과를 적는다.
각 단계에 논리 책임자, runtime participant, process, artifact/node,
data identity와 정책 결정 위치를 연결한다.
모든 세부사항을 노출하지 말고 현재 결정에 영향을 주는 경계만 확장한다.
성공 경로 외에 품질 요구를 드러내는 실패·복구 경로를 하나 이상 검토한다.
상태 모델은 반응이 상태에 따라 달라질 때, 활동 모델은 병렬·다자 흐름이 중요할 때 사용한다.
자세한 UML 문법보다 event·guard·effect·owner와 완료 조건을 먼저 결정한다.
