# 07. 롤아웃과 검증

## 1. 단계와 게이트

| 단계 | 작업 | 게이트 (다음 단계 진입 조건) | 문서 |
| --- | --- | --- | --- |
| 0 | 로컬 gisul main → Mac mini 배포, 플러그인 재빌드. `Not connected` 재현 절차 실행 | `search_skills`가 `nextOffset` 반환, 재현 결과 기록 | 01 §7, §6 |
| 1 | `gisul-skills` 저장소 생성, 3개 스킬 이관, validate/build-release, 심볼릭링크 서빙, `_meta.release` | 01 수용 기준 7개 | 01 |
| 2 | exporter 멱등 id·최상위 입출력·metadata·gisul 이벤트 조인 | 04 수용 기준 | 04 |
| 3 | 사례집 v1, runner, mock Linear, baseline 실행 1회 | Langfuse experiment 1개, judge 일치율 기록 | 05 |
| 4 | 전역 AGENTS.md 축약 + 로더 description을 candidate로 평가 → 승격 | 중요 사례 새 실패 0, 첫 generation 토큰 감소 | 02, 05 |
| 5 | linear-delivery 분리 + `projects/arkpoint.yaml` → candidate 평가 → 승격 → 전역 Linear 절 삭제 | L-01~L-08 통과 | 03 |
| 6 | `project-runtime` 템플릿과 스킬 작성, 적용 프로젝트 선정 후 적용 | 06 수용 기준 | 06 |
| 7 | agent-improvement 예약 분석, 일일 품질 검사 | 3일 연속 후보 파일 생성, 품질 검사 결측 0 | 05 §6, 04 §5 |

0·1·6은 서로 독립이라 병렬 가능. 2는 1의 이벤트 로그 형식이 확정되면 시작.

## 2. 기기별 확인

| 기기 | 역할 | 확인 항목 |
| --- | --- | --- |
| macbook-pro | 편집·평가 실행 | 플러그인 버전, `~/.codex/AGENTS.md` 해시, 이벤트 로그 생성, eval 프로파일 |
| macmini | gisul 서버 + OpenClaw | launchd 재시작 후 `_meta.release`, HTTP `/healthz`, OpenClaw의 gisul 경로가 SSH가 아닌 로컬 stdio인지, OpenClaw trace에 `agent:openclaw` 태그 |
| macbook-air | 추가 클라이언트 | 플러그인 설치 스크립트 실행, 동일 release 조회, 전역 AGENTS.md 동일 해시 |

세 기기의 전역 AGENTS.md는 `gisul-skills/personal/AGENTS.md`에서 복사하고 해시를 `ready`처럼 비교하는 한 줄 스크립트(`scripts/check-device.sh`)를 둔다.

## 3. 위험과 완화

| 위험 | 완화 |
| --- | --- |
| 심볼릭링크 루트가 서버 walker에서 예상과 다르게 동작 | 1단계 시작 시 통합 테스트로 먼저 확인. 실패하면 `GISUL_SKILL_ROOTS`를 release 경로로 직접 바꾸고 launchd 재시작으로 대체 |
| URI 이관으로 진행 중 세션의 로드 실패 | alias 두 release 유지, `movedFrom` 노출 |
| Stop 훅 상태 파일로 새 턴만 보내다가 유실 | id가 멱등이므로 상태 파일 삭제 후 전체 재전송으로 복구 |
| mock Linear가 실제 API와 달라 평가가 현실을 못 잡음 | fixture는 실제 응답을 녹화해 만들고, 승격 후 실제 trace로 재확인(05 §5) |
| 전역 지침 축약으로 Herdr 다중 pane 협업 규칙 소실 | `herdr --skill` 경로 확인, 필요하면 `HERDR_ENV` 조건부 한 줄만 유지 |
| 평가 실행 비용 | 사례 30개 × 2 프로파일 × max reasoning. 1회 비용을 첫 실행에서 측정해 §5 임계값 조정 |

## 4. 사용자 결정 (2026-09-16 확정)

1. `gisul-skills`, private, changeroa. — 확정
2. 28개 전부 채택, ouroboros-* 23개 삭제. — 확정
3. 두 번째 클론 삭제. — 완료
4. Linear 팀에 `Verifying` 상태 추가, GitHub 연동의 병합→Done 자동화를 병합→In Review로 변경. — 확정
5. 이 프로그램은 제품 프로젝트가 아니라 개발 환경 세팅이다. 티켓은 Linear **personal** 프로젝트에 발행한다. 06번은 템플릿으로 남기고 적용 대상 선정은 중기로 미룬다. — 확정

남은 결정: `projects/arkpoint.yaml`의 저장소 URL·정책 문서 위치(03번 적용 시), 예약 분석의 실행 기기·시각·예산(중기).

## 5. 되돌리기

- 서빙: 심볼릭링크 이전 release.
- 서버 코드: 이전 rsync 대상은 `releases/`와 달리 보존되지 않으므로 `deploy-macmini.sh`가 배포 전 `server.bak-<ts>`를 만든다.
- 전역 AGENTS.md: gisul-skills Git 이력.
- exporter: 플러그인 캐시의 이전 버전 디렉터리를 남기고 `config.toml` 버전 포인터만 되돌린다.
