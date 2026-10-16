<p align="center"><a href="README.md">English</a> · <a href="README.ko.md">한국어</a></p>

<p align="center">
  <img src="docs/assets/gisul-workshop.png" alt="검증 도구와 작업 지침 카드가 놓인 gisul 공방" width="100%">
</p>
<h1 align="center">gisul-skills</h1>
<p align="center"><strong>“알아서 잘해”는 작업 지침이 아니다.</strong><br>Less hand-waving. More procedure.</p>
<p align="center">
  <a href="#어떤-문제부터-잡을까">스킬 고르기</a> ·
  <a href="#사용하기">사용하기</a> ·
  <a href="#스킬을-추가하려면">기여하기</a> ·
  <a href="https://github.com/changeroa/gisul/blob/main/README.ko.md">gisul 연결</a>
</p>
<p align="center">
  <img src="https://img.shields.io/badge/format-SKILL.md-242424?style=flat-square" alt="SKILL.md format">
  <img src="https://img.shields.io/badge/delivery-gisul_MCP-c6492d?style=flat-square" alt="Delivered by gisul MCP">
</p>

---

## “전문가처럼 해줘.” 그래서 뭘 하라고?

AI한테 암묵지를 넣었다고 한다. 노하우를 이식했다고 한다.<br>
**그런 말 붙인다고 결과가 나아지진 않는다.**

데이터가 없는 건지, 조회가 실패한 건지도 구분 못 하는 화면.<br>
버그라고 열 개 적어놨는데 코드를 따라가면 근거가 없는 리뷰.<br>
테스트는 초록색인데 다시 들어가면 날아가는 저장 결과.

여기서는 그런 문제 앞에서 **무엇을 읽고 → 어떻게 확인하고 → 어떤 근거를 남겨야 하는지** 적는다.

숙련을 통째로 복제한 게 아니다. 그나마 비슷하게 따라 할 수 있도록 확인 절차를 남긴 거다. 멋있는 역할 이름보다 **빠뜨리지 않을 행동과 끝났다고 말할 기준**에 관심이 있다.

## 어떤 문제부터 잡을까

### 01 / 화면은 떴다. 그런데 뭘 해야 하지?

- [**ux-state-review**](skills/ux-state-review/SKILL.md) — 로딩·선행조건 미충족·빈 결과·실패를 구분하고, 각 상태의 화면과 다음 행동을 확인한다.
- [**exploratory-ux-qa**](skills/exploratory-ux-qa/SKILL.md) — 실제 브라우저에서 사용자 여정을 탐색하고 화면·네트워크 근거를 남긴다.
- [**browser-e2e-review**](skills/browser-e2e-review/SKILL.md) — 처리 중·실패·복구와 시각적 변화를 E2E 검토에 포함한다.

### 02 / 리뷰어를 늘리기 전에, 근거부터.

- [**review-orchestrator**](skills/review-orchestrator/SKILL.md) — 변경 위험을 분류하고 필요한 전문 검토만 연결한다. 리뷰 개수를 성과로 세지 않는다.
- [**review-verifier**](skills/review-verifier/SKILL.md) — 리뷰 지적을 원본과 반증으로 재검증한다. AI가 찾았다는 버그도 틀릴 수 있다.
- [**review-explainer**](skills/review-explainer/SKILL.md) — 원인·상태·변경 전후를 연결해, 프로젝트를 모르는 사람도 읽을 수 있는 설명으로 만든다.

### 03 / 버튼 한 번 눌러보고 끝내지 말자.

- [**testing**](skills/testing/SKILL.md) — coverage 목표가 아니라 계약과 위험에 따라 단위·통합·mock·DB 테스트 절차를 선택한다. [testing 팩](packs/testing-pack.json)으로도 제공한다.
- [**test-behavior-flows**](skills/test-behavior-flows/SKILL.md) — 상호작용·비동기·복구·데이터 일관성이 이어지는 행동 흐름을 검증한다.
- [**review-failure-resilience**](skills/review-failure-resilience/SKILL.md) — 타임아웃·재시도·중복 실행·부분 실패와 복구 경로를 검토한다.
- [**web-operations-qa**](skills/web-operations-qa/SKILL.md) — 운영 성능·캐시·API 지연·백그라운드 작업을 실제 근거로 조사한다.

### 04 / 끝났다는데, 어디까지 끝난 건데?

- [**development-status**](skills/development-status/SKILL.md) — 변경·검증·배포 근거를 읽어 현재 진척과 필요한 결정을 설명한다.
- [**preserve-decisions**](skills/preserve-decisions/SKILL.md) — 작업 범위·결정·증거·불확실성을 다음 작업과 세션에 넘긴다.
- [**langfuse-trace-review**](skills/langfuse-trace-review/SKILL.md) — 실제 트레이스에서 요청·응답·도구 결과와 조회 범위를 확인한다.

**[전체 스킬 보기 →](skills/)** · **[팩 보기 →](packs/)**

