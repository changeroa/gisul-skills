# Worker HTTPS 전환 — 2026-09-17

사용자는 E-03 SSH 절전 진단의 필요성을 확인한 뒤 Cloudflare Worker 엔드포인트 사용을 요청했다. HTTPS 접속 지원을 구현하고 E-03의 완료 기준을 해당 경로 검증으로 변경했다. 현재 단계는 구현·로컬 통합 검증이며 운영 전환은 미실행이다.

## 구현

- 브리지 `--http-url` + `--bearer-token-file` 지원. HTTPS를 요구하며 테스트용 loopback만 HTTP 허용. URL에 자격정보·query·fragment를 넣지 않는다. redirect는 거부한다.
- HTTP에서는 검색·로드·보조 파일 읽기 3개 도구만 제공한다. 원격 내용은 요청 시 읽으며 release·digest·URI·connection event를 보존한다. SSH 프로세스는 시작하지 않는다.
- 기존 플러그인 설치 흐름에 HTTPS 경로를 추가했다. CLI 관리 캐시 설치·재조회·실제 검색/로드/읽기 smoke를 유지하고 토큰은 저장소·플러그인 외부 파일을 참조한다.
- 실제 Worker fetch 핸들러 → 로컬 실제 HTTP 서버 → 브리지 통합 테스트에서 인증, manifest 검증, release metadata와 이벤트, 원본 종료 후 실패와 재시작 후 다음 호출 성공을 확인했다.
- 서버 전체 37개 테스트, TypeScript build, Worker typecheck, 변경 파일 LSP 진단, 설치 dry-run 통과. 배포·설치 완료를 의미하지 않는다.

## 남은 선택과 배포 정보

현재 `worker/src/index.ts`는 `ORIGIN_BASE_URL`로 요청을 넘기는 프록시다. Mac mini의 배포 설정에는 `https://gisul-origin.iyendev.com`이 원본으로 지정돼 있다. Worker 프록시 URL을 사용하는 것과, Worker가 콘텐츠를 직접 호스팅하는 것은 구분한다. 두 방식 중 원하는 구성을 사용자에게 질문했고 아직 답변을 받지 못했다.

환경의 Cloudflare API 토큰은 `/accounts`에서 `Invalid access token`(9109)으로 거부됐다. 별도로 저장된 OAuth 계정 조회는 성공했으나 해당 계정의 `gisul-mcp` 조회는 Worker 없음(10007)이었다. 이 계정에 새 Worker를 만들지 않았다. 기존 Worker의 확인된 URL과 대상 계정 인증이 필요하다. 추정한 workers.dev URL의 무인증 health 조회는 403이었으며 이를 실제 Worker 확인 근거로 사용하지 않았다. bearer 토큰도 보내지 않았다.

공식 근거: [Cloudflare Streamable HTTP](https://developers.cloudflare.com/agents/model-context-protocol/protocol/transport/), [OpenAI의 Codex MCP 지원](https://learn.chatgpt.com/docs/extend/mcp?surface=cli). 기존 커스텀 skills 확장과 manifest 검증·이벤트를 유지하기 위해 현재 어댑터의 upstream부터 HTTPS를 지원했다.

## 기존 예약 작업

SSH 절전 관찰기는 해당 launchd job을 bootout하고 plist를 제거하며 로그는 보존한다. 실제 Sleep/full Wake를 검증했다고 주장하지 않는다. E-03과 MVP 부모의 최신 설명이 기존 완료 작업의 fingerprint와 달라졌으므로, 기존 SSH 기준으로 자동 완료할 수 없다. E-14의 완료된 하루 검사·조건부 티켓 종료는 기존 범위로 유지한다. Worker 전환 실사용 검증 뒤 E-03 및 부모의 완료 판정도 새 기준으로 맞춰야 한다.

원본은 `/Users/victor/dev-tools/gisul`이다. 운영 서버·스킬 release·기존 설치된 SSH 플러그인은 이번 구현만으로 교체되지 않았다. 임시 worktree는 만들지 않았다.
