# UPLOAD — 올린 파일의 주인·용도·위치·상태

이미지 업로드 기록. 파일은 S3 에 있고, 이 테이블은 「누가 어떤 용도로 어디에 올렸고 지금 쓰이고 있나」 만 안다. 사진 주소 자체는 기능 쪽 칼럼(`ACCOUNT.PROFILE_IMG_URL`, `STUDY.THUMBNAIL_URL`)에 적는다.

> 스펙: [profile-image](../../specs/profile-image/spec.md)

## 컬럼

| 컬럼 | 타입 | NULL | 설명 |
|---|---|---|---|
| ID | BIGINT PK | N | 업로드 번호. 저장 API 가 이 번호를 받아 연결한다 |
| ACCOUNT_ID | BIGINT | N | 올린 사람. ID 참조([ACCOUNT](./ACCOUNT.md), FK 없음). 연결할 때 「올린 사람 = 요청한 사람」 확인에 쓴다 |
| PURPOSE | VARCHAR(20) | N | `PROFILE` / `STUDY_THUMBNAIL`. S3 폴더를 정하고, 연결할 때 칸과 맞는지 본다 |
| S3_KEY | VARCHAR(512) UK | N | S3 안의 위치. `gigs/profiles/<UUID>.webp` 꼴. 교체·지우기가 주소에서 키를 뽑아 이 행을 찾는다 |
| CONTENT_TYPE | VARCHAR(40) | N | 판정한 형식. `image/jpeg` / `image/png` / `image/webp` |
| SIZE | BIGINT | N | 메타데이터를 지운 뒤 저장한 바이트 수 |
| STATUS | VARCHAR(20) | N | `PENDING` / `ATTACHED` / `DELETING` |
| ATTACHED_AT | DATETIME(6) | Y | 연결 시각. `PENDING` 이면 NULL |
| CREATED_AT / UPDATED_AT | DATETIME(6) | N | `BaseEntity`. `CREATED_AT` 이 「하루 지난 PENDING」 판정 기준 |

## 관계

- N : 1 [ACCOUNT](./ACCOUNT.md), ID 참조뿐 FK 는 없다(애그리거트 간 참조 — database-guide.md 외래키 정책). 탈퇴 시 그 계정의 `ATTACHED`·`PENDING` 행을 `DELETING` 으로 넘기고 커밋 뒤 지운다.
- 기능 쪽 테이블과는 잇지 않는다. `ACCOUNT.PROFILE_IMG_URL`·`STUDY.THUMBNAIL_URL` 에 적힌 주소에서 키를 뽑아 `S3_KEY` 로 찾는다.

## 상태 — STATUS

```mermaid
stateDiagram-v2
    [*] --> PENDING : 올리기 (S3 에 있음)
    PENDING --> ATTACHED : 저장 API 가 연결
    PENDING --> DELETING : 24시간 지나도 연결 없음 (정리 배치가 찜)
    ATTACHED --> DELETING : 사진 교체 · 지우기 · 탈퇴 (커밋 안에서)
    DELETING --> [*] : S3 파일 삭제 → 행 삭제
```

상태를 바꾸는 쿼리는 전부 지금 상태를 조건에 건 UPDATE 다. 연결은 `STATUS='PENDING'` 일 때만, 정리 배치의 찜하기도 `STATUS='PENDING'` 일 때만 바뀐다. 그래서 배치와 연결이 같은 행을 동시에 잡아도 한쪽만 이긴다.

## 제약

- 인덱스 `idx_upload_status_created (STATUS, CREATED_AT)` — 정리 배치가 하루 지난 `PENDING` 을 찜할 때. `idx_upload_account_status (ACCOUNT_ID, STATUS)` — 올리기 전 그 계정의 `PENDING` 수(상한 20)를 셀 때.
- `S3_KEY` UNIQUE — 키는 UUID 라 겹칠 일이 없지만, 주소 → 행 조회가 하나만 돌아오게 보장한다.
- 물리 삭제한다. 파일이 S3 에서 사라지면 행이 남아 있을 이유가 없다. `DELETING` 은 「지우는 중」 표시이지 보존 상태가 아니다.
