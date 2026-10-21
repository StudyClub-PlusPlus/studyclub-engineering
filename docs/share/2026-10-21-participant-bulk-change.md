---
상태: 질문
물어볼 사람: 백엔드 (STD-03 담당) · 프론트
반영:
  - specs/study-group/spec.md 「반 · 역할 한 번에 바꾸기」 — 됨 (이 PR)
  - 01-planning/stories/captain-view-attendees/PRD.md 3-5 데이터 · 개발 범위 · API 표 — 됨 (이 PR)
  - 01-planning/stories/captain-assign-classes/PRD.md API 표 — 됨 (이 PR)
  - playground `console/studies/{id}` spec · CrewTab TODO — 됨 (이 PR)
  - docs/share/2026-10-18-discord-automation-gap.md STD-03 — 됨 (이 PR)
  - backend 일괄 변경 API — 아직 (STD-03)
---

# 신청자 탭의 반 · 역할 변경은 한 번에 저장한다 — API 도 한 사람씩이 아니라 한 번이다

## 미리 알아야 할 것

- **신청자 탭**: 백오피스 스터디 상세에서 캡틴이 크루를 반에 넣고, 네비게이터(그 반을 맡는 사람)를 고르는 화면이다.
- **API**: 화면과 서버가 정보를 주고받는 창구다. 화면이 「저장」을 누르면 API 를 불러 서버에 쓴다.
- 이 화면은 여러 명을 고친 뒤 **「저장」을 한 번 눌러 모두 반영**한다 ([PRD 3-5](../../01-planning/stories/captain-view-attendees/PRD.md)).
  한 칸마다 저장하면 여러 명을 옮기는 도중의 어중간한 편성이 남기 때문이다.

## 무엇이 맞지 않았나

화면은 「한 번에」인데, 스펙의 API 는 **한 사람 · 한 항목씩**이었다.

| | 전 (10-06 스펙) |
|---|---|
| 반 바꾸기 | `PATCH …/participants/{participantId}/group` — 한 사람 |
| 네비게이터 지정 · 해제 | `PATCH …/participants/{participantId}/role` — 한 사람 |

10명을 고치고 저장하면 화면이 API 를 10~20번 부른다. 7번째에서 실패하면 6명만 바뀐 채로 남는다.
PRD 가 피하려던 어중간한 편성이 그대로 생긴다. 디스코드 네비게이터 role 도 반만 붙는다.

비유하면, 장바구니에 10개를 담고 「결제」를 눌렀는데 6개만 결제되고 나머지는 실패한 상태다.
결제는 전부 되거나 전부 안 되어야 한다.

## 정한 것 (제안)

API 를 **하나로 합친다** — `PATCH /api/admin/studies/{studyId}/participants`.

```json
{
  "changes": [
    { "participantId": 41, "groupId": 7, "participantRole": "LEADER" },
    { "participantId": 42, "groupId": 7 }
  ]
}
```

- **전부 되거나 전부 안 된다.** 한 줄이라도 거절되면 아무것도 쓰지 않는다. 오류 메시지에 걸린 줄을 적는다
- 한 줄 안에서는 **반을 먼저 바꾸고 역할을 본다.** 「B반으로 옮기며 네비게이터로」를 한 줄로 보낼 수 있다
- **반이 없는 사람은 네비게이터로 만들지 않는다.** 네비게이터는 그 반을 맡는 사람이다. 출석 · 일정 권한도 반 단위로 판정한다
- 역할이 **실제로 바뀐 줄만** `study_participant.role_changed` 이벤트를 낸다. 디스코드 네비게이터 role(DSC-08)은 커밋 뒤 이 이벤트를 듣는다
- 한 사람씩 쓰던 두 API 는 **만들지 않는다.** 화면이 쓰지 않는 창구를 남기지 않는다

출석부 저장(`updates[]` · `withdrawals[]` — 출석 고치기와 참여 중단을 한 번에)과 같은 방식이다.

자세한 계약: [study-group 스펙 「반 · 역할 한 번에 바꾸기」](../../specs/study-group/spec.md)

## 그래서 나는 뭘 해야 하나

- **STD-03 담당 (백엔드)**: 이 스펙으로 구현해 주세요. 이미 한 사람씩 방식으로 시작했다면 알려 주세요 — 맞춰 조정합니다
- **프론트 (신청자 탭)**: 「저장」은 바뀐 줄만 모아 한 번 부릅니다. 실패하면 화면의 저장 전 변경을 그대로 두고 오류 줄을 짚어 줍니다
- **기획**: 「반 없는 네비게이터 금지」가 맞는지 확인해 주세요
