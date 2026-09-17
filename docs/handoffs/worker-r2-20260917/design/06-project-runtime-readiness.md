# 06. 프로젝트 실행 경로 템플릿 (`project-runtime`)

**결정(2026-09-16):** 이 프로그램은 특정 제품이 아니라 개발 환경 세팅이다. 따라서 이 문서는 대표 프로젝트에 바로 적용하는 설계가 아니라, 어떤 저장소든 붙일 수 있는 **템플릿과 계약**을 정의한다. 실제 적용은 중기 계획에서 프로젝트를 고른 뒤 한다. 아래 예시 경로는 eum-content-studio를 가정한 것이며 확정이 아니다.

목표: 에이전트가 서버 상태·계정·포트·로그를 추측하지 않도록 재실행 가능한 `ensure-ready`와 합의된 사용자 흐름을 검증하는 `verify-flow` 계약을 정한다. 9월 15일의 계정 오판·로그인 중간 화면·image_ref 단정 사례가 계약의 근거다. 템플릿은 `gisul-skills/templates/project-runtime/`에 두고 `project-runtime` 스킬이 적용 절차를 안내한다.

## 1. 파일

```text
eum-content-studio/
├── AGENTS.md                          # "먼저 scripts/dev/ensure-ready 실행" 한 줄 + 출력 위치
├── scripts/dev/
│   ├── ensure-ready                   # 멱등. 정상 서버 재사용, 부족한 것만 기동
│   ├── verify-flow                    # verify-flow <flow-name>
│   └── flows/
│       ├── login-no-interstitial.yaml
│       └── content-generate-download.yaml
└── .agent-runtime/                    # gitignore. 생성물만
    ├── ready.json
    ├── logs/{api,web}.log
    └── verify/<flow>/<ts>/{result.json, *.png, trace.zip}
```

## 2. `ensure-ready` 계약

- 입력: 없음(환경변수 `EUM_ENV=dev|test`, 기본 dev). 옵션 `--restart` 없이는 정상 서버를 재시작하지 않는다.
- 동작 순서: 툴체인 버전 확인 → 의존성 설치 여부 확인(lockfile 해시 비교, 같으면 건너뜀) → DB/마이그레이션 상태 → API·web 프로세스 헬스 체크(있으면 재사용, 없으면 기동해 로그를 `.agent-runtime/logs/`로) → 테스트 계정 목록과 **실제 로그인 후 반환된 계정 식별자** 조회 → `ready.json` 기록.
- 종료 코드: 0 준비됨, 2 일부 미충족(`unmet` 참고), 1 스크립트 오류.

`ready.json`:

```json
{
  "project": "eum-content-studio", "env": "dev", "checked_at": "2026-09-16T06:00:00Z",
  "services": [
    { "name": "api", "url": "http://127.0.0.1:4000", "pid": 4132, "healthy": true, "log": ".agent-runtime/logs/api.log", "reused": true },
    { "name": "web", "url": "http://127.0.0.1:3000", "pid": 4140, "healthy": true, "log": ".agent-runtime/logs/web.log", "reused": false }
  ],
  "accounts": [
    { "role": "hospital-admin", "login_hint": "env:EUM_TEST_ADMIN", "verified_identity": { "user_id": "u_123", "workspace": "ws_demo" } }
  ],
  "contracts": { "openapi": "apps/api/openapi.json", "image_ref": "apps/api/src/schemas/image-ref.ts" },
  "unmet": []
}
```

`accounts[].verified_identity`는 로그인 API 응답에서 읽은 값이다. 계정 이름을 그대로 적지 않는다. `contracts`는 에이전트가 계약을 설명하기 전에 읽어야 할 원본 위치다.

## 3. `verify-flow` 계약

- `verify-flow login-no-interstitial` 은 `flows/login-no-interstitial.yaml`을 읽어 Playwright로 실행한다. `aside-browser` 스킬을 쓰는 경우에도 같은 yaml을 절차서로 읽는다.
- flow yaml:

```yaml
name: login-no-interstitial
role: hospital-admin
steps:
  - goto: /login
  - fill: { selector: "[name=email]", value: "$account.email" }
  - fill: { selector: "[name=password]", value: "$account.password" }
  - click: "button[type=submit]"
  - expect_url: "^/dashboard"        # 중간 확인 화면(/confirm)에 멈추면 실패
  - expect_not_visible: "[data-testid=interstitial]"
artifacts: [screenshot, trace]
```

- 출력: `.agent-runtime/verify/<flow>/<ts>/result.json` `{ passed, failed_step, url_at_failure, artifacts }`, 종료 코드 0/1.
- 완료 보고 규칙(02번 공통 원칙)과 연결: 해당 flow가 통과한 `result.json` 경로가 완료 근거다.

## 4. 개발용 로그인 보조

- 비밀번호 입력 없이 역할로 로그인하는 dev 전용 엔드포인트를 둔다면 `EUM_ENV=dev|test`에서만 라우트를 등록하고, CI에 "production 빌드에서 해당 라우트 404" 테스트를 추가한다.
- 자격증명은 `.env.local`·1Password CLI로만 읽고 `ready.json`에는 식별자만 남긴다.

## 5. 격리

- 동시에 두 에이전트가 같은 저장소에서 `ensure-ready`를 실행하면 포트 충돌이 난다. `EUM_PORT_BASE`(기본 3000/4000)를 worktree별로 다르게 잡고 `ready.json`에 기록한다. worktree 사용 규칙은 02번 전역 지침의 정리 책임을 따른다.
- Mac mini의 gisul 서비스 디렉터리는 개발 작업 디렉터리로 쓰지 않는다.

## 6. 수용 기준

- [ ] `ensure-ready`를 연속 두 번 실행하면 두 번째는 서비스를 재기동하지 않고 5초 안에 끝난다 (`reused: true`).
- [ ] `ready.json.accounts[0].verified_identity.workspace`가 실제 로그인 응답과 같다.
- [ ] `verify-flow login-no-interstitial`이 9/15 결함 재현 커밋에서 실패하고 수정 커밋에서 통과한다.
- [ ] 루트 AGENTS.md가 두 스크립트를 가리키고, `apps/api/AGENTS.md`가 `contracts.image_ref` 경로를 가리킨다.
