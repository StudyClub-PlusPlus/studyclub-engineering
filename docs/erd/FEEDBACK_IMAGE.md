# FEEDBACK_IMAGE — 문의 첨부 이미지

[FEEDBACK](./FEEDBACK.md) 한 건에 붙은 이미지 한 장. 파일은 공용 업로드로 먼저 올리고(`purpose=FEEDBACK`), 제출할 때 번호로 잇는다.

> 스펙: [feedback](../../specs/feedback/spec.md) · 마이그레이션 `V51__feedback.sql` · `V62__drop_feedback_image_url.sql`(공개 주소 컬럼 `IMAGE_URL` 삭제)

## 컬럼

| 컬럼 | 타입 | NULL | 설명 |
|---|---|---|---|
| ID | BIGINT PK | N | |
| FEEDBACK_ID | BIGINT FK → FEEDBACK | N | `fk_feedback_image_feedback` (ON DELETE CASCADE) |
| STORAGE_OBJECT_ID | BIGINT | N | 연결한 업로드 행([STORAGE_OBJECT](./STORAGE_OBJECT.md)). ID 참조(FK 없음) |
| DISPLAY_ORDER | INT | N | 0부터. 제출 때 고른 순서 |
| CREATED_AT / UPDATED_AT | DATETIME(6) | N | `BaseEntity` |

## 관계

- N : 1 [FEEDBACK](./FEEDBACK.md) — 애그리거트 안이라 FK 를 건다
- 1 : 1 [STORAGE_OBJECT](./STORAGE_OBJECT.md) — ID 참조뿐

## 제약

- `UNIQUE(FEEDBACK_ID, DISPLAY_ORDER)` (`uk_feedback_image_feedback_order`). 한 건에 최대 3장 — 제출 서비스가 지킨다
- 인덱스 `idx_feedback_image_storage_object (STORAGE_OBJECT_ID)`
- 형식 PNG · JPG · WEBP, 장당 5MB — 공용 업로드 규칙 그대로
- **파일은 비공개 폴더(`private/feedbacks/<UUID>.<확장자>`)에 있다.** 공개 주소를 저장하지 않고, 작성자 · 캡틴만 서버가 권한을 확인한 뒤 읽어 준다 ([스펙 「첨부 이미지 열기」](../../specs/feedback/spec.md#첨부-이미지-열기)). 이전(2026-11-21 전)에 올라간 파일은 `gigs/feedbacks/` 공개 폴더에 남아 있다
- **탈퇴하면 지운다** — 행은 물리 삭제, 파일은 STORAGE_OBJECT 를 `DELETING` 으로 넘겨 커밋 뒤 지운다
- **문의 보유 기간이 끝나도 지운다** — 해당 문의의 첨부 행과 문의 행을 함께 물리 삭제한다. 연결된 `FEEDBACK` 용도 파일만 같은 트랜잭션에서 `DELETING` 으로 표시하고 커밋 뒤 삭제한다. 저장소 실패는 기존 업로드 배치가 재시도한다 ([보유 기간 결정](../share/2026-10-31-feedback-retention.md))
