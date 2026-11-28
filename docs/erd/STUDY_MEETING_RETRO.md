# STUDY_MEETING_RETRO — 미팅 회고

회차(STUDY_MEETING) × 참여자 한 줄. 미팅이 끝난 뒤 참여자가 좋았던 점·개선할 점·소감을 남긴다.
회고는 기한(다음 정규 회차 시작, 마지막 회차는 종료+7일) 안에 쓰고 고칠 수 있다. 삭제는 없다.

## 컬럼

| 컬럼 | 타입 | NULL | 설명 |
|---|---|---|---|
| ID | BIGINT PK | N | |
| MEETING_ID | BIGINT | N | → STUDY_MEETING (FK 없음 — 다른 애그리거트) |
| PARTICIPANT_ID | BIGINT | N | → STUDY_PARTICIPANT (FK 없음 — 다른 애그리거트). 회차 × 참여자 유일 |
| GOOD | VARCHAR(500) | N | 좋았던 점. 앞뒤 공백 제거 뒤 1~500자 |
| IMPROVE | VARCHAR(500) | N | 개선할 점. 앞뒤 공백 제거 뒤 1~500자 |
| FEELING | VARCHAR(500) | N | 소감(선택). 빈 문자열 = 남기지 않음. 0~500자 |
| CREATED_AT | DATETIME(6) | N | 처음 작성 시각 |
| UPDATED_AT | DATETIME(6) | N | 마지막 수정 시각. 화면에 작성일로 보인다 |

## 관계

- N : 1 [STUDY_MEETING](./STUDY_MEETING.md) (FK 없음)
- N : 1 [STUDY_PARTICIPANT](./STUDY_PARTICIPANT.md) (FK 없음)
- 1 : N [STUDY_MEETING_RETRO_LIKE](./STUDY_MEETING_RETRO_LIKE.md)

## 상태

없음. 쓰기 가능 여부(기한 판정)는 서버 서비스에서 계산한다 — 저장하지 않는다.

## 제약

- `UNIQUE(MEETING_ID, PARTICIPANT_ID)` — 한 회차에 한 사람의 회고는 하나
- 인덱스 `(MEETING_ID)` — 회차별 회고 목록 조회
