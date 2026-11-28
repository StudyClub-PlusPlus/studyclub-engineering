---
상태: 방향 결정 · 설계 검토 요청
물어볼 사람: 백엔드 · 프론트 · 기획
반영:
  - 01-planning/_registry/policies/POL-0012-club-cohort.md — 안 됨 (이 문서 승인 뒤)
  - specs/club-cohort/spec.md 데이터 · 스케줄러 · 출석 · 신청 절 — 안 됨 (이 문서 승인 뒤)
  - 01-planning/stories/captain-carry-over-club-members · captain-club-monthly-attendance PRD — 안 됨 (이 문서 승인 뒤)
  - playground 프로토 (클럽 기수의 스터디 상세 분기 정리) — 안 됨
---

# 클럽은 「참여 이후」를 클럽 전용 모델로 — 모집 · 신청만 스터디와 함께 쓴다

## 미리 알아야 할 것

- **스터디와 클럽.** 스터디는 정해진 시각에 모여 함께 배우는 모임이다. 한 번 모집해 한 번 진행한다.
  클럽은 각자 목표를 매일 인증하며 한 달씩 이어 가는 챌린지형 모임이다(얼리버드 · WEEKLY X · Daily LeetCode).
  정의는 [POL-0012 「클럽이란」](../../01-planning/_registry/policies/POL-0012-club-cohort.md#클럽이란)
- **프로그램(`STUDY_PROGRAM`)과 기수(`STUDY`).** 프로그램은 「얼리버드」라는 이름 자체, 기수는 「얼리버드 2027년 1월」 한 번의 운영이다.
  클럽은 한 프로그램 아래 달마다 기수가 하나씩 생긴다
- **참여자(`STUDY_PARTICIPANT`) · 회차(`STUDY_MEETING`) · 반.** 지금 시스템에서 「누가 들어왔나」 「언제 모이나」 「어느 묶음인가」를 담는 표다. 모두 스터디를 위해 만든 것이다
- **이어서 참여.** 한 달을 끝까지 한 사람이 다음 달에 따로 신청하지 않아도 계속 참여하는 규칙이다 (ST-045)

비유: 스터디는 **단과 강의**, 클럽은 **헬스장 회원권**이다. 지금 설계는 헬스장을 매달 새 강의로 열고,
지난달 회원을 이번 달 수강생 명단에 옮겨 적는 모양이다. 바꾸려는 설계는 회원 카드 한 장을 계속 쓰고,
매달 새로 하는 것은 「신규 회원 모집 공고」뿐이다.

## 한 줄 요약

클럽의 **모집 · 신청 · 공개 페이지 · 디스코드 채널**은 지금처럼 스터디와 함께 쓴다.
**들어온 뒤의 것**(멤버, 매일 인증, 한 달 결과)은 클럽 전용 표 세 개로 옮긴다.
그러면 「달마다 사람 옮겨 적기」 「가짜 회차」 「숨긴 반」이 사라진다.

## 왜 바꾸나 — 스터디 틀에 끼워 맞춰서 생긴 일

클럽 기수를 프로토로 그리며 실제로 부딪힌 것이다.

| 스터디 틀 | 클럽에서 생긴 일 |
|---|---|
| 회차(`STUDY_MEETING`) | 모임이 없는데 날마다 회차 행을 만든다. 회차 상태 판정 · 회차 알림에서 클럽만 빼야 한다 |
| 반 · 네비게이터 | 보이지 않는 기본 반 하나를 두고 화면에서 숨긴다 |
| 참여 = 기수 하나 | 달마다 사람을 다음 기수로 복사한다 — `CARRIED_FROM_ID` · 답변 스냅샷 · 「뺄 사람」 표 · 중복 신청 막기 |
| 회고 = 미팅마다 | 미팅이 없어 일일 회고를 붙일 곳이 없다 |
| 출석 4값 | WEEKLY X 의 공부 시간, LeetCode 자동 기록을 담을 칸이 없다 |
| 일정 · 요일 · 운영 종료 | 클럽만 빼는 분기가 곳곳에 생긴다 (일정 탭 · 요일 질문 · `CLOSED` · 참여 중단 취소) |

공통점이 하나 있다. **모집 · 신청은 잘 맞고, 들어온 뒤의 것이 모두 어긋난다.**

## 정해진 것 (2026-11-25, 기획)

1. 클럽의 **참여 이후는 클럽 전용 모델**로 간다
2. **모집 · 신청 · 공개 페이지는 스터디와 함께 쓴다** — 달마다 기수(`STUDY`, `COHORT_MONTH`)를 만들고 15일 자동 초안 · 20일 자동 공개도 그대로다
3. 클럽 API(`specs/club-cohort`)는 아직 구현 전이라 지금 바꾼다

## 설계 초안 — 백엔드 검토 요청

```
STUDY_PROGRAM (CLUB)   클럽 하나 + 설정 (자동 초안 · 공개 날짜, R2: 판정 단위 · 휴가 상한)
  ├─ STUDY (달마다)     모집 공고 · 신청 폼 · 공개 페이지 · 디스코드 채널 — 지금과 같다
  ├─ CLUB_MEMBER        사람의 「계속되는」 참여 한 줄
  ├─ CLUB_CHECKIN       사람 × 날짜 하나의 인증
  └─ CLUB_MONTH_RESULT  사람 × 달 하나의 결과 (달이 끝날 때 확정)
```

### 표

| 표 | 칸 (초안) | 뜻 |
|---|---|---|
| `CLUB_MEMBER` | `ID` · `PROGRAM_ID` · `ACCOUNT_ID` · `STATUS`(`ACTIVE` / `LEFT`) · `JOINED_MONTH` · `LEFT_AT` · `LEFT_REASON`(`SELF` / `CAPTAIN` / `NOT_COMPLETED`) · `LEAVE_AFTER_MONTH`(BOOLEAN) · `APPLICATION_ID` | 클럽에 들어와 있는 한 사람. 나갔다가 다시 신청하면 새 줄. 같은 클럽에 `ACTIVE` 는 한 사람 한 줄 |
| `CLUB_CHECKIN` | `ID` · `MEMBER_ID` · `DATE` · `RESULT`(`PRESENT` / `LATE` / `ABSENT` / `EXCUSED`) · `SOURCE`(`CAPTAIN` / `CREW` / `AUTO`) · `UPDATED_BY` · `UPDATED_AT` · `UNIQUE(MEMBER_ID, DATE)` | 하루 인증 한 칸. R1 은 캡틴만 쓴다(`SOURCE = CAPTAIN`) |
| `CLUB_MONTH_RESULT` | `MEMBER_ID` · `MONTH` · `RESULT`(`COMPLETED` / `WITHDRAWN`) · `RATE` · `UNIQUE(MEMBER_ID, MONTH)` | 한 달 결과. 이어짐 · 연속 완주 · 통계가 이것만 본다 |

- 날짜(`DATE`)에는 시간대가 없다. 하루를 세는 기준은 클럽 규칙 글에 적는다 (지금 결정 그대로)
- 출석률 산식 · 출석 4값은 스터디와 같다 — 분모는 「그 달 멤버였던 날 − 휴가」
- R2 에 칸을 더한다: `CLUB_CHECKIN.VALUE`(공부 시간 등) · 회고 답, `STUDY_PROGRAM` 판정 단위(날 / 주) · 한 달 휴가 상한. **R1 에 미리 만들지 않는다**

### 흐름

| 언제 | 지금 설계 | 바뀐 설계 |
|---|---|---|
| 신청 | 기수에 `STUDY_PARTICIPANT` | 같은 신청 API. 저장할 때 `CLUB_MEMBER`(`ACTIVE`, `JOINED_MONTH` = 기수 달)를 만든다 |
| 이미 멤버가 신청 | 「넘어갈 사람」을 직전 기수에서 계산해 막는다 | `ACTIVE` 멤버면 막는다 — 계산 없이 한 번 조회 |
| 날마다 | 회차 행을 날마다 만든다 | 아무것도 만들지 않는다. 출석부 열 = 그 달의 날짜 |
| 출석 입력 | 기존 출석 API + 클럽 예외(`reinstatements[]` 등) | 클럽 출석 API 하나 — `CLUB_CHECKIN` 일괄 저장 |
| 참여 중단 | `STUDY_PARTICIPANT` → `WITHDRAWN` | `CLUB_MEMBER` → `LEFT`(`SELF` / `CAPTAIN`). 되돌리기도 같은 줄 |
| 「다음 달에서 빼기」 | `CLUB_CARRY_OVER_EXCLUSION` 새 표 | `LEAVE_AFTER_MONTH = true` 한 칸 |
| 달이 끝날 때 | 기수 종료 → 다음 기수 시작일에 사람 복사(스냅샷 포함) | `CLUB_MONTH_RESULT` 확정. 완주했고 빼지 않은 사람은 **그대로 `ACTIVE`** — 복사할 것이 없다. 아니면 `LEFT`(`NOT_COMPLETED` / `CAPTAIN`) |
| 명단의 신청 답(목표 시간 등) | 스냅샷을 기수마다 복사 | `CLUB_MEMBER.APPLICATION_ID` 의 답을 읽는다 |

### 그대로 두는 것

- `STUDY.COHORT_MONTH` · `UNIQUE(PROGRAM_ID, COHORT_MONTH)` · 자동 초안 · 자동 공개 · 공개 실패 알림
- 신청 폼 · 신청 API · 신청 결과 · 질문의 `SHOW_IN_ROSTER`
- 공개 상세 페이지 · 디스코드 채널 · 캡틴 권한 · 알림

### 지금 스펙에서 없어지는 것

`STUDY_PARTICIPANT.CARRIED_FROM_ID` · 이어서 참여 답변 스냅샷 · `CLUB_CARRY_OVER_EXCLUSION` · 클럽 기수의 날마다 회차 행 ·
출석 API 의 `reinstatements[]` · 클럽용 회차 판정 · 알림 예외 · 클럽 기수의 기본 반

## 백엔드에 묻는 것

1. **위 표 세 개로 가도 되나요?** 이름 · 칸 · 제약을 고쳐 주세요
2. **참여 기록을 읽는 곳.** 「내 스터디」 목록 · 대시보드 · 디스코드 role 동기화 · 알림 받는 사람이 `STUDY_PARTICIPANT` 를 읽습니다. 클럽 멤버를 여기에 어떻게 보이게 할까요? (기획 안: 클럽은 「내 클럽」으로 따로 보이고, 디스코드 role 은 클럽 하나에 하나)
3. **운영 DB 에 이미 있는 클럽 기수 · 참여자가 있나요?** 있으면 옮기는 방법이 필요합니다
4. **1월 시행에 맞추려면** R1 범위(신청 → 멤버 → 캡틴 출석 입력 → 달 결과)만으로 일정이 되나요?

## 그래서 나는 뭘 해야 하나

- **백엔드**: 위 질문 1 ~ 4 에 답해 주세요. 확정되면 `specs/club-cohort/spec.md` 를 이 설계로 다시 씁니다
- **프론트**: 클럽 기수는 스터디 상세(운영 콘솔)가 아니라 클럽 운영 화면에서 다룹니다. 스터디 상세의 클럽 분기는 없앨 예정입니다
- **기획**: 승인되면 POL-0012 · ST-045 · ST-043 PRD 를 고칩니다. 화면은 지금 클럽 운영 프로토와 거의 같습니다
