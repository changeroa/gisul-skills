# 프로덕트 UX

[English](product-ux.md) · [팩 정의](../packs/product-ux-pack.json)

문제를 발견하는 QA와 해결 구조를 만드는 설계를 나눠 제공한다. 전문 스킬 하나로 충분하면 전체 팩을 실행하지 않는다.

| 스킬 | 담당 결정 |
| --- | --- |
| [`product-ux`](../skills/product-ux/SKILL.md) | 여러 UX 문제의 범위와 전문 절차 선택 |
| [`interface-architecture`](../skills/interface-architecture/SKILL.md) | 정보 분류·메뉴·화면 유형·업무 순서 |
| [`interface-layout`](../skills/interface-layout/SKILL.md) | 시각 위계·밀도·그리드·반응형 |
| [`collection-data-design`](../skills/collection-data-design/SKILL.md) | 목록·테이블·검색·선택·데이터 탐색 |
| [`form-command-design`](../skills/form-command-design/SKILL.md) | 폼·선택 컨트롤·검증·명령·복구 |
| [`interaction-feedback`](../skills/interaction-feedback/SKILL.md) | 로딩·갱신·저장·알림·모션·반복 |
| [`experience-mapping`](../skills/experience-mapping/SKILL.md) | 역할·채널 간 경험과 운영 전달·실행 책임 |
| [`ui-pattern-systems`](../skills/ui-pattern-systems/SKILL.md) | 패턴 선택·조합·시스템 일관성·운영 |
| [`ux-content`](../skills/ux-content/SKILL.md) | 용어·어조·UI 문구·상태·오류·현지화 |
| [`ux-research`](../skills/ux-research/SKILL.md) | 연구 질문·방법·모집·진행·분석·의사결정 |

## 기존 스킬과의 경계

- `dont-make-me-think`: 실제 화면의 명확성·발견 가능성에 대한 휴리스틱 리뷰.
- `ux-state-review`: 실제 업무 상태·권한·선행조건과 화면·요청의 일치.
- `browser-e2e-review`, `exploratory-ux-qa`: 허용된 실제 브라우저 실행과 화면·네트워크 근거.
- `preserve-decisions`: 선택한 시안·요구·증거를 큰 구현과 세션 인계에 보존.

새 전문 스킬은 이 절차를 복사하지 않고 필요한 경우 연결한다. 인터뷰·사용성 연구에는 실제 참여자와 동의가 필요하다. 에이전트의 브라우저 탐색, 형식 테스트 통과와 사람의 과업 이해는 서로 다른 증거다.

## 예시

- 기존 화면은 유지하고 로딩 전환만 개선: `interaction-feedback`. 잘림이나 공간 흔들림이 확인되면 `interface-layout` 추가.
- 역할별 온보딩 순서를 정리: `interface-architecture`. 운영 책임의 단절은 `experience-mapping`, 실제 상태 충돌은 `ux-state-review`.
- 관리자 테이블의 선택·일괄 실행을 개선: `collection-data-design` + `form-command-design`.
- 문구가 실제 상태와 맞는지 검토: `ux-content` + 필요한 상태 검토.
- 어떤 대안이 이해되는지 조사: `ux-research`. 가상 사용자를 실제 참여자처럼 보고하지 않는다.

팩을 읽는 것은 구현·외부 연락·게시·배포 허가가 아니다. 최종 보고에는 설계, 구현, 실행한 검증, 미검증과 배포를 구분한다.
