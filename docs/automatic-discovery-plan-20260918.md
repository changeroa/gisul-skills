# gisul 자동 발견 계획

작성일: 2026-09-18. 이 문서는 실험 전의 설계와 후보 목록이다. 이후 수행한
[54건 비교와 추가 진단](automatic-discovery-evaluation-20260918.md)에서는 자동 검색
후보가 품질 이득 없이 비용을 늘려 전역 적용을 보류했다. 아래의 권장 구성은
검증할 가설이며 현재 적용된 설정이 아니다. 다음 순서는 검색 정확도·호출 가능
여부·중복 방지를 먼저 개선하는 것으로 좁혔다.

## 1. 권장 방향과 성공의 의미

사용자가 gisul을 매번 언급하지 않아도 새 실질 작업에서 관련 스킬을 찾도록 한다. 작업 분야는 넓게, 검색 시점과 읽는 내용은 작게 유지한다. 대화의 매 메시지마다 검색하거나 모든 스킬을 적용하는 방식은 기본값으로 삼지 않는다.

권장 구성은 **짧은 전역 발견 규칙 + 범위를 넓힌 gisul 로더 + 선택 조건을 반환하는 검색**이다. 실제 비교는 description만 확대한 조건부터 시작해 전역 규칙의 추가 효과를 확인한다. 본문은 선택된 스킬만, supporting files는 해당 절차가 요구할 때만 읽는다. hook과 의미 검색은 측정된 누락이나 검색 품질 문제를 해결할 때 추가한다.

성공은 검색 횟수 증가가 아니다. 필요한 절차를 놓치지 않고, 불필요한 호출·지연·중복 적용을 제한하면서 실제 작업의 정확도가 유지되거나 개선되어야 한다. 발견, 스킬 적용, 도구 실행 권한은 서로 구별한다. 원격 본문은 사용자의 기존 승인과 해당 작업 지침을 확장하지 않는다.

## 2. 현재 상태에서 확인한 사실

| 확인 항목 | 관찰 | 설계에 주는 의미 |
| --- | --- | --- |
| 운영 경로 | 설치 플러그인이 HTTPS Worker를 통해 검색·본문·파일을 읽는다. 확인한 content release는 `20260917.10`, commit `e6c7245951993a45cb22e523b5aa49ad450ce172`이다. | 새 원본 서버나 SSH 경로는 필요하지 않다. |
| 발견 조건 | 설치 로더 description은 gisul 언급, 원격 스킬 요청, 등록·편집 요청에 맞춰져 있다. | 연결되어 있다는 사실만으로 모든 작업의 자동 발견을 보장하지 않는다. |
| 전역 지침 | 이 Mac mini의 `~/.codex/AGENTS.md`는 0 bytes이다. | 과거의 긴 전역 지침을 줄이는 실험과 baseline이 다르다. 새 규칙의 비용은 먼저 증가로 측정한다. |
| 로컬 중복 | 직접 설치 디렉터리의 28개 스킬이 원격 33개와 이름이 겹치며, 이 28개 `SKILL.md`는 SHA256까지 같다. | 본문 중복은 확인됐지만 supporting files와 설치 메타데이터는 아직 전체 비교가 필요하다. `.system`, 플러그인, 중첩 디렉터리를 포함한 전체 로컬 스킬 수라는 뜻은 아니다. |
| 사용자 호출 전용 | 원격 33개 중 12개에 `disable-model-invocation: true`가 있다. | 자동 발견 후보와 사용자가 직접 요청한 후보를 구별해야 한다. |
| 검색 구현 | name/description/keywords에서 공백으로 나눈 모든 검색어를 부분 문자열로 찾고, URI 순으로 정렬한다. 검색 때마다 upstream 목록 페이지를 순회한다. | 현재 첫 결과를 최고 관련도로 해석하면 안 된다. 언어·표현 차이와 검색 비용을 별도로 개선할 수 있다. |
| 실제 검색 | `evaluation`은 0건, `eval`은 `mandela`를 반환했다. `plan`은 사용자 호출 전용 스킬도 반환했다. | 이번 관찰은 재현 사례이지 전체 검색 정확도의 추정치는 아니다. |
| 버전 연결 | 검색 내부 페이지와 로드 이후 파일 읽기는 pinned commit을 사용한다. 그러나 검색 결과를 받은 뒤 `load_skill`은 다시 current를 읽는다. 동일 URI 재로드는 연결의 기존 map 항목을 바꾼다. | 검색→본문 사이의 버전 변경과 동일 스킬의 복수 로드에 대한 계약이 필요하다. |
| 평가 준비 | 사례집은 22건 중 development 18건, holdout 4건이다. 후보 materializer와 mock은 있지만 실제 모델 runner·judge·사람 평가·승격 연결은 미완성이다. | 설정부터 전역 배포하지 말고 평가 실행 경로부터 완성한다. |

