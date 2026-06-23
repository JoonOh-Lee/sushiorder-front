# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

회전초밥 매장용 QR 주문/관리 시스템 프론트엔드. Vite + React 19 + TypeScript. 백엔드는 별도 레포인 `../sushiorder` (Spring Boot 4, `/api/v1/**`)이며, 이 레포는 그 API를 호출하는 클라이언트만 담는다.

화면은 두 종류로 완전히 분리된다:
- **손님용**: 테이블 QR을 스캔해서 열리는 주문 페이지. 인증 없이 접근, QR 세션 토큰으로 식별.
- **직원용**: 매장에 고정된 공유기기(공기계)에서 username/password로 로그인해 쓰는 관리 화면. 일용직이 매일 바뀔 수 있어서 사람이 아니라 "그날 로그인한 사람 + 본인이 지정한 station"으로 동작한다. 직원 1인당 QR/개인폰 로그인은 의도적으로 채택하지 않음 — 손님 QR 세션과 다른 인증 체계를 또 만드는 복잡도를 피하기 위한 결정.

## 빌드 / 실행

- 의존성 설치: `npm install`
- 개발 서버: `npm run dev` (Vite, 기본 포트 5173)
- 빌드: `npm run build` (`tsc -b && vite build`)
- 린트: `npm run lint`
- 백엔드를 먼저 `../sushiorder`에서 `./gradlew bootRun`으로 띄워야 API 호출이 동작한다 (기본 `http://localhost:8080`).
- 백엔드 CORS는 `http://localhost:3000`, `http://localhost:5173`만 허용하도록 설정되어 있다 (`sushiorder/SecurityConfig.corsConfigurationSource`). 개발 서버 포트를 바꾸면 백엔드 쪽도 같이 추가해야 한다.

## 백엔드 API 연동 — 인증 체계 (절대 섞으면 안 됨)

백엔드에는 손님/직원용으로 완전히 분리된 두 인증 체계가 있다. 자세한 엔드포인트 목록은 `../sushiorder/postman/sushiorder.postman_collection.json` 참고.

### 1. 직원 인증 (JWT, `/api/v1/auth/**`, `/api/v1/staff/**`, `/api/v1/admin/**`, `/api/v1/station/**`)
- `POST /api/v1/auth/login` `{ username, password }` → `{ token, username, role, stationId }`
- 이후 모든 요청에 `Authorization: Bearer {token}` 헤더 필수 (접두사 `Bearer ` 포함, 공백 있음).
- `role`이 `ADMIN`이면 `/api/v1/admin/**`까지 접근 가능, `STAFF`는 `/api/v1/staff/**`, `/api/v1/station/**`만.
- 토큰 만료 12시간. 공유기기 특성상 매일 출근 시 재로그인하는 흐름을 기본으로 짠다 (자동 로그인 유지 X).
- 로그인 후 `stationId`가 없으면(`null`) 본인 station 미지정 상태 — `PATCH /api/v1/staff/me/station { stationId }`로 지정해야 함. 직원용 화면은 로그인 직후 이 상태를 체크해서 station 선택 단계로 보내야 한다.

### 2. 손님 QR 세션 (`/api/v1/order/**`, `/api/v1/session/**`)
- QR을 스캔하면 페이지가 `POST /api/v1/session { tableId }`를 호출 → `{ sessionToken, ... }`를 받음. `tableId`는 QR URL의 쿼리스트링/경로로 전달되는 걸 가정.
- 이후 주문 관련 요청은 `X-Session-Token: {sessionToken}` 헤더로 보낸다 (Bearer 접두사 없음, JWT와 별개).
- 세션 토큰은 로컬스토리지/세션스토리지에 저장해 새로고침해도 유지하되, 직원 JWT와 같은 저장 키를 쓰면 안 됨 — 같은 브라우저에서 직원 화면과 손님 화면을 같이 열 일은 없지만 키 충돌 방지를 위해 분리.

### 공통 응답 포맷
모든 응답은 `{ success: boolean, data: T | null, message: string | null }`로 온다. `success: false`일 때 `message`를 그대로 사용자에게 보여주면 됨 (백엔드가 이미 한국어 메시지로 내려줌).

## 현재 구현 상태

Vite 스캐폴드 직후 상태 — 라우팅/상태관리 라이브러리, API 클라이언트, 화면 모두 아직 없음. 다음 작업 시작점.
