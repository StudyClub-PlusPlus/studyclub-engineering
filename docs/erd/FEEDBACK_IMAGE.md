# FEEDBACK_IMAGE — 문의 첨부 이미지

[FEEDBACK](./FEEDBACK.md) 한 건에 붙은 이미지 한 장. 파일은 공용 업로드로 먼저 올리고(`purpose=FEEDBACK`), 제출할 때 번호로 잇는다.

> 스펙: [feedback](../../specs/feedback/spec.md) · 마이그레이션 `V51__feedback.sql`

## 컬럼

| 컬럼 | 타입 | NULL | 설명 |
|---|---|---|---|
| ID | BIGINT PK | N | |
| FEEDBACK_ID | BIGINT FK → FEEDBACK | N | `fk_feedback_image_feedback` (ON DELETE CASCADE) |
| STORAGE_OBJECT_ID | BIGINT | N | 연결한 업로드 행([STORAGE_OBJECT](./STORAGE_OBJECT.md)). ID 참조(FK 없음) |
| IMAGE_URL | VARCHAR(512) | N | 연결할 때의 공개 주소 스냅샷 (`gigs/feedbacks/<UUID>.webp` 꼴) |
| DISPLAY_ORDER | INT | N | 0부터. 제출 때 고른 순서 |
| CREATED_AT / UPDATED_AT | DATETIME(6) | N | `BaseEntity` |

## 관계

- N : 1 [FEEDBACK](./FEEDBACK.md) — 애그리거트 안이라 FK 를 건다
- 1 : 1 [STORAGE_OBJECT](./STORAGE_OBJECT.md) — ID 참조뿐

## 제약

- `UNIQUE(FEEDBACK_ID, DISPLAY_ORDER)` (`uk_feedback_image_feedback_order`). 한 건에 최대 3장 — 제출 서비스가 지킨다
- 인덱스 `idx_feedback_image_storage_object (STORAGE_OBJECT_ID)`
- 형식 PNG · JPG · WEBP, 장당 5MB — 공용 업로드 규칙 그대로
- **지금은 공개 폴더(`gigs/feedbacks/`)다.** 비공개 + 서명 URL 은 후속 ([스펙 「후속 개발」](../../specs/feedback/spec.md#후속-개발))
- **탈퇴하면 지운다** — 행은 물리 삭제, 파일은 STORAGE_OBJECT 를 `DELETING` 으로 넘겨 커밋 뒤 지운다
- **문의 보유 기간이 끝나도 지운다** — 해당 문의의 첨부 행과 문의 행을 함께 물리 삭제한다. 연결된 `FEEDBACK` 용도 파일만 같은 트랜잭션에서 `DELETING` 으로 표시하고 커밋 뒤 삭제한다. 저장소 실패는 기존 업로드 배치가 재시도한다 ([보유 기간 결정](../share/2026-10-31-feedback-retention.md))
