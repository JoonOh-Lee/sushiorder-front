# 백엔드 지시사항 — 직원 계정 관리 API

모두 ADMIN 권한 필요. 기존 프로젝트 패턴(ApiResponse 래퍼, 한국어 오류 메시지) 동일하게 맞춰줘.

---

## 1. 직원 목록 조회

```
GET /api/v1/admin/staff
```

응답: `ApiResponse<List<StaffResponse>>`

StaffResponse 필드:
- id
- username
- role (STAFF | ADMIN)
- stationId (nullable)
- onDuty
- active

---

## 2. 직원 계정 생성

```
POST /api/v1/admin/staff
Body: { "username": "hong01", "password": "1234", "role": "STAFF" }
```

응답: `ApiResponse<StaffResponse>`

- username 중복 시 400 + 한국어 오류 메시지 ("이미 사용 중인 아이디입니다.")

---

## 3. 역할 변경

```
PATCH /api/v1/admin/staff/{id}/role
Body: { "role": "ADMIN" }
```

응답: `ApiResponse<Void>`

---

## 4. 비밀번호 초기화

```
PATCH /api/v1/admin/staff/{id}/password
Body: { "password": "newpass" }
```

응답: `ApiResponse<Void>`

- 관리자가 타인 비밀번호를 강제 변경하는 용도 (본인 확인 불필요)

---

## 5. 계정 비활성화 / 활성화

```
PATCH /api/v1/admin/staff/{id}/deactivate
PATCH /api/v1/admin/staff/{id}/activate
```

응답: `ApiResponse<Void>`

- 비활성화된 계정은 로그인 불가 처리
- 본인 계정은 비활성화 불가 (자기 자신 잠금 방지)
