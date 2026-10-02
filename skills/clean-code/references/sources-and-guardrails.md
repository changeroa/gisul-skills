# 출처, 장별 적용 범위와 가드레일

## 중심 출처

- Robert C. Martin, [*Clean Code: A Handbook of Agile Software Craftsmanship, 2nd Edition*](https://learning.oreilly.com/library/view/clean-code-a/9780135398586/), Addison-Wesley Professional, 2025년 10월.
- 2026-10-02에 정식 O’Reilly 접근 권한으로 Introduction, 1~37장, 부록 *The Clean Code Debate*의 본문을 읽고 이 스킬팩과 대조했다.
- O’Reilly 서지 화면에서 저자, 판본, 출판사, 발행 시점과 네 부분의 범위를 확인했다.

이 스킬팩은 책의 공식 스킬, 인증, 체크리스트가 아니다. 원문의 사례 코드나 장문을 복제하지 않고, 현재 저장소에 적용할 수 있는 독립적인 절차로 요약했다. 책의 설명과 이 팩이 추가한 운영 규칙을 구별한다.

## 장별 반영 지도

### 1~3장: 팩의 공통 작업 흐름

1. **Clean Code:** 코드는 쓰는 시간보다 읽는 시간이 길며, 현재 동작뿐 아니라 장기적인 변경성과 지속적 개선을 가치로 본다.
2. **Clean That Code!:** 처음부터 완벽한 코드를 기대하지 않고, 동작하게 만든 뒤 다시 읽고 테스트하며 정리하는 별도 pass를 둔다. 저자 자신의 회고는 과도한 분해도 불편을 만들 수 있음을 함께 보여 준다.
3. **First Principles:** 작고, 이름이 있으며, 조직되고, 순서가 있는 코드를 기본 방향으로 삼되 명시적으로 맥락적 지침이지 절대 법칙이 아님을 전제한다.

`clean-code`는 이 원칙을 범위 고정, 계약 구별, 기준선 검증, 작은 변경, 최종 diff review 절차로 구현한다.

### 4~6장: `clean-code-readability`

4. **Meaningful Names:** 의도, 정확한 구분, 검색과 발음, 범위, 품사, 문제·해법 도메인의 어휘와 맥락을 이름에 반영한다.
5. **Comments:** 코드가 표현할 수 있는 내용은 코드로 드러내되, 이유·제약·경고·공개 계약처럼 코드만으로 충분하지 않은 정보는 정확한 주석으로 남긴다. 거짓말, 중복, 잡음과 주석 처리된 코드는 제거 후보로 본다.
6. **Formatting:** 수직·수평 형식으로 개념의 구분과 근접성, scope와 읽기 순서를 드러내고 팀 합의를 자동화한다.

### 7~11장: `clean-code-functions`

7. **Clean Functions:** 작은 함수, 한 abstraction level, top-down 읽기, 명확한 이름, 낮은 결합과 관찰 가능한 순수성을 추구한다.
8. **Function Heuristics:** 인수, flag, output parameter, command/query, error, duplication과 side effect를 판단하는 휴리스틱을 제공한다.
9. **The Clean Method:** 동작하는 작은 단위를 만든 뒤 테스트 아래에서 이름, 중복, 순서와 경계를 점진적으로 정리한다.
10. **One Thing:** 더 높은 수준의 의미 있는 추출이 가능한지를 함수 응집도 판단에 사용하고, 구현 한 줄을 재진술하는 과도한 추출은 피한다.
11. **Be Polite:** 파일과 모듈을 독자가 high-level policy에서 필요한 세부사항으로 내려갈 수 있는 글처럼 구성한다.

### 12~13장: `clean-code-objects`

12. **Objects and Data Structures:** 표현을 숨기고 행위를 제공하는 객체와 데이터를 드러내는 구조의 tradeoff를 변화 축에 맞게 선택한다. Law of Demeter, DTO, switch와 polymorphism을 절대 규칙으로 쓰지 않는다.
13. **Clean Classes:** 클래스·모듈의 크기를 숫자 대신 변경 이유와 응집도로 판단하고, 독립적으로 변하는 정책을 실제 변화가 드러날 때 분리한다.

### 14~16장: `clean-code-tests`

14. **Testing Disciplines:** TDD, TCR, small bundles를 짧은 피드백과 구조 개선을 위한 대안적 규율로 다룬다. 테스트 가능성을 설계 기준으로 사용하고 테스트 코드도 깨끗하게 유지한다.
15. **Clean Tests:** 빠르고 격리되고 반복 가능하며 스스로 결과를 판정하고 적시에 작성되는 테스트, AAA, single-act와 test domain language를 적용한다.
16. **Acceptance Testing:** 이해관계자가 읽을 수 있는 feature 수준의 실행 가능한 요구사항과 continuous build를 다룬다.

### 17장: `clean-code-ai`

17. **AIs, LLMs, and God Knows What:** 모호한 prompt가 그럴듯하지만 틀린 코드와 테스트를 함께 만들 수 있음을 경고하고, 정의·예시·반례·실행 테스트를 겹쳐 명세하며 생성 결과를 독립 검증한다.

### 18~21장: `clean-code-design`

18. **Simple Design:** 테스트 가능한 동작, 의도 표현, 실제 의미 중복 제거, 불필요한 크기 축소의 우선순위와 YAGNI를 사용한다.
19. **The SOLID Principles:** SRP, OCP, LSP, ISP, DIP를 구체적인 actor, behavioral contract와 dependency change를 분석하는 도구로 쓴다.
20. **Component Principles:** release·change·reuse 단위의 응집도, acyclic dependency, stability와 abstraction의 균형을 프로젝트 단계에 맞게 조정한다.
21. **Continuous Design:** clarity, conciseness, confirmability, cohesion을 feature 작업마다 다시 평가한다.

### 22장: `clean-code-concurrency`

22. **Concurrency:** 실제 throughput·latency 또는 구조 요구가 있을 때 동시성을 사용하고, concurrency concern 분리, 공유 상태 최소화, 검증된 primitive, 작은 critical section, 명시적 종료와 반복 테스트를 적용한다.

### 23~27장: `clean-code-architecture`

23. **The Two Values of Software:** 동작 가치와 구조적 변경 가치를 함께 지키고 policy를 detail에서 분리해 결정을 늦춘다.
24. **Independence:** use case, operation, development, deployment의 네 독립성을 현재 비용과 요구에 맞게 확보한다.
25. **Architectural Boundaries:** business rule과 UI·DB 같은 detail 사이에 가치 있는 plug-in 경계를 두고 dependency direction을 policy 쪽으로 향하게 한다.
26. **Clean Boundaries:** 외부 framework와 vendor API를 application 중심의 작은 adapter로 격리하고 learning·boundary test로 의존 behavior를 확인한다.
27. **The Clean Architecture:** entity, use case, adapter, driver의 관심사와 inward dependency rule을 사용하되 layer 수와 diagram은 고정하지 않는다.

### 28~37장: `clean-code-craft`

28. **Harm:** 코드의 사회·기능·구조적 위험을 알고 위험에 비례해 검증하며, 긴급 patch는 안정화 뒤 정리한다.
29. **No Defect in Behavior or Structure:** 동작하게 만드는 것에서 끝나지 않고 구조 결함을 다음 기능 아래에 누적하지 않는다.
30. **Repeatable Proof:** release마다 빠르고 확실하며 누구나 다시 실행할 수 있는 동작 증거를 제공한다.
31. **Small Cycles:** 작은 commit·통합·배포 준비 주기와 항상 green인 build를 유지한다.
32. **Relentless Improvement:** code, test, design, 문서와 절차를 지속적으로 개선하고 coverage·mutation을 진단 도구로 쓴다.
33. **Maintain High Productivity:** 타이핑 속도가 아니라 build, test, debug, deploy, 회의와 방해를 포함한 전체 흐름을 개선한다.
34. **Work as a Team:** pairing·mobbing·overlap을 통해 지식을 분산하고 한 사람 의존을 줄인다.
35. **Estimate Honestly and Fairly:** 정확도와 정밀도를 구별하고 범위와 불확실성을 숨기지 않는다.
36. **Respect for Fellow Programmers:** 직무 관련 기술, 행동과 협업을 근거로 동료를 존중하고 평가한다.
37. **Never Stop Learning:** 언어, paradigm, 역사적 기초, 실습과 공동체 학습을 정기적인 개발 활동에 포함한다.

### 부록: 모든 스킬의 가드레일

부록은 Robert C. Martin과 John Ousterhout의 방법 길이, 주석, TDD 논쟁을 싣는다. 공통 목표는 다음 독자의 이해와 변경 비용을 낮추는 것이지만 수단의 최적점에는 중요한 이견이 있다. 이 스킬팩은 그 이견을 숨기지 않고 아래 가드레일로 반영한다.

## 절대 규칙으로 만들지 않을 것

### 함수와 메서드 길이

작은 함수는 이름, 국소 추론, 관심사 분리에 도움이 될 수 있다. 그러나 극단적 분해는 얕은 interface, 많은 왕복 탐색, 숨은 side effect와 entanglement를 만들 수 있다. 줄 수 제한을 두지 않고 분해 전후의 독해·변경·검증 비용을 비교한다. 책 2장의 저자 회고와 부록 모두 과도한 분해의 문제를 인정한다.

### 주석

본문은 많은 주석을 표현 실패와 maintenance liability로 경계하지만, 부록의 다른 관점은 rationale, assumption, algorithm, interface를 전달하는 주석의 대체 불가능한 역할을 강조한다. 따라서 주석을 모두 삭제하거나 모두 코드로 바꾸지 않는다. 코드로 정확히 표현되는 중복 설명은 줄이고, 코드가 말할 수 없는 이유와 제약은 검증 가능한 가까운 주석으로 남긴다.

### TDD

본문은 TDD를 강하게 지지하지만 14장은 TCR과 small bundles도 제시하고, 부록은 TDD가 지나치게 전술적인 설계를 유도할 수 있다는 논쟁과 경험 차이를 그대로 남긴다. 이 팩은 tests-first를 의무화하지 않는다. 어떤 순서를 쓰든 빠른 피드백, 충분한 regression evidence, 별도의 설계 사고와 지속적 refactoring을 요구한다. test가 통과한다는 사실만으로 구조가 좋다고 판정하지 않는다.

### SOLID, DRY와 architecture

원칙명, package metric, layer 수, class·interface 수는 결함 증거가 아니다. 실제 actor와 변화 축, behavioral contract, consumer, release와 deployment 비용에 연결한다. 단순 switch, concrete dependency, 약간의 중복, cohesive monolith가 현재 맥락에서 더 나을 수 있다. 미래를 추측한 extension point와 adapter를 만들지 않는다.

### 수치 기준

책의 파일 길이, line width, 함수 인수 수, build 시간, coverage와 commit 크기 예시는 방향을 보여 주는 휴리스틱이다. 모든 언어·제품·위험 수준의 인증값으로 사용하지 않는다. 저장소 관례, 실제 측정과 독자 비용을 우선한다.

### 직업적 실천

Part IV의 윤리, 조직, 근무 환경, 추정과 방법론에 관한 견해는 저자의 입장과 경험이다. 이를 개인에 대한 도덕적 비난, 인사 평가, 노동 조건 강요로 사용하지 않는다. 이 팩은 검증 가능한 위험 공유, 임시 부채 제거, 작은 통합 주기, 정직한 불확실성, 지식 분산과 학습 계획으로만 운영화한다.

### AI와 시간 민감성

17장은 prompt programming이 아직 성숙하지 않았다는 2025년의 관점을 담는다. 특정 모델의 현재 능력이나 미래 성과를 입증하는 연구로 사용하지 않는다. 명세 중복, generated code·test의 독립 검증, 인간 책임이라는 지속 가능한 안전 원칙만 적용한다.

## 이 스킬팩이 추가한 운영 규칙

다음은 책의 직접 명령이 아니라 coding agent가 저장소에서 안전하게 일하도록 이 팩이 정한 절차다.

- 리뷰, 리팩터링, 기능 구현, 설명 모드와 권한을 구별한다.
- revision과 작업 트리를 고정하고 사용자의 기존 변경을 보존한다.
- observable behavior를 반환값뿐 아니라 오류, effect 순서, 자원, 호환성과 동시성까지 확장해 확인한다.
- 실행한 검사와 제안만 한 검사를 명확히 구별한다.
- 생성·vendor·minified code와 public migration을 별도 위험으로 다룬다.
- 기능 변경, 기계적 이동, 포맷 변경을 가능한 한 작은 단위로 분리한다.
- final diff를 다시 읽고 범위 밖 변경, 약해진 테스트와 사용되지 않는 추상화를 확인한다.
- specialist 수, finding 수, coverage 수치를 품질 대리값으로 쓰지 않는다.

책의 특정 주장이나 문장을 정확히 대조해 달라는 요청에는 정식 원문을 다시 열어 해당 판본과 장을 확인한다. 장문의 원문, 사례 코드 또는 책을 대체할 정도의 재구성을 이 팩에 추가하지 않는다.
