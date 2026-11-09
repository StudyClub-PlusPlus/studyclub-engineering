---
source: manual            # manual | jira:<KEY> | notion:<DB 이름>  — 트래커가 있으면 트래커가 정본, 이 파일은 내보내기
updated: 2026-11-09
---
# 실행 명단

| ID | 할 일 | 담당 | 페이즈 | 목표일 | 완료일 | 근거 |
|---|---|---|---|---|---|---|
| analytics-privacy | GA4·Amplitude HMAC 식별·문의 중단·탈퇴 삭제 | 개발 | develop 반영·스테이지 기본 검증 완료. HMAC 설정·삭제 권한·테스트 계정 준비 후 외부 연동 검증 필요 | 2026-11-08 | 2026-11-09 | [PR #443](https://github.com/StudyClub-PlusPlus/studyclub-engineering/pull/443) · [운영 절차](../analytics-privacy.md) |
| data-retention-audit | 문의·파일·감사 기록 일일 정리, IP·탈퇴 권한 말소 및 기록별 규칙·만료일 저장 | 개발 | 보완 검증 완료·PR #410 미머지 | 2026-11-01 | | [스펙](../../specs/data-retention/spec.md) · [결정](../share/2026-10-31-data-retention-audit.md) |
| user-dormancy-180-days | 명부 참여·로그인 이력으로 180일 휴면 기준 변경 | 개발 | develop 반영 · 스테이지 검증 완료 | 2026-10-31 | 2026-11-01 | [결정](../share/2026-10-31-user-dormancy-180-days.md) · [PRD](../../01-planning/stories/captain-list-users/PRD.md) |
| admin-discord-reveal | 회원 목록의 디스코드 아이디 개별 열람·감사 기록 | 개발 | develop 반영 | 2026-10-31 | 2026-10-31 | [구현](https://github.com/StudyClub-PlusPlus/studyclub-engineering/commit/31796e81) · [스펙](../../specs/admin-users/spec.md#디스코드-보기) |
| admin-reveal-toggle | 이메일·디스코드 눈 아이콘과 다시 가리기를 프로토타입에 맞춤 | 개발 | develop 반영 | 2026-10-31 | 2026-10-31 | [열람·가리기 명세](../../specs/admin-users/spec.md#디스코드-보기) |

**규칙**: 완료일은 근거 PR 이 머지된 날. 비어 있으면 진행 중이고, 목표일이 지났으면 돌아보기가 「밀림」 으로 센다.
