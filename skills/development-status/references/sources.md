# 근거와 적용 한계

이 스킬의 목적은 개발자가 현황 설명을 반복하는 부담을 줄이면서, 팀이 진척과 필요한 결정을 이해하게 하는 것이다. 제품 전략 수립이나 개발자 성과 평가를 목적으로 하지 않는다.

아래는 공개된 원문·출판사 자료를 확인하여 선정한 근거다. 책 전체를 검토했다는 뜻이 아니며 장문의 원문을 복제하지 않는다. 책의 관점, 이 스킬의 해석, 운영 규칙을 구별한다.

## 중심 근거: Ryan Singer, Shape Up

- [Chapter 13: Show Progress — 공식 공개 본문](https://basecamp.com/shapeup/3.4-chapter-13)
- 관련 절: The tasks that aren't there, Estimates don't show uncertainty, Work is like a hill, Status without asking, Prompts to refactor the scopes.

**원문의 관점:** 개발 중 작업이 발견되므로 할 일의 완료 수만으로 진척을 판단하기 어렵다. 해결 방법을 찾는 단계와 실행 단계를 구별하고, 범위별 상태 변화를 볼 수 있게 한다. 상태가 다른 작업이 한 범위에 섞이면 분리할 필요가 있다.

**스킬 적용:** 기능별로 해결된 것, 남은 불확실성, 남은 실행, 이전 대비 변화를 정리한다. 커밋 수로 완료율을 계산하지 않는다.

**한계:** 원문의 Hill Chart는 맥락을 아는 팀원이 갱신한다. AI가 저장소만 읽어서 작업자의 확신이나 모든 미지의 문제를 알 수는 없다. 자동 좌표·진척률을 만들지 않는다. 이 스킬은 6주 주기나 Shape Up 전체 운영 방식의 도입을 요구하지 않는다.

## 보완 근거: Scott Berkun, Making Things Happen

- [O'Reilly의 개정판 소개](https://www.oreilly.com/library/view/making-things-happen/9780596517717/)
- [저자 공개 장: How to make things happen](https://scottberkun.com/essays/how-to-make-things-happen-from-the-art-of-project-management/)
- 공개 장은 이전 제목인 The Art of Project Management의 13장으로 게시되어 있다. 이를 개정판 전체 본문을 직접 확인한 것처럼 인용하지 않는다.
- 관련 절: Priorities make things happen, Keeping It Real, Know the Critical Path.

**원문의 관점:** 우선순위를 실제 소통과 판단에 반영하고, 목표·기능·작업을 연결한다. 불편한 사실을 회피하지 않고 진행을 좌우하는 의존성과 결정을 찾는다.

**스킬 적용:** 변경을 기능과 목표에 연결하고, 장애물의 영향과 필요한 행동을 공유한다. 기존 결정은 새 근거 없이 뒤집지 않는다.

**한계:** 코드만으로 사업 우선순위, 조직 권한, 담당자의 의도를 확정할 수 없다. 상태 보고가 새로운 정책·일정·업무 배정의 권한을 주지 않는다. 정식 일정 분석 없이 특정 작업을 프로젝트 전체의 임계 경로로 단정하지 않는다.

## 보조 관점: Andrew S. Grove, High Output Management

- [출판사 소개 및 공개 발췌](https://penguinrandomhousehighereducation.com/book/?isbn=9780679762881)

**확인 범위:** 출판사 소개는 지표와 팀 산출물의 관점을 설명하며 공개 발췌는 정보 교환과 회의를 다룬다. 이 자료로 책 전체의 세부 운영 절차를 확인했다고 주장하지 않는다.

**스킬 적용:** 공유 항목이 팀의 판단이나 다음 행동에 도움이 되는지 점검한다. 이것은 이번 사용 목적에 맞춘 해석이며 책의 공식 보고 양식이 아니다. 책을 근거로 불필요한 회의나 새 KPI를 요구하지 않는다.

## 이 스킬이 정한 운영 규칙

구현·검증·배포·이용 가능성의 구별, 근거 링크와 기준 시점, 충돌 처리, 전송 확인과 중복 방지는 AI가 개발 기록을 해석하는 상황에 맞춘 규칙이다. 저자들의 직접 주장이나 검증된 성과 수치로 표현하지 않는다.

관련 UX 스킬은 사용자 과업과 확인 근거를 연결하는 구성의 참고다. 책의 근거를 대신하지 않으며 해당 스킬을 읽었다는 이유만으로 실제 제품이 검증된 것은 아니다.