사용자 호출 전용 12개는 `debloat`, `dedash`, `feynman`, `hate`, `macrothink`, `prism`, `re0-git`, `re0-merge`, `re0-plan`, `re0-release`, `re0-upgrade`, `reorder`이다. 검색 결과에서 이 구분은 현재 노출되지 않는다.

Codex 공식 문서는 기본적으로 이름·설명으로 스킬을 발견하고 선택 후 본문을 읽는 동작을 설명한다. native 스킬의 암묵적 호출 정책은 `agents/openai.yaml`의 `policy.allow_implicit_invocation`으로 설정한다. 저장소의 frontmatter 표기와 같은 설정이라고 가정하지 않고 양쪽 표현을 검증·변환한다. [OpenAI skills 문서](https://learn.chatgpt.com/docs/build-skills)

9/9 실험에는 gisul을 명시하지 않은 코드 수정에서 검색이 없었던 사례가 있다. 한 번의 관찰이며, 명시 호출 실험과 모델 실행 조건도 달랐다. 따라서 자동 발견의 한계나 품질 개선 효과를 이미 입증한 자료로 취급하지 않는다. [암묵적 발견 기록](https://github.com/changeroa/gisul/blob/9959728c1726f50c5e7dd4890116d3091bd0a6b1/docs/codex-implicit-discovery-2026-09-09.md)

## 3. 검토한 선택지

| 방식 | 얻는 점 | 비용·제약 | 선택 |
| --- | --- | --- | --- |
| 현재처럼 명시 호출 위주 | 추가 지침·호출이 적음 | 사용자가 스킬 존재를 기억해야 함 | baseline으로 보존 |
| 로더 description만 확대 | 변경이 작고 native 발견 경로 사용 | 모델이 선택하지 않는 경우가 남을 수 있음 | 첫 비교 후보 |
| 짧은 발견 규칙 + 로더 확대 | 작업 시작·재사용·예외를 일관되게 설명 가능 | 지침 비용, 실제 준수율 검증 필요 | 권장 후보 |
| 매 UserPromptSubmit에서 강제 검색 | 매 메시지에 검색 기회 생성 | 짧은 답변에도 호출, 작업 경계 판단·중복·지연 문제 | 기본값으로 채택하지 않음 |
| SessionStart/선별 hook 보조 | 시작·재개 후 정책 누락을 보완할 수 있음 | 호스트 지원·신뢰 설정·중복 이벤트 확인 필요 | 정책만으로 남는 누락이 확인되면 실험 |
| 원격 카탈로그를 native stub/전체 설치로 배포 | native 이름·설명으로 각 스킬을 발견 | 상주 목록 증가, 동기화·동명 충돌, 현재 로더 계약과 충돌 | 초기 범위에서 제외 |
| 의미 검색·embedding index | 다양한 표현을 처리할 가능성 | 품질 측정, index 버전·서비스·비용 관리 추가 | 간단한 검색 개선이 부족할 때 비교 |

MCP 도구는 모델이 선택할 수 있는 인터페이스이며 프로토콜 자체가 자동 호출 시점을 정하지 않는다. 따라서 연결 성공과 자동 발견 성공은 각각 검증해야 한다. [MCP tools 명세](https://modelcontextprotocol.io/specification/2025-11-25/server/tools)

## 4. 작업별 발견 정책

여기서 작업은 사용자가 달성하려는 하나의 결과물이나 해결할 문제다. 메시지 수, tool call 수, 세션 수와 같지 않다.

| 상황 | 제안 동작 |
| --- | --- |
| 새 구현·분석·설계·리뷰·배포·문서 작업 | 저장소 지침과 요청을 읽은 뒤, 실질 작업 전에 한 번 후보 검색 |
| 같은 작업의 `계속`, 진행 상황 질문, 짧은 수정 지시 | 현재 선택과 버전을 재사용 |
| 목표·저장소·분야가 달라짐 | 새 작업으로 검색 |
| 계획→구현→검증 등 단계 전환 | 필요한 절차가 바뀌고 현재 스킬이 이를 다루지 않을 때만 재검색 |
| 오타 하나 수정, 짧은 사실 확인, 인사 | 검색 생략 |
| 사용자가 스킬명·URI를 직접 지정 | 해당 스킬을 우선 탐색·로드. 사용자 호출 전용도 명시 요청 범위에서 허용 |
| 적용 가능한 스킬이 없음 | 스킬 없이 진행하고 억지로 후보를 선택하지 않음 |
| 원격 연결 실패 | 추가 지침이 선택 사항이면 확인된 로컬 지침으로 진행. 필수 절차·명시 요청을 충족할 수 없으면 그 절차에 의존하는 동작만 보류하고 독립 작업은 계속 |

초기 실험용 예산은 검색 1회, 표현을 바꾼 재검색 최대 1회, 응답 후보 최대 5개, 최초 본문 로드 1~2개다. 이는 달성된 성능 수치나 무조건적인 상한이 아니다. 명시 요청 또는 필요한 절차의 조합은 근거를 남기고 초과할 수 있으며, critical 요구를 예산 때문에 생략하지 않는다. 빈 검색어로 전체 카탈로그를 반복 나열하는 fallback은 기본 경로에서 제거한다.

스킬이 다른 스킬을 요구해도 호출 조건과 사용자의 에이전트 사용 제약을 다시 적용한다. 같은 작업에서 읽은 `(origin, URI, commit)`의 본문은 재사용한다. 절차 실행의 중복은 같은 작업·단계·대상 revision 안에서만 판단한다. 새 작업, 단계 전환, 결과물 추가 수정은 검증 절차를 다시 실행할 수 있다. 읽기 재사용이 필요한 검증의 생략으로 이어져서는 안 된다. 첫 버전은 대화 안의 작업·로드 정보를 사용하며, 별도 작업 분류 서비스나 영속 상태 저장소는 만들지 않는다. 상호 추천으로 검색·리뷰가 반복되는 경우도 평가 사례에 넣는다.

전역 파일에는 발견 절차를 시작하는 짧은 규칙만 둔다. 자세한 판단 기준은 로더 한 곳에서 관리한다. 사용자 전역 파일의 기존 내용은 보존하고 설치기가 관리하는 부분만 갱신한다. 프로젝트별 Linear·배포 정책은 해당 저장소나 원격 supporting files에 남긴다. AGENTS는 세션 시작 시 읽히므로 새 설정의 검증은 새 실행에서 한다. [OpenAI AGENTS 문서](https://learn.chatgpt.com/docs/agent-configuration/agents-md)

원격 스킬을 읽었다는 이유만으로 이미 승인된 작업에 새 승인 단계를 붙이지 않는다. 현재 로더의 SSH/stdio 쓰기 설명은 이 설치의 HTTPS 읽기·Git 변경·CI 발행 경로와 구별하도록 정리한다. 이 안내 수정은 description 확대와 별도 변경으로 검증한다.

## 5. 구현을 나눌 경계

### 5.1 선택 조건과 검색 품질

현재 `server/src/codex.ts` bridge를 우선 확장한다. Worker와 R2 구조를 새로 만들 필요는 없다.

- 검색 결과에 자동/명시 호출 정책과 release/commit을 제공한다. 자동 검색 모드에서는 사용자 호출 전용을 제외하며, 명시 요청 경로는 유지한다. 새로운 모드 인자는 기존 호출과 호환되게 추가한다.
- 필요한 앱·CLI·로컬 파일·위임 조건을 목록화한다. 연결 도구의 유무와 스킬 내용상 사용 조건을 확인한 뒤 선택하며, URI가 있다는 이유로 적용 가능하다고 판단하지 않는다.
- 한국어·영어 표현과 실제 실패 질의를 development 사례에 추가한다. 첫 개선은 이름·alias, 작성된 keywords, description을 구분하는 결정적 순위와 소수의 검증된 동의어다. 순위와 동의어는 별도 비교한다.
- 관련도 동률은 URI로 정렬하고, 페이지 이동은 같은 검색·버전·순위에서 안정적이어야 한다. 기존 URI 순 결과를 이용하는 호출자의 호환성을 명시한다.
- 원격 Markdown 본문은 검색 index에 자동으로 전부 넣지 않는다. 배포용 metadata/index를 추가한다면 Git 관리·builder inventory·digest·관련 변경 감지·publication gate에 함께 포함한다.

캐시는 성능을 측정한 뒤 추가한다. key는 최소 origin과 commit을 포함하며 새 작업은 current 변경 여부를 확인한다. 프로세스가 이미 떠 있다는 이유로 오래된 카탈로그를 무기한 재사용하지 않는다. 초기에는 기존 목록 API를 재사용하고, 별도 버전 조회/조건부 요청이 필요한지는 실제 요청량과 지연으로 결정한다.

### 5.2 검색 결과와 읽기의 버전 계약

`load_skill`에 선택한 검색 결과의 commit을 넘길 수 있게 하고, 그 immutable release를 읽거나 명시적인 버전 불일치로 재선택하도록 한다. 새 연결·새 작업의 검색은 최신 current를 기준으로 한다.

같은 스킬의 이전 로드가 남아 있는 상태에서 새 버전을 로드할 수 있으므로, 새 로더에는 `(URI, commit)`에 결부된 `load_id` 같은 식별자를 반환하고 supporting-file 읽기에도 전달하는 안을 우선 검증한다. 기존 인자의 동작은 호환 경로로 남긴다. 다른 버전의 파일로 조용히 넘어가서는 안 된다.

완료 조건은 검색 후 current 전환, 동명 스킬 재로드, alias 이동, 두 연결의 서로 다른 버전, rollback 중 파일 읽기에서 모두 선택한 manifest와 digest가 유지되는 것이다. 제공 불가능한 버전은 명확히 실패하며 current 파일로 대체하지 않는다.

### 5.3 로컬 스킬과의 중복

먼저 전체 설치 목록을 source·canonical URI·본문 및 supporting-file digest·native 호출 정책으로 비교한다. 이름이 같다는 이유로 다른 프로젝트나 다른 제공자의 스킬을 제거하지 않는다.

실험은 현재 로컬 목록을 유지한 현실 조건과, 동명 직접 설치본을 양쪽 조건에서 동일하게 비활성화한 원격 의존 조건을 분리한다. 전자는 실제 추가 비용을, 후자는 로컬 복사본이 대신 해결해 숨긴 원격 발견 누락을 보여준다. 성과를 두 집단 사이에서 섞어 계산하지 않는다.

원격 경로가 필요한 기능과 지원 파일을 모두 제공한다는 증거가 생기면, 확인된 중복만 백업 후 비활성화하는 별도 변경을 검토한다. 시스템·커넥터·프로젝트 전용 native 스킬을 일괄 제거하지 않는다. Codex는 파일 삭제 없이 개별 스킬을 비활성화하는 설정을 제공하지만, 실제 설치 버전과 plugin 경로에서 적용되는지는 먼저 확인한다. [OpenAI skills 설정](https://learn.chatgpt.com/docs/build-skills)

### 5.4 hook을 붙이는 조건

description과 발견 규칙을 적용해도 적격 작업의 누락이 반복될 때만 hook 후보를 만든다. 먼저 설치 CLI `0.155.0`과 앱의 지원 이벤트·신뢰 설정을 확인하는 작은 검증을 한다.

첫 후보는 SessionStart에서 짧은 고정 발견 규칙을 보완하는 방식이다. UserPromptSubmit은 정말 작업별 판단이 필요하다고 입증됐을 때 검토한다. 공식 문서상 이 이벤트들의 출력은 developer context로 들어가므로 원격 SKILL.md 본문을 hook 출력에 삽입하지 않는다. 검색·본문은 MCP 읽기 경로에 남긴다. [OpenAI hooks 문서](https://learn.chatgpt.com/docs/hooks)

MCP 준비 전 실행, resume/compact 재호출, 다중 hook 중복, timeout을 시험한다. hook의 실패가 일반 대화를 붙잡지 않도록 짧은 제한 시간을 명시한다. 기존 Langfuse Stop hook에 새 exporter를 더하지 않는다. 이 단계가 필요 없으면 구현하지 않는다.

## 6. 평가 설계와 관측

### 기준선과 비교군

현재 운영 설치를 P0로 고정한다. 모델·effort·도구·fixtures·catalog commit·evaluator·권한을 실행 시작 시 기록한다. 로컬 파일 hash를 나중에 읽는 exporter 기록만으로 실행 시점의 지침을 증명하지 않는다.

각 비교에서는 한 가지 변수를 바꾼다. bridge의 호출 정책·버전 계약 변경은 먼저 별도 후보로 검증하고, 이후 발견 문구 실험의 양쪽에 같은 기반을 둔다. description 확대, 전역 규칙 추가, 순위 변경, 동의어 추가, 로컬 중복 비활성화, hook 추가는 각각 분리해 비교한다. 마지막에는 승격할 전체 묶음을 P0와 다시 비교하되, 이 최종 비교만으로 개별 기능의 효과를 주장하지 않는다.

처음에는 development의 대표 사례 6개를 고정해 작은 paired pilot을 실행하고 시간·토큰·채점 가능성을 확인한다. 유지할 후보만 전체 development로 확장하며 반복 횟수와 비용 상한을 결과 확인 전에 정한다. 시작 토큰 비교는 기존 요구대로 조건별 동일한 새 실행 5회를 사용한다. holdout은 후보를 동결한 뒤 최종 승격 판단에만 사용한다.

D1에서 사례·적격 작업의 범위·필수 결과·반복 수·비용 산식·재시도·중단 규칙을 실행 계획으로 저장하고 hash를 고정한다. 실제 비교 전 그 계획을 동결하며 결과를 보고 분모나 기준을 바꾸지 않는다. 후보의 어느 반복에서든 critical 위반이 나오면 차단한다. holdout은 사례별 통과 비율이 baseline보다 낮아지면 회귀로 판정하고, 전체 통과 수는 예정한 모든 사례×반복에서 집계한다. 평균 비용의 분모는 사전 지정한 실행 수이며 재시도 비용은 원래 실행에 합산한다. 결과·사용량·채점 누락은 통과로 간주하지 않는다. 필요 발견의 개선은 사전에 지정한 절차 누락·결과 실패와 독립적인 호출 기록을 함께 보고 판단한다.

### 시험할 범위

| 묶음 | 대표 검증 |
| --- | --- |
| 필요한 발견 | gisul 언급 없이 구현·리뷰·평가·문서·배포 절차 발견, 한국어 요청으로 영어 설명 검색 |
| 불필요한 발견 | 인사·단순 오타·상태 질문에서 생략, `계속`에서 재사용, 재개·압축 후 중복 억제 |
| 선택 정확성 | 사용자 호출 전용 제외, 명시 호출 허용, 동명 다른 source 구별, 로컬 중복 이중 적용 방지 |
| 실행 가능성 | 없는 앱·CLI·로컬 경로를 요구하는 스킬, 필요한 도구의 지연 발견, 사용자 위임 제약 |
| 단계·합성 | 계획→구현→리뷰에서 필요한 경우만 재검색, 스킬 간 추천 순환, 부분 작업 병렬 진행 |
| 버전·실패 | 검색과 로드 사이 배포, 이전 로드 파일 유지, rollback, 연결 실패, 잘못된 digest, 빈 검색 |
| 실제 업무 결과 | 기존 Critical 사례, 금지된 외부 쓰기 없음, lost-response 후 재조회, 결과물 정확성·완결성 |

기존 `agent-env-v1` 22건과 holdout 4건은 유지한다. 새 발견 실패 사례는 별도 버전의 development 묶음으로 확장하며 기존 크기 검증을 몰래 바꾸지 않는다. 설계·튜닝에서 본 사례를 새로운 holdout이라고 이름만 바꾸지 않는다. 추가 holdout이 필요하면 독립 작성·비공개 보관 후 freeze 시점에 붙인다. 기존의 `linear-delivery`, `agent-improvement` 후보 스킬을 자동 발견 실험과 동시에 운영 승격하지 않는다.

### 통과 조건

현재 [평가 계약](../eval/README.md)을 그대로 유지한다. 새 critical failure 0건, holdout 회귀 없음, 누락 채점 없음, 전체 통과 수 baseline 이상, 사례당 평균 비용 baseline의 130% 이하, judge 버전과 실제 사람 채점 10건의 일치율 기록이 필요하다. 모델 점수나 합성 점수로 사람 평가를 대체하지 않는다.

이 조건은 최소 승격 조건이다. 자동 발견을 채택할 추가 이유도 있어야 한다. 사전에 정한 적격 작업의 누락이나 실제 절차 실패가 줄지 않고 호출 비용만 늘면 후보를 채택하지 않는다. 검색의 recall@5, 불필요 호출률, 지연 p50/p95, 본문 읽기량은 보조 지표이며 검증된 행동을 대신하지 않는다. 작은 표본에서는 비율만 쓰지 않고 사례 수와 반복 간 변동을 함께 보고한다.

| 역할 | 제공하는 정보 | 숨기는 정보 |
| --- | --- | --- |
| 시험받는 작업 에이전트 | 사용자 요청, 허용된 fixtures·도구, 해당 조건의 지침 | expected·rubric·필수 절차 판정·baseline/candidate 이름 |
| 고정 judge | 익명화한 결과물·tool 기록, 고정 rubric과 필요한 정답 | 후보 이름, 설계자의 선호·기대 효과 |
| 사람 채점자 | 같은 익명 결과와 채점 기준 | 후보 이름, judge 점수와 설계자의 판정 |

D1은 작업 에이전트에게 사례 입력만 별도 작업공간으로 제공하고, 채점 자료를 에이전트의 파일·도구 입력에 노출하지 않는지 점검한다. 실험명과 synthetic 표시는 관측 경로에서 기록한다. 필요한 스킬을 정답으로 지정한 뒤 그 스킬 호출을 성공으로 세는 순환 평가를 피한다. 독립적인 결과물·fixture 상태·금지 행동을 채점하고 동등하게 유효한 절차도 인정한다. 확인한 누락을 고친 뒤 같은 holdout을 반복 튜닝하지 않는다.

### 남길 증거

- 실행 시작의 config·로더·전역 규칙·bridge·catalog·dataset·judge identity와 hash.
- 실제 tool 이벤트의 query, 반환 후보/선택, load/file URI, release, commit, manifest digest, 연결 및 실행 ID, 비용·시간.
- 발견 생략·재사용 판단이 필요한 경우 그 기록과 출처. 모델 자기보고와 실제 호출 관측은 구별하며 호출이 없다는 이유만으로 적절한 생략이라고 추정하지 않는다.
- 익명화된 사람 평가와 일치율, critical/holdout 결과, 관련 Langfuse run/trace 링크.

관측 데이터는 기존 masking 정책을 유지한다. 개발용 실행은 synthetic임을 명시하지만, 실제 사용에서 생긴 새 routing trace를 전부 synthetic으로 제외하지 않는다. 기존 E14 하루 중복 검사 예약이나 완료 판정 writer를 추가하지 않는다.

## 7. 실행 작업표

아래 경로 중 새 파일명은 제안이며 아직 구현된 API나 runner를 뜻하지 않는다. 착수 조건은 의존성 열을 따른다. 후보의 운영 승격은 D6 이후 gate를 통과한 순서로 진행한다.

| 순서 | 작업과 위치 | 산출물·완료 조건 | 의존성 |
| --- | --- | --- | --- |
| D0 | 설치·catalog inventory, `gisul-skills/eval` | 전체 스킬 source/호출 정책/파일 digest, 실제 active config, P0 재현 정보. 본문 일치와 패키지 전체 일치를 구별 | 없음 |
| D1 | 평가 runner·scorer, `gisul-skills/eval/run.mjs` 등 신규 | 사전 판정 규칙·artifact freeze, 시험 대상과 채점자 분리, fixture 쓰기 격리, 토큰·결과·누락 검출. pilot 실행이 실제 모델 결과임을 증명 | D0 |
| D2 | 검색·읽기 계약, `gisul/server/src/codex.ts`와 관련 tests | 자동/명시 구분, 선택 조건 노출, 검색 commit 연결, 복수 로드 식별, 기존 호출 호환. 배포 경합 테스트 통과 | D0, 승격 판단에는 D1 |
| D3 | 로더와 전역 규칙 후보, `gisul/clients/codex/gisul/SKILL.md`, private `eval/candidates/bootstrap` | description만 바꾼 조건과 규칙 추가 조건을 별도로 실행. 작업 시작·재사용·생략 구분 확인 | D1, D2 |
| D4 | 검색 개선 후보, bridge 및 versioned metadata | 한국어·영어 질의 실패 corpus, 결정적 순위·동의어 각각의 비교, 안정된 pagination. 효과 없는 변경은 제외 | D1, D2 |
| D5 | 실행 증거, `langfuse-masked`와 평가 runner | 실제 사용 release/commit과 정책 hash를 실행에 연결, 자기보고와 관측 분리, masking·멱등 exporter 회귀 없음 | D1~D4 중 채택 후보 |
| D6 | 전체 평가·사람 검토, private `eval` | 후보 결과를 보기 전 동결한 판정 규칙과 기존 gate 통과, 실제 사람 10건 평가, 필요 발견 개선과 비용 근거. holdout 튜닝 없음 | D3~D5 |
| D7 | `gisul-skills/scripts/publication-gate.mjs`·Actions, `gisul/clients/codex/install-plugin.mjs` | CI가 정확한 content/bridge/loader/policy artifact와 평가 증거를 결부. 변경된 조합은 기존 통과 결과 재사용 불가. 설치·복구는 소유한 설정 부분만 변경 | D6 |
| D8 | dev-tools 한정 실제 설치·검증 | 새 Codex 세션에서 명시 gisul 없이 발견, 필요한 supporting files 읽기, 부정 사례의 생략, trace 연결. installer 복구 검증 | D7 |
| D9 | Mac mini 전역 적용, 이후 중복 정리 별도 실험 | 글로벌 후보가 동일 gate와 실제 사용 검증을 통과. 확인된 직접 설치 중복만 별도 disable/restore 검증 | D8 |
| 조건부 | hook 또는 cache/의미 검색 | 반복 누락 또는 지연이라는 구체적 실패와 저렴한 대안의 한계가 있을 때만 별도 후보·평가 | D3~D8 관찰 |

임시 실행은 격리된 설정과 작업 디렉터리를 쓰며 production 플러그인 cache를 직접 편집하지 않는다. 설치 CLI의 `--help`에서 profile·설정 격리 방식을 확인한 뒤 runner에 반영한다. 현재 profile은 `$CODEX_HOME/<name>.config.toml` 형식이며 과거 `[profiles.*]` 예제를 그대로 복사하지 않는다. 평가 도구의 외부 쓰기는 fixture에만 반영한다. 실제 credential 연결은 현재 Mac의 지원 인증 흐름을 사용하고 다른 기기의 자격증명을 복사하지 않는다.

## 8. 승격·배포·복구

스킬 내용은 private `gisul-skills` Git을 원본으로 유지한다. 재사용 가능한 bridge·로더·installer는 public `gisul`, masking/exporter는 `langfuse-masked`에서 관리한다. private 프로젝트 정책과 평가 자료를 public 저장소로 옮기지 않는다.

현재 [publication gate](../scripts/publication-gate.mjs)는 내용이 같은 마이그레이션만 허용하며 행동 변경을 차단한다. 자동 검색의 description, metadata, keywords, 로컬 전역 지침도 행동에 영향을 주므로 client 쪽 파일이라는 이유로 평가를 우회하지 않는다. 내용 release뿐 아니라 설치할 bridge/loader/policy hash를 포함한 묶음에 평가 증거를 연결하고, CI는 신뢰할 수 있는 실행 결과와 실제 artifact digest를 검증한다. 저장소에 손으로 작성한 `passed: true`만으로 승격하지 않는다.

D7의 증거 계약에는 대상 artifact digest, 고정된 평가 계획·dataset·judge version, 원본 실행 결과 위치와 checksum, 실제 사람 채점의 출처·일치율, 모든 gate 판정을 넣는다. CI는 허용된 평가 실행에서 나온 증거인지와 지금 발행하는 바이트가 그 대상인지 함께 확인한다. 미완성·누락·다른 commit의 증거는 차단하며, 그 검증 경로가 완성되기 전에는 현재의 행동 변경 차단을 유지한다. metadata/index 파일을 새로 추가하면 `CONTENT_PATHS`, Git byte parity, inventory와 workflow의 관련 변경 범위에도 포함한다.

순서는 격리 후보 → dev-tools 전용 실행 → Mac mini 전역 새 세션이다. 다른 기기는 각 설치 상태와 인증을 확인해 별도로 적용한다. 시간만 경과했다고 승격하지 않고 정해진 작업 사례와 gate 결과로 판단한다.

전역 적용 전 설치기가 소유하는 설정 부분과 plugin 버전의 백업·hash를 남긴다. 복구는 그 묶음을 되돌리고 새 세션에서 확인한다. 사용자 설정이 이후 바뀌었다면 전체 파일을 덮어쓰지 않고 충돌 부분을 보존한다. remote content 변경을 되돌려야 할 때만 기존 current pointer rollback을 사용한다. client routing만 되돌리는 데 R2 content를 과거 버전으로 내릴 필요는 없다.

immutable `releases/<commit>/`, inventory/digest 검증 후 단일 current 전환, 직렬화·구버전 역전 방지, 기존 로드의 pinned file 규칙은 유지한다. 소스 경로는 `/Users/iyen/dev-tools/{gisul,gisul-skills,langfuse-masked}`이며 운영 `/Users/iyen/gisul`을 개발 소스로 덮어쓰지 않는다.

## 9. 근거와 남은 확인

이 문서의 자동 발견 정책과 API 확장은 제안이다. 품질 향상, hook의 설치 호스트 호환성, supporting files 전체 중복, 비용 개선은 아직 검증된 결과가 아니다.

| 근거 | 이번 판단에 사용한 범위 |
| --- | --- |
| [bridge 코드](https://github.com/changeroa/gisul/blob/9959728c1726f50c5e7dd4890116d3091bd0a6b1/server/src/codex.ts), [로더](https://github.com/changeroa/gisul/blob/9959728c1726f50c5e7dd4890116d3091bd0a6b1/clients/codex/gisul/SKILL.md) | 실제 검색·버전 map·본문/파일 읽기·현재 발견 문구 |
| [평가 계약](../eval/README.md), [dataset loader](../eval/dataset.mjs) | 기존 gate, 22건/4 holdout, 실제 모델 실행과 deterministic test의 구분 |
| [배포 기록](worker-r2-deployment-20260917.md), [R2 운영](r2-publication.md) | 현재 직접 서빙, immutable 발행·rollback·행동 변경 gate |
| [초기 instruction 설계](https://github.com/changeroa/gisul-skills/blob/6902eb03f7d47083ce2f2e45f8ec58f384c0c83f/docs/handoffs/worker-r2-20260917/design/02-instruction-layering-bootstrap.md), [초기 eval 설계](https://github.com/changeroa/gisul-skills/blob/6902eb03f7d47083ce2f2e45f8ec58f384c0c83f/docs/handoffs/worker-r2-20260917/design/05-evaluation-harness.md) | 길었던 전역 지침·옛 profile·Mac origin 가정은 현재 상태와 구별 |
| 이 세션의 Worker MCP 검색과 `mandela` 로드 | `evaluation`/`eval` 차이, 사용자 호출 전용 후보 노출, release/commit 반환 확인 |

조사 시점 소스는 `gisul` main `9959728c1726f50c5e7dd4890116d3091bd0a6b1`, `gisul-skills` main `d08320ab90da9d7db8e870158c5d3c5b17f5496b`, `langfuse-masked` main `65d3aa60777420ed2db91a4ce7e7c7d5b566bfa9`이다. 계획·실험 코드·증거는 private skills 저장소의 `feat/automatic-discovery-evals`에 기록한다. 원격 스킬의 실행 증거에 기록할 content commit과 저장소의 최신 문서 commit은 다른 값일 수 있다.
