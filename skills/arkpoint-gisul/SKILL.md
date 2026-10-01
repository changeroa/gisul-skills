---
name: arkpoint-gisul
description: ARKPOINT 팀 Gisul 플러그인의 연결 문제를 확인하거나 팀 스킬 등록 방법을 안내할 때 사용한다.
keywords: ["팀 스킬", "연결 진단", "등록 안내", "Gisul 연결", "ARKPOINT", "team skill registration", "registry connection troubleshooting"]
---

# ARKPOINT Gisul

팀 플러그인은 Cloudflare Worker에 HTTPS로 직접 연결한다. 맥미니, SSH 또는 로컬 Node 서버를 중간에 추가하지 않는다.

연결 문제에는 [연결 상태 안내](references/connection.md)를 읽는다. 로그인 성공과 스킬 검색 성공을 구분하고, 서버 오류를 검색 결과 없음으로 설명하지 않는다.

팀 스킬 원본은 `Ark-Point/gisul-skills`에 있다. 읽기는 GitHub `Ark-Point` 조직 구성원에게 허용된다. GitHub 연결 화면에서 읽기·편집을 한 번 승인하면 갱신 후에도 권한이 유지된다. 별도 편집자 등록이나 개인 토큰 입력은 필요하지 않다. 이전 읽기 전용 연결은 한 번 다시 연결한다. 실제 저장은 연결한 계정의 GitHub 권한으로 수행하므로 저장소 접근 권한과 브랜치 보호는 계속 적용된다. 저장소 변경과 실제 레지스트리 게시 완료를 구분하며, 게시 결과를 확인한 뒤 완료라고 말한다.

플러그인 패키지는 연결 설정과 로더만 포함한다. 원격 스킬 본문을 로컬 스킬 폴더나 플러그인에 복제하지 않는다.
