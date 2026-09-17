# 구현 상태 — 2026-09-17 Worker HTTPS 전환

MVP는 12/14 완료이며, 사용자 요청으로 E-03을 **Worker HTTPS 연결 검증**으로 변경했다. SSH 절전 관찰기는 종료·plist 제거·부재 확인을 마쳤고 로그를 보존했다. 잠자기 시험은 더 이상 새 경로의 완료 조건이 아니다.

HTTPS 브리지와 플러그인 설치기 지원을 구현·커밋·푸시했다. 실제 Worker fetch 핸들러와 HTTP 원본을 통한 인증·검색·로드·파일 digest 검증, 원본 중단 뒤 실패와 재시작 후 재호출, release·이벤트 기록 검증을 포함해 서버 테스트 37개가 통과했다. 빌드·타입 검사·변경 파일 LSP·설치 dry-run도 통과했다.

운영 전환은 아직 하지 않았다. Worker가 콘텐츠까지 직접 서빙할지 Mac mini 원본을 중계할지, 사용할 Worker URL 또는 생성할 Cloudflare 계정을 확인 중이다. 환경의 Cloudflare 토큰은 invalid이고 저장된 다른 OAuth 계정에는 gisul-mcp Worker가 없었다. 다른 계정에 Worker를 생성하거나 확인되지 않은 URL에 bearer 토큰을 보내지 않았다.

E-14의 9/18 09:10 KST 이후 9/17 전일 검사·조건부 Linear 완료 작업은 유지한다. E-03과 MVP 부모는 변경된 수용 기준의 fingerprint 때문에 기존 SSH 기준으로 자동 종료되지 않는다. HTTPS 운영 검증 뒤 해당 완료 흐름을 새 기준에 맞춰야 한다. 큐의 오래된 대기 문구는 E-03의 현재 상태가 아니며 Linear와 이 기록을 우선한다.

정식 원본은 `/Users/victor/dev-tools/gisul`, 이번 구현 커밋은 `10ea0c0ed8942d5ac00f394fc39b8a8711f3dfd2`다. Mac mini 운영 서버 `81878f3d9ad0be3825cb97f3a4593882223b04c1`, 스킬 release `20260917.2`, 설치된 gisul 플러그인 `0.1.0+codex.20260916082629`는 아직 기존 SSH 경로다. exporter는 `171fcdfdb6c7707ab2d16d81ec4ea6136aaaab47`이다.

[이번 변경 상세](WORKER-HTTPS-20260917.md), [직전 기록](STATUS-before-worker-https-20260917.md), [서버 PR](https://github.com/changeroa/gisul/pull/2). Linear API 재조회는 `linear-worker-https-20260917.json`, 자동 완료 guard 확인은 `mvp-closure/worker-transition-guards.json`에 기록했다. PR은 draft·미병합이다. 임시 worktree·하위 에이전트는 만들지 않았고 Slack·다른 Linear 프로젝트 쓰기는 하지 않았다.
