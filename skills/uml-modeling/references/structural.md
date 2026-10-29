# 구조 모델의 의미와 표기

## 클래스와 property

클래스는 분류자이며 객체의 종류와 구조적 제약을 표현한다. 개념 모델의 클래스는 곧바로 구현 클래스나 DB table이 아니다. 소프트웨어 모델도 언어 매핑 규약 없이는 정확한 코드를 유일하게 결정하지 않는다.

- 기본 구획은 이름, 속성, 연산이다. 필요한 구획과 요소만 표시한다.
- 속성 형태: `visibility name: Type [multiplicity] = default {modifiers}`.
- 연산 형태: `visibility name(parameters): ReturnType {modifiers}`.
- 매개변수 형태: `in|out|inout name: Type = default`. 생략값의 해석은 모델 규약을 확인한다.
- `+`, `-`, `#`, `~`는 public, private, protected, package 표기다. 실제 접근 허용은 구현 언어와 모델 의미를 대조한다.
- static feature는 밑줄, abstract classifier·operation은 기울임 또는 명시적 abstract 표시로 구분한다.
- 인스턴스 이름의 밑줄과 static feature의 밑줄은 위치와 대상이 다르다.
- `/property`는 derived property다. 계산·저장·캐시 구현을 자동 확정하지 말고 유도식과 일관성 조건을 적는다.
- `{readOnly}`와 객체 전체의 불변성은 동일하지 않다. 관찰 가능한 갱신 권한, 생성 후 변경, 내부 캐시, 별칭을 따로 확인한다.
- query는 관찰 가능한 상태를 바꾸지 않는 연산으로 취급한다. 반환값이 있다는 사실만으로 query라 하지 않는다.
- operation은 호출 가능한 계약이고 method는 그 구현이다. override마다 별도 operation이 생긴다고 단정하지 않는다.

## 연관과 다중성

연관 끝의 property 이름·타입·다중성을 문장으로 읽는다. `A → B`에서 A의 한 인스턴스가 가질 수 있는 B 수는 B 쪽 숫자다. 반대 끝은 다른 질문이다.

- `1`: 정확히 하나, `0..1`: 없거나 하나, `*`: 0개 이상, `m..n`: 하한·상한.
- 숫자가 없는 것은 모름·생략일 수 있다. 메타모델 default를 도면에 무조건 적용하지 않는다.
- multivalued property의 순서와 중복은 별도 차원이다. `{ordered}`, `{unordered}`, `{unique}`, `{nonunique}`로 필요한 제약을 드러낸다.
- 순서가 없는 계약을 List로 구현할 수는 있어도 그 우연한 순서를 사용자 계약으로 승격하지 않는다.
- 속성 구획과 연관선은 property의 서로 다른 표현이 될 수 있다. 다이어그램의 강조점에 따라 고른다.
- 연관은 지속적으로 제공 가능한 연결이다. 일회성 parameter·local use와 구별한다.
- navigability 화살표, 관계 이름의 읽기 방향을 표시하는 작은 삼각형, dependency 화살표는 서로 다르다.
- 화살표 없는 연관의 의미는 표기 관례를 확인한다. 항상 양방향이라는 추론을 금한다.
- 양방향은 `x.owner.items`에 x가 포함되는 등의 역관계 불변식이다. 소프트웨어 설계에서 양끝을 독립 저장·갱신한다면 일관성 유지 책임과 갱신 경계를 정한다. 단일 갱신 API는 가능한 구현 전략이지 UML의 필수 조건은 아니다.
- 컬렉션 공개 시 회원 추가·삭제 권한, 항목 자체 변경 권한, view/snapshot 여부를 따로 정의한다.

## 소유와 관계 객체

- 빈 diamond인 shared aggregation의 의미는 도메인·팀 규약에 좌우된다. 의미를 설명할 수 없으면 보통 연관을 쓴다.
- 채운 diamond인 composition은 whole 쪽에 둔다. 동시에 복수의 composite owner를 갖지 않는 배타적 소유를 뜻한다.
- whole 인스턴스를 삭제하면 그때까지 부착된 object part도 삭제된다. 허용된 분리·이동을 삭제 전에 수행한 part는 생존할 수 있다. 업무 상태 종료나 DB 물리 행 삭제와의 대응, 분리 가능성과 owner 다중성은 별도로 정한다. composition을 단순 foreign key나 깊은 복사 규칙으로 환원하지 않는다.
- 참조 객체는 정체성, 값 객체는 표현하는 값의 동등성이 중요하다. 값 공유 시 변경으로 다른 소비자에게 뜻밖의 효과가 생기는지 확인한다.
- UML DataType과 특정 언어의 struct·record, 도메인의 value object는 자동 동의어가 아니다.
- qualifier는 원본 객체와 key를 함께 주었을 때의 관계를 제한한다. 대상 끝 `0..1`은 key당 최대 하나지 원본 객체당 전체 최대 하나가 아니다.
- 연관 클래스는 관계에 feature를 붙인다. 점선으로 association과 class box를 연결한다.
- 같은 끝값 조합의 관계 인스턴스를 여러 개 허용하는지는 도메인 규칙과 대상 UML 버전을 확인한다. 유일성은 명시 제약과 테스트로 보장한다.
- 관계에 기간·역할·반복 발생이 있으면 독립 클래스로 승격하는 편이 명료할 수 있다. 양쪽 원소별 다중성을 다시 계산한다.
- 시간 관계는 현재 시점과 전체 이력을 구별한다. 유효기간, 겹침 허용, 종료 경계, 조회 기준 시점을 명시한다.
- 로컬 temporal 키워드를 쓰면 의미를 정의한다. 그것만으로 시간 의미가 표준화되지는 않는다.

