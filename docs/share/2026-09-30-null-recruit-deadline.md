---
상태: 결정됨
결정일: 2026-10-01
근거: 스터디 등록·수정·목록 PRD, 스터디 API 스펙, ERD
---

# 모집 마감 시각은 필수다

## 미리 알아야 할 것

모집 회차의 `RECRUIT_DEADLINE_AT`은 현재 데이터베이스에서 비어 있을 수 있지만, 최신 기획은 상시 모집을 폐지하고 모집 마감일을 필수로 정했다.

## 한 줄 요약

`RECRUIT_DEADLINE_AT=null`은 상시 모집이 아니라 보정해야 할 옛 데이터다. 신청 API는 이런 모집을 열림으로 취급하지 않는다.

## 근거

- 스터디 등록 PRD: 모집 마감일 필수, 상시 모집 없음
- 스터디 수정 PRD: `recruitDeadline`은 null 불가
- 스터디 목록 PRD: 마감일 없는 값은 옛 데이터
- `specs/study/spec.md`: 상시 모집 폐지
- `docs/erd/STUDY_RECRUITMENT.md`: `RECRUIT_DEADLINE_AT`은 NOT NULL

## 영향

- 신청 가능 조회는 마감 시각이 미래인 모집만 반환한다.
- 기존 null 데이터를 보정한 뒤 `RECRUIT_DEADLINE_AT`을 다시 NOT NULL로 바꾸는 마이그레이션이 필요하다.
