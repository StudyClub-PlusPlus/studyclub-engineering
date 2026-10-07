# 회원 관리 (백오피스) API Spec — 대체됨

> 상태: **대체됨** (2026-10-08) → [admin-accounts/spec.md](../admin-accounts/spec.md)

이 스펙(#206)과 같은 기능 — 백오피스 회원 목록 · 계정 권한(캡틴 ↔ 크루) 변경 — 을 [admin-accounts](../admin-accounts/spec.md) 가 다룬다. 그쪽이 PR #163 리뷰와 운영진 논의를 거친 정본이다. 이 파일은 기획 문서의 링크가 끊기지 않도록 안내만 남긴다.

## 바뀐 것

| 이 스펙에 있던 것 | 정본 (admin-accounts) |
|---|---|
| `GET /api/admin/users` | `GET /api/admin/accounts` — 필터는 `systemRole` · `navigator` · `q` |
| `PATCH /api/admin/users/{accountId}/system-role` | `PATCH /api/admin/accounts/{accountId}/role` |
| 409 `CANNOT_CHANGE_OWN_ROLE` · `LAST_ADMIN_REQUIRED` | 409 `SELF_ROLE_CHANGE` · `LAST_ADMIN` |
| 이메일 원본을 목록에 싣는다 · 부분 검색 | 목록은 마스킹, 「보기」(`POST …/email-reveals`)로 한 명씩 원본 + 감사 로그 · 이메일은 전체 일치만 검색 |
| 권한 변경은 다음 로그인부터 반영 | 내림은 즉시 (`@RequireAdmin` 이 요청마다 DB 확인), 올림은 다음 백오피스 로그인부터 |
| — | 감사 로그 `ADMIN_AUDIT_LOG`, 역할별 권한표 `GET /api/admin/role-permissions`, 권한 변경 뒤 디스코드 설정 안내 |

기획 문서([회원 목록](../../01-planning/stories/captain-list-users/PRD.md) · [역할 부여](../../01-planning/stories/captain-grant-roles/PRD.md))의 API 표는 기획 쪽에서 admin-accounts 기준으로 고친다.