## 일반화·인터페이스·템플릿

- 일반화는 실선과 빈 삼각형이며 삼각형은 일반적인 쪽을 향한다.
- 모든 subtype 인스턴스가 supertype 제약을 만족하고 caller 기대를 보존하는지 확인한다.
- subtype에서 사전조건 강화나 보장 약화가 생기면 대체 가능성을 의심한다. 계약 상속은 실제 언어·프레임워크 의미도 확인한다.
- 인스턴스 분류는 일반화가 아니다. 일상어의 '이다'만으로 상속을 만들지 않는다.
- multiple classification과 multiple inheritance를 구별한다. dynamic classification은 객체가 역할·분류를 바꾸는 것으로 단순 상태 필드나 언어 상속과 다르다.
- generalization set에 disjoint/overlapping, complete/incomplete를 필요한 만큼 명시한다. 버전 불명확한 default에 기대지 않는다.
- interface는 제공되는 계약이다. 구현이 없고 연산만 있는 구식 언어 인터페이스 정의를 모든 UML 버전의 정의로 일반화하지 않는다.
- realization은 점선과 빈 삼각형으로 구현에서 계약을 향한다. 요구 관계는 consumer의 의존이다.
- lollipop은 provided interface, socket은 required interface를 나타낸다.
- 단순 class box에 ball/socket을 맞댄 그림을 정식 assembly connector라고 단정하지 않는다. 정식 연결은 적절한 structured classifier의 part·port 문맥과 버전을 확인한다.
- 인터페이스에는 사용하는 최소 계약을 나타낸다. 구현 교체 필요가 없는 곳에 새 추상화를 강요하지 않는다.
- 템플릿 매개변수는 점선 매개변수 구획으로, 바인딩은 formal→actual 대응으로 표현한다.
- binding은 상속과 다르다. 구식 실선 일반화에 bind를 붙이는 표기를 새 모델의 정식 표기로 복사하지 않는다.
- enumeration은 `«enumeration»`과 literal 목록으로 나타낸다. 언어 enum 기능 전체를 UML literal에 투사하지 않는다.
- active class의 이중 세로 경계는 자체 제어 실행을 나타낸다. 정확한 OS thread 수나 호출 실행 위치는 별도 계약이다.

## 객체 다이어그램

한 시점의 연결 예를 보여준다. 밑줄 친 `instanceName:Classifier`와 slot 값, link를 표시한다. 이름 또는 타입을 생략할 수 있으나 타입만 쓰면 colon으로 구분한다. 이는 부분적인 instance specification일 수 있으므로 빠진 필드를 null로 해석하지 않는다.

클래스의 재귀 연결, 여러 역할, 소유 구조가 어렵다면 최소 정상 예와 경계 예를 만든다. 한 예가 가능하다는 것은 모든 연결이 유효하다는 증명이 아니다.

## 패키지 다이어그램

- tabbed folder는 package, `A::B::Type`은 한정 이름이다. 중첩은 namespace 소유를 표현한다.
- dependency는 점선 열린 화살표로 client→supplier다. supplier 정의 변경이 client에 영향을 줄 수 있다는 뜻이다.
- 전체 구성원 간 dependency를 집계한 것인지 선택된 설명용 관계인지 적는다.
- dependency는 일반적으로 추이 관계가 아니다. 중간 경계가 인터페이스를 유지하면 변경 파급이 멈출 수 있다.
- 정적 의존, 런타임 호출, 데이터 이동을 같은 선으로 뭉개지 않는다.
- 함께 변경되는 것, 함께 재사용되는 것, 공개 계약의 안정성으로 그룹을 평가한다.
- 계층과 업무 영역처럼 직교 축을 겹쳐 보이면 실제 namespace가 아닌 분석 뷰임을 표시한다.
- 사용자가 소유한 요구 interface를 외부 구현이 충족하는 방향도 가능하다. 호출 방향과 코드 의존 방향은 달라질 수 있다.
- import·merge는 단순 '사용'과 다른 의미가 있으므로 필요할 때만 대상 버전을 확인해 쓴다.

## 복합구조·컴포넌트·배치

복합구조는 classifier 내부의 part 역할과 connector를 표현한다. `roleName:Type [multiplicity]`는 실제 객체 snapshot이 아니므로 instance specification처럼 밑줄 치지 않는다. port는 경계의 작은 사각형이며 외부와의 논리적 상호작용 지점이다.

- assembly는 내부 part들의 요구·제공 계약을 연결한다.
- delegation은 외부 port의 상호작용을 내부 part·port로 전달한다. dependency 점선 화살표와 구별하고 connector 실선을 사용한다.
- port별 다중성, 요구·제공 방향, 연결의 타입 호환을 확인한다. 배선이 있다고 실제 실행 메시지를 모두 보장하지는 않는다.
- component는 `«component»` 또는 component 아이콘으로 표시한다. 독립 교체·배포·계약의 단위인지 설계 의도를 적는다.
- component는 물리 파일과 같지 않다. 세분화의 이점과 버전 조합·운영 비용을 함께 평가한다.
- deployment node는 device 또는 execution environment다. 환경이 장치 안에 중첩될 수 있다.
- artifact는 배치되는 파일 등 물리적 산출물이다. node로의 deployment와, artifact가 component 등을 구체화하는 Manifestation(`«manifest»`, artifact→model element)을 구분한다. Manifestation을 interface realization과 혼동하지 않는다.
- node 사이 communication path에는 필요한 프로토콜·경계를 표시한다. 단순 연결만으로 인증·가용성·전달 보장을 주장하지 않는다.
- 타입 수준 topology와 실제 배치 인스턴스를 구분한다. 복제 수, 위치, 환경, 버전은 확인한 사실만 기록한다.