위 목록은 문제별 입구이지 전체 카탈로그가 아니다. 책 기반 스킬과 외부에서 가져온 스킬의 출처는 아래에서 구분한다.

## 예를 들면: 같은 빈 화면, 다른 네 가지 상황

| 상태 | 화면에서 해야 할 일 |
| --- | --- |
| 아직 불러오는 중 | 진행 상태를 보여준다. 빈 결과라고 단정하지 않는다. |
| 정상적으로 조회했지만 없음 | 첫 데이터 생성이나 검색 조건 변경을 안내한다. |
| 조회 권한이 없음 | 필요한 권한과 가능한 다음 행동을 설명한다. |
| 조회 자체가 실패함 | 실패를 알리고, 유효한 재시도 경로를 제공한다. |

**권한이 없는데 재시도 버튼을 누른다고 권한이 생기진 않는다.**<br>
[`ux-state-review`](skills/ux-state-review/SKILL.md)는 문구뿐 아니라 화면·요청·상태 전환이 같은 상황을 가리키는지 확인하게 한다.

## 사용하기

**읽어보는 데는 설치가 필요 없다.** 위 스킬 링크에서 `SKILL.md`를 열면 된다.

에이전트에 연결해서 쓰려면 [gisul의 런타임별 연결 안내](https://github.com/changeroa/gisul/blob/main/README.ko.md#시작하기)를 따른다. 이 저장소는 작업 지침이고, gisul은 지침을 검색하고 전달하는 서버·클라이언트다.

연결한 에이전트에 요청할 예시:

> Gisul에서 ux-state-review를 찾아 읽고, 이 가입 흐름의 로딩·인증 대기·실패·재진입 상태를 검토해줘. 확인한 근거와 미확인 항목을 구분해줘.

서버에 연결했다면 선택한 커밋의 스킬과 참고 자료를 함께 읽는다. 스킬은 지침이지 실행 허가가 아니다. 실제 도구 사용과 권한은 사용 중인 환경을 따른다.

## 스킬을 추가하려면

“너는 세계 최고의 전문가다”로 시작하는 소개보다 다음이 필요하다.

1. **언제 쓰는가.** 적용 상황과 적용하지 않을 상황.
2. **무엇을 하는가.** 자료·상태·행동·결과로 이어지는 절차.
3. **무엇으로 확인하는가.** 완료 증거와 미확인 범위를 구분하는 기준.
4. **어디서 왔는가.** 참고 자료, 가져온 원본과 변경 범위.

```sh
git clone https://github.com/changeroa/gisul-skills.git
cd gisul-skills
npm ci
npm run verify
```

`verify`는 CI와 같은 커밋으로 고정된 gisul 서버와 Worker, Chromium을 준비한 뒤
카탈로그 검증과 전체 테스트를 실행한다. 런타임이 필요 없는 검사만 실행하려면
`npm run test:unit`, 준비 후 통합 검사만 실행하려면 `npm run test:integration`을 쓴다.
`npm test`는 계속 전체 테스트를 실행하며, 준비가 빠졌으면 실행 전에 필요한 명령을 알려준다.

검증기는 frontmatter, 이름과 디렉터리의 일치, 파일 수·용량 등의 발견 규칙을 검사한다. **형식 검증 통과는 스킬의 효과가 입증됐다는 뜻이 아니다.** 세부 제한과 서버 통합 테스트 설정은 [기술 레퍼런스](docs/technical-reference.md)에 있다.

## 출처를 지우면 기술이 아니라 포장이다

이 저장소의 모든 스킬을 처음부터 독자적으로 만들었다고 주장하지 않는다.

- **Paperthin:** `re0`, `hate`, `feynman`, `mandela` 등을 포함한 가져온 스킬은 [LilMGenius/paperthin](https://github.com/LilMGenius/paperthin)에서 유래한다. 위 추천 목록에는 넣지 않았다. 원저자의 기여를 이 프로젝트의 독자 창작으로 소개하지 않는다.
- **책 기반 워크플로:** `clean-code` 계열과 `dont-make-me-think`는 각 스킬에 명시된 책·원칙을 바탕으로 한다. 원저자의 공식 제품이나 보증을 뜻하지 않는다.
- **가져오기 기록:** [migration/import.json](migration/import.json)은 원본 리소스 URI를, [aliases.json](aliases.json)은 채택된 URI 매핑을 기록한다. URI 기록만으로 저작권·라이선스가 확정되지는 않는다.

개별 콘텐츠의 출처와 적용 조건을 확인한 뒤 재사용한다. 스킬 내용을 가져오는 것과 운영 서버에 발행하는 것은 별개의 작업이다.

---

**절차는 읽을 수 있게. 결과는 확인할 수 있게.**<br>
[gisul](https://github.com/changeroa/gisul/blob/main/README.ko.md) · [전체 스킬](skills/) · [품질 문서](docs/quality.md) · [릴리스 문서](docs/releases.md) · [이슈](https://github.com/changeroa/gisul-skills/issues)
