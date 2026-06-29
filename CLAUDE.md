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

기본 골격 완성 단계. 손님/직원/관리자 화면 모두 동작하며 백엔드와 연동 완료.

### API 레이어 구조

```
src/api/
  client.ts          — 기본 apiFetch (공통 응답 파싱, 에러 변환)
  staffApi.ts        — staffFetch: JWT 주입, 401 시 clearStaffAuth → /staff/login 리다이렉트
  customerApi.ts     — customerFetch: X-Session-Token 주입
  staff/             — 직원용 API (authApi, orderApi, tableApi, callApi, stationApi, ...)
  staff/admin/       — 관리자 전용 API (menuApi, tableApi, sessionApi, stationApi, ...)
src/customer/        — 손님용 API (sessionApi, orderApi, menuApi, callApi, ...)
```

### 구현된 화면

| 경로 | 파일 | 설명 |
|---|---|---|
| `/t/:tableId` | `OrderEntryPage` | 손님: 세션 생성/복원 → 메뉴 → 장바구니 → 주문현황 |
| `/staff/login` | `LoginPage` | 직원 로그인 |
| `/staff/station` | `StationSelectPage` | 로그인 후 station 지정 |
| `/staff` | `FloorBoardPage` | 직원 메인 화면 (아래 상세) |
| `/admin/table-layout` | `TableLayoutPage` | 테이블 배치 편집 |
| `/admin/menu` | `MenuManagePage` | 메뉴 관리 |
| `/admin/notice` | `NoticeManagePage` | 공지 관리 |
| `/admin/station` | `StationManagePage` | 스테이션 관리 |
| `/admin/staff` | `StaffManagePage` | 직원 관리 |

### FloorBoardPage 주요 기능

- **평면도**: 테이블/주방/레일 배치 SVG 렌더링, 테이블 선택 시 사이드 패널
- **퇴석 처리**: 더블탭 확인 → `PATCH /api/v1/admin/table/{id}/release` + `PATCH /api/v1/admin/session/{sessionId}/close` 병렬 호출
  - **알려진 제한**: `sessionId`는 활성 주문(PENDING/CONFIRMED)에서만 조회함. 주문이 모두 완료된 테이블 퇴석 시 `closeSession`이 호출되지 않아 손님 세션이 백엔드에 남음. 백엔드 `releaseTable`이 세션도 같이 닫도록 수정해야 근본 해결.
- **컨베이어 레일**: 시계/반시계 방향, 구간 표시 (`ConveyorRail` 컴포넌트)
- **주문 관리**: PENDING→CONFIRMED→COMPLETED 상태 전이, station별 필터
- **호출 처리**: 물 리필/문의/물품요청/기타
- **station 대리**: 다른 station 커버 설정 (localStorage에 username별 저장)
- **관리자 패널**: 슬라이드 패널로 메뉴/공지/station/직원/테이블 배치 인라인 접근 (ADMIN role만)
- **FAB**: 레일 방향 전환 + 구간 재정렬 컨트롤
- **폴링**: 10초 간격 자동 갱신

### 손님 세션 흐름

1. `/t/:tableId` 진입 → sessionStorage에 기존 토큰 확인
2. 있으면 `GET /api/v1/session/{token}` 검증 — `ACTIVE` + 같은 테이블이면 재사용
3. 없거나 유효하지 않으면 `POST /api/v1/session { tableId }` 로 새 세션 생성
4. 토큰은 `sessionStorage['sushiorder.customer.sessionToken']`에 저장 (탭별 독립 — 같은 브라우저에서 여러 테이블 탭을 열어도 세션이 섞이지 않음)

### 로컬 개발 계정 (data.sql 시드)

- `admin / admin1234` (ADMIN, stationId null)
- `staff_aburi / staff1234` (STAFF) — 외 4명

### 개발 환경 주의

- `.env.local`의 `VITE_API_BASE_URL`이 로컬 IP로 설정되어 있으면 백엔드 요청이 pending 상태로 걸린다. 로컬 개발 시 `http://localhost:8080`으로 맞출 것.
- Vite `.env.local` 변경 후 반드시 개발 서버 재시작 필요.
