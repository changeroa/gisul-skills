# 독립 UML·객체 설계 팩

[English](object-design.md) · [팩 정의](../packs/object-design-pack.json)

클린코드·테스팅·프론트엔드 등 다른 팩을 설치하거나 로드할 필요가 없는 별도 팩이다. 범위 설정·실행 조율·검증도 이 팩 자체의 스킬이 담당한다.

| 스킬 | 담당 결정 |
| --- | --- |
| [`object-design`](../skills/object-design/SKILL.md) | 범위·모드와 모델 목적을 정하는 진입점 |
| [`object-design-workflow`](../skills/object-design-workflow/SKILL.md) | 위험과 실행 피드백에 따른 작은 설계 반복 |
| [`uml-modeling`](../skills/uml-modeling/SKILL.md) | 다이어그램 선택·표기 의미·버전·일관성 |
| [`use-case-modeling`](../skills/use-case-modeling/SKILL.md) | 행위자 목표·경계·시나리오·확장·보장 |
| [`domain-contract-modeling`](../skills/domain-contract-modeling/SKILL.md) | 개념 모델·시스템 이벤트·연산 계약 |
| [`responsibility-design`](../skills/responsibility-design/SKILL.md) | 객체의 책임과 협력 배정 |
| [`pattern-application`](../skills/pattern-application/SKILL.md) | 패턴과 단순 대안의 적용·비용 비교 |
| [`architecture-modeling`](../skills/architecture-modeling/SKILL.md) | 품질 요구·구조·실행·배포 뷰와 결정 |
| [`object-design-verification`](../skills/object-design-verification/SKILL.md) | 요구·모델·코드의 추적성과 반례 검증 |

## 선택 예

- 클래스 관계와 다중성을 설명·검토: `uml-modeling`.
- 외부 역할의 목표에서 실패·복구·보장까지: `use-case-modeling`.
- 현실 개념과 저장 구조가 섞인 모델을 정리: `domain-contract-modeling`.
- 어떤 객체가 계산·생성·조정을 맡아야 하는지: `responsibility-design`.
- 패턴이 정말 필요한지, 더 단순한 해법이 있는지: `pattern-application`.
- 품질 요구를 구조·프로세스·배포에 연결: `architecture-modeling`.

전문 스킬 하나로 충분하면 전체 절차를 다시 실행하지 않는다. 직접 작성한 작은 모델도 유효한 결과물이다. 모든 UML 뷰·패턴·문서를 필수 산출물로 만들지 않는다.

## 근거와 권한

현재 구현, 관찰된 동작, 승인된 요구와 설계 제안을 구분한다. 개념 모델, 소프트웨어 타입과 DB 구조를 자동으로 일치시키지 않는다. 표기 문법 검사·렌더링·의미 검토·코드 추적·실제 실행은 서로 다른 증거다.

팩은 코드 수정·외부 전송·commit·push·배포를 허가하지 않는다. 요청 모드와 호스트 정책을 따른다. 검증 보고에는 대상 버전과 시나리오, 실제 확인한 근거, 미검증과 남은 결정을 남긴다.
