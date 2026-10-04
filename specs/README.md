# API Specs — StudyClub++

> 가이드: [spec-driven-development.md](../docs/backend-development-guide/spec-driven-development.md)
>
> **Story PRD** 는 [`planning/stories/{story-name}/PRD.md`](../planning/README.md) 에 둔다. `specs/` 안에 만들지 않는다.

## 도메인 목록

| 도메인 | 폴더 | 상태 | 설명 |
|--------|------|------|------|
| 스터디 | [study/](./study/) | 구현중 | 스터디 목록·상세·등록 |
| 스터디 신청 | [study-application/](./study-application/) | 스펙작성중 | 신청 폼 설계·제출·결과·디스코드 연동. 기획: [폼 제작](../planning/stories/captain-application-form/PRD.md) · [제출](../planning/stories/crew-submit-application/PRD.md) · [결과](../planning/stories/captain-application-results/PRD.md) |
| 회원 | [account/](./account/) | — | 인증·프로필·온보딩 |
| 제안 | [proposal/](./proposal/) | — | 스터디 제안·관심 표시 |
| 알림 | [notification/](./notification/) | 스펙작성중 | 이벤트 기반 알림 발송 (첫 구현: 회원가입 웰컴메일) |
| 내 스터디 | [my-studies/](./my-studies/) | 구현완료 | `GET /api/me/studies` — 명부 스터디 + 회차별 내 출석. 기획: [내 스터디](../planning/stories/crew-joined-studies/PRD.md) |
| 스터디 회차 | [study-meeting/](./study-meeting/) | 스펙작성중 | `/api/studies/{studyId}/meetings` — 네비게이터의 분반 회차 조회·추가(반복)·수정·삭제. 기획: [회차 등록](../planning/stories/navigator-register-sessions/PRD.md) |
| 회원 탈퇴 | [user-leave/](./user-leave/) | 스펙작성중 | `DELETE /api/me` — 계정 즉시 삭제, 데이터 파기·보존 정책 |
| 백오피스 회원 | [admin-accounts/](./admin-accounts/) | 스펙작성중 | `GET /api/admin/accounts` 회원 목록 · `PATCH /api/admin/accounts/{id}/role` 계정 권한 변경 · `GET /api/admin/role-permissions` 권한표. 기획: [회원 목록](../planning/stories/captain-list-users/PRD.md) · [역할 부여](../planning/stories/captain-grant-roles/PRD.md) |

## 도메인 외 스펙

API 도메인이 아닌 것(인프라·운영). 구조는 같되 엔드포인트 스펙 대신 설계를 담는다.

| 스펙 | 폴더 | 상태 | 설명 |
|------|------|------|------|
| 관측 스택 | [observability-stack/](./observability-stack/) | 1단계 구현 | 로그(Grafana+Loki+Alloy) → 메트릭·알림은 후속 |
| 요청 인가 가드 | [authz-guards/](./authz-guards/) | 스펙작성중 | `@RequireAdmin` · `@RequireCaptainOrNavigator` · `@RequireOnboarding` 어노테이션 통일. [back-office-login](./back-office-login/spec.md) 후속 |

> `—` = 아직 스펙 없음. 필요할 때 `_templates/` 에서 복사해서 시작한다.

## 빠른 시작

```bash
# 새 Story PRD
mkdir -p planning/stories/{story-name}
# 그 폴더에 PRD.md 작성 후 planning/README.md 표에 한 줄 추가

# 새 도메인 스펙 시작
mkdir -p specs/{도메인}
cp specs/_templates/spec-template.md specs/{도메인}/spec.md

# Claude Code 에서
/spec {도메인}           # 초안 자동 생성
/spec plan {도메인}      # 구현 계획 생성
/spec tasks {도메인}     # 태스크 도출
/spec review {도메인}    # 검증
```
