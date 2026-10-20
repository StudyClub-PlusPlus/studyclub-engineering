---
상태: 질문
물어볼 사람: 아래 노션 이슈의 담당자 · 스터디팀
반영: 해당 없음 — 할 일은 이미 각 PRD 「개발 범위」에 적혀 있다
---

# 노션에서 「완료」인 이슈 중 코드에는 할 일이 남은 것이 있다

## 미리 알아야 할 것

| 단어 | 뜻 |
|---|---|
| **노션 이슈 DB** | 팀이 기능 하나씩 담당자·진행 상태를 적는 노션 표. `FE작업상태` · `BE작업상태` 칸이 있다 |
| **FE · BE** | FE = 화면(core-front 사용자 사이트 · back-office-front 운영 콘솔). BE = 서버(backend) |
| **API · 컨트롤러** | API = 화면이 서버에 정보를 달라고 부르는 창구. 컨트롤러 = 서버 쪽에서 그 창구를 실제로 여는 코드 |
| **mock** | 서버 대신 화면 안에 넣어 둔 가짜 데이터 |
| **개발 범위 표** | 각 Story PRD §3 맨 앞의 「지금 → 할 일」 표. 2026-10-14 `beta` 코드를 보고 채웠다 |

## 한 줄 요약

노션 이슈 5건의 상태가 코드보다 앞서 있다. **노션 상태를 고치거나, 레포에서 남은 일을 마저 해야 한다.**
남은 일은 각 PRD 의 개발 범위 표에 이미 적혀 있다.

## 비유 — 택배 조회와 실제 상자

택배 조회에는 「배송 완료」라고 뜨는데, 현관에는 상자가 없다.
조회 화면(노션)만 보는 사람은 끝났다고 믿고 다음 일로 넘어간다.
이 문서는 현관(코드)을 직접 열어 보고 비어 있던 자리를 적은 것이다.

## 왜 — 지금 뭐가 문제인가

10-14 에 PRD 28건의 개발 범위 표를 채우면서 노션 스터디팀 이슈와 대조했다.
아래 행은 노션에서 「완료」이거나 빈칸인데, 코드에는 할 일이 남아 있다.

| 노션 ID | 이슈 | 노션 상태 | 코드에서 본 것 | 남은 일 (PRD 개발 범위) |
|---|---|---|---|---|
| 48 | 스터디 참여 신청 폼 제출 | BE 완료 | 「내 신청 여부」 API `GET /api/studies/{id}/applications/me` 의 **컨트롤러가 없다.** 신청 버튼이 이미 이 API 를 부른다. 코드로 보면 이미 신청한 사람에게도 「신청하기」가 보인다 (화면에서 직접 확인하지는 않았다) | BE 구현 — [신청 제출 PRD](../../01-planning/stories/crew-submit-application/PRD.md#개발-범위) |
| 58 | 내 스터디 (수강 목록) | FE 완료 | `/my/joined` 가 공개 스터디 목록 API 와 mock 으로 그린다. 내 스터디 API(`GET /api/me/studies`)는 이미 있다 | FE 를 `GET /api/me/studies` 로 교체 — [내 스터디 PRD](../../01-planning/stories/crew-joined-studies/PRD.md#개발-범위) |
| 107 | 백오피스 신청 결과 | FE 완료 | 신청자 탭에 **승인 · 거절 버튼**이 있고, 백엔드에 없는 `…/applications/decisions` 를 부른다. 기획에는 승인 · 거절이 없다. 응답 수 · 질문별 · 응답자별 보기는 아직 없다 | 승인 · 거절을 걷어 내고 보기 화면을 만든다 — [신청 결과 PRD](../../01-planning/stories/captain-application-results/PRD.md#개발-범위) |
| 52 · 109 · 163 | 스터디 일정 · 스터디 출석부 · 발표자 신청 | FE 빈칸 · 작업중 | 사용자 사이트 `/my/joined/[id]/schedule` 이 「준비 중」 자리만 있다. 세 이슈의 화면이 모두 여기 들어간다 | FE 를 프로토 스터디 일정대로 만든다 — [회차 등록 PRD](../../01-planning/stories/navigator-register-sessions/PRD.md#개발-범위) · [출석 수정 PRD](../../01-planning/stories/navigator-edit-attendance/PRD.md#개발-범위) · [발표자 PRD](../../01-planning/stories/crew-apply-presenter/PRD.md#개발-범위) |
| 53 | 백오피스 출석부 | FE 빈칸 · BE 완료 | 운영 콘솔 출석 탭은 mock 이다. 관리자 출석 조회 API 는 컨트롤러는 있지만 통합 테스트가 없다 | FE 를 API 에 연결 · BE 통합 테스트 — [캡틴 출석부 PRD](../../01-planning/stories/captain-view-attendance-roster/PRD.md#개발-범위) |

노션에 행이 없는 일도 있다. 다른 스쿼드 DB 에 있을 수 있어 여기서는 적어만 둔다.

- 이용약관 · 개인정보처리방침 페이지가 사용자 사이트에 없다 — [약관 PRD](../../01-planning/stories/crew-view-terms-privacy/PRD.md#개발-범위)
- 회원 탈퇴 알림에 쓸 이벤트 타입이 없다 — [탈퇴 PRD](../../01-planning/stories/crew-leave/PRD.md#개발-범위)
- 스펙에서 폐기한 `PUT /api/studies/{id}/application-form` 컨트롤러가 아직 남아 있다

## 물어볼 것

1. 위 행마다 — **노션 상태를 되돌릴지, 남은 일을 새 노션 행으로 뺄지** 담당자가 정한다
2. 노션 「4. PRD」 칸이 노션 페이지를 가리킨다. 정본은 레포 `01-planning/stories/*/PRD.md` 다. 노션 칸을 레포 링크로 바꿀지

## 영향 — 누가 무엇을 해야 하나

- **노션 이슈 담당자:** 자기 행을 위 표와 비교해 노션 상태를 맞춘다. 남은 일을 하면 PRD 개발 범위 표의 「할 일」을 「없음」으로 바꾼다
- **개발자:** 일을 고를 때 노션 상태만 믿지 말고 그 Story PRD 의 개발 범위 표를 본다. `node scripts/check-dev-scope.mjs` 로 스펙 · 컨트롤러 · PRD 가 어긋났는지 볼 수 있다
