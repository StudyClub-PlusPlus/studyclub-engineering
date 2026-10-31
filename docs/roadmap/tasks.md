---
source: manual            # manual | jira:<KEY> | notion:<DB 이름>  — 트래커가 있으면 트래커가 정본, 이 파일은 내보내기
updated: 2026-10-31
---
# 실행 명단

| ID | 할 일 | 담당 | 페이즈 | 목표일 | 완료일 | 근거 |
|---|---|---|---|---|---|---|
| data-retention-audit | 문의·파일·감사 기록 일일 정리, IP·탈퇴 권한 말소 기록 | 개발 | 브랜치 검증 완료·미배포 | 2026-10-31 | | [스펙](../../specs/data-retention/spec.md) · [결정](../share/2026-10-31-data-retention-audit.md) |
| admin-discord-reveal | 회원 목록의 디스코드 아이디 개별 열람·감사 기록 | 개발 | develop 반영 | 2026-10-31 | 2026-10-31 | [구현](https://github.com/StudyClub-PlusPlus/studyclub-engineering/commit/31796e81) · [스펙](../../specs/admin-users/spec.md#디스코드-보기) |
| admin-reveal-toggle | 이메일·디스코드 눈 아이콘과 다시 가리기를 프로토타입에 맞춤 | 개발 | develop 반영 | 2026-10-31 | 2026-10-31 | [열람·가리기 명세](../../specs/admin-users/spec.md#디스코드-보기) |

**규칙**: 완료일은 근거 PR 이 머지된 날. 비어 있으면 진행 중이고, 목표일이 지났으면 돌아보기가 「밀림」 으로 센다.
