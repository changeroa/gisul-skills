# 근거와 적용 범위

2026-09-21에 아래 다섯 문서의 본문을 확인했다. 링크된 모든 하위 문서까지 읽었다는 의미는 아니다. 아래는 요약과 적용 범위이며 원문을 대체하지 않는다.

## IBM Carbon — Empty states

https://carbondesignsystem.com/patterns/empty-states-pattern/

빈 화면의 이유와 맥락에 맞는 다음 행동을 설계한다. 빈 표는 헤더와 푸터까지 대체하는 패턴을 제시한다. 실제 기능이 있는 검색·필터까지 항상 제거하라는 규칙으로 확대하지 않는다. Carbon은 설정 필요 상태를 오류 관리 유형에도 포함하므로 “설정 미완료는 문헌상 절대로 오류가 아니다”라고 주장하지 않는다. 중요한 것은 원인에 맞는 설명과 해결 경로다.

## GOV.UK Design System — Error message

https://design-system.service.gov.uk/components/error-message/

입력 검증 오류 컴포넌트의 지침이다. 사용자 답변을 보존하고 수정할 입력과 메시지를 연결한다. 자격·권한·서비스 문제를 입력 실수처럼 표시하지 않는다. 이 지침을 모든 장애 안내 금지나 오류 숨기기로 해석하지 않는다. 영어 표현에 대한 세부 규칙을 한국어 문구에 기계적으로 적용하지 않는다.

## Jakob Nielsen / NN/g — 10 Usability Heuristics

https://www.nngroup.com/articles/ten-usability-heuristics/

상태 전달, 사용자 언어, 통제와 복구, 일관성, 오류 예방, 기억 부담 감소, 숙련도별 효율, 불필요한 정보 축소, 오류 이해와 회복, 과업 중심 도움말을 검토 관점으로 사용한다. 모든 화면에 열 가지 기능을 추가하라는 구현 명세가 아니다.

## NN/g — Cognitive Walkthroughs

https://www.nngroup.com/articles/cognitive-walkthroughs/

낯선 사용자가 구체적인 과업을 진행하는 관점으로 행동의 필요성·발견·결과 예상·피드백을 단계별 검토한다. 전문가 검토이며 실제 사용자의 행동 증거와 동일하지 않다. 익숙한 단순 조작에 무거운 절차를 의무화하지 않는다.

## GOV.UK Service Manual — Using moderated usability testing

https://www.gov.uk/service-manual/user-research/using-moderated-usability-testing

실제 또는 예상 사용자가 현실적인 과업을 수행하는 모습을 관찰한다. 과업에 답을 암시하거나 진행자가 경로를 가르치지 않는다. 보조기술과 이용 환경을 고려한다. 에이전트의 브라우저 검증은 이 방식의 실제 사용자 조사에 해당하지 않는다.

## 이 스킬에서 도출한 엔지니어링 적용

상태별 요청 계약, 불필요한 호출 부재 검증, 저장된 준비 상태와 초안 구별, 캐시 및 응답 경합 검토, 대상별 조건 판단은 위 문헌의 직접 명령이 아니다. 실제 제품에서 화면과 동작의 불일치를 예방하기 위한 이 스킬의 적용 방법이다. 필수 필드, 승인 단계, 갱신 시점, 기존 데이터 접근 정책은 해당 제품 요구사항에서 결정한다.
