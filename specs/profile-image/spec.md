# 프로필 사진 · 이미지 업로드 Spec

> ERD: [STORAGE_OBJECT](../../docs/erd/STORAGE_OBJECT.md) · [ACCOUNT](../../docs/erd/ACCOUNT.md)
> Story PRD: [crew-edit-profile](../../01-planning/stories/crew-edit-profile/PRD.md) · 썸네일은 [study-create](../../01-planning/stories/study-create/PRD.md)
> 관련 스펙: [profile-edit](../profile-edit/spec.md) — 같은 카드 · [user-leave](../user-leave/spec.md) — 탈퇴 시 파일 삭제
> 저장소: [docs/s3-storage.md](../../docs/s3-storage.md) — 버킷·CloudFront·폴더 규칙
> 생성일: 2026-10-08
> 상태: 구현완료

## WHAT

마이페이지 내 정보 카드에 프로필 사진을 올리고 지운다. 사진은 오브젝트 스토리지(지금은 AWS S3)에 두고 주소를 `ACCOUNT.PROFILE_IMG_URL` 에 적는다.

올리기는 **공용 업로드 API** 하나로 받는다. 파일을 먼저 올려 업로드 번호를 받고(`PENDING`), 기능 쪽 저장 API 가 그 번호를 받아 연결한다(`ATTACHED`). 연결 안 된 파일은 정리 배치가 하루 뒤 지운다. 스터디 썸네일처럼 저장 대상이 아직 없는 상태에서 올려야 하는 기능도 같은 API 를 쓴다.

새로 만드는 건 **업로드 API 하나, `STORAGE_OBJECT` 테이블 하나, 프로필 연결·삭제 API 둘, 정리 배치 하나**다.

## 엔드포인트 목록

| Method | Path | 설명 | 인증 | 상태 |
|--------|------|------|------|------|
| POST | `/api/uploads/images` | 이미지 올리기 → 파일 번호 | O + 온보딩 | 구현완료 |
| PUT | `/api/me/profile-image` | 파일 번호를 프로필에 연결 (교체 포함) | O + 온보딩 | 구현완료 |
| DELETE | `/api/me/profile-image` | 프로필 사진 지우기 | O + 온보딩 | 구현완료 |

정리 배치는 API 가 아니다 — [정리 배치](#정리-배치).

## 공통 사항

- **accountId**: JWT 토큰에서 꺼낸다. 요청에 계정 번호를 따로 받지 않는다.
- **온보딩**: 셋 다 `@RequireOnboarding`. 미완료면 `403 ONBOARDING_REQUIRED`.
- **500**: 예기치 않은 서버 오류는 `500 INTERNAL_ERROR`.
- **S3 호출은 트랜잭션 밖**에서 한다. 외부 네트워크를 기다리는 동안 DB 잠금을 잡지 않는다.

## 결정

### 1. 올리기와 연결을 나눈다

스터디 등록 폼은 "파일을 고르면 바로 미리보기, 등록을 눌러야 스터디가 생긴다" 라서 올리는 시점에 붙일 대상이 없다. 그래서 올리기 API 는 대상 없이 부를 수 있어야 하고, 연결은 기능 쪽 저장 API 가 번호를 받아서 한다. 프로필도 같은 길을 쓴다 — 방식이 하나여야 교체·삭제·탈퇴 정리가 한 길로 간다.

```
① POST /api/uploads/images (file, purpose)  → 201 { fileId, url }     STORAGE_OBJECT 행 PENDING
② PUT /api/me/profile-image { fileId }      → 200 AccountView          PENDING → ATTACHED, PROFILE_IMG_URL 갱신
```

프로필은 프론트가 ① 성공 직후 ② 를 바로 부른다. 사용자에게는 한 동작이다. 썸네일은 ② 가 스터디 등록·수정 API 다 — 이 스펙 범위 밖, [알려진 한계](#알려진-한계).

### 2. 연결은 조건부 UPDATE 한 문장

주인·용도·상태 확인을 조회하고 나서 바꾸는 두 단계로 하지 않는다. 조건을 UPDATE 에 걸고 바뀐 행 수로 판단한다.

```sql
UPDATE STORAGE_OBJECT
SET STATUS = 'ATTACHED', ATTACHED_AT = now
WHERE ID = ?               -- 이 번호가
  AND ACCOUNT_ID = ?       -- 내 것이고
  AND PURPOSE = ?          -- 용도가 맞고
  AND STATUS = 'PENDING'   -- 아직 연결 안 됐을 때만
```

- 0 행이면 `400 INVALID_INPUT` — 「업로드한 사진을 찾을 수 없습니다. 다시 올려 주세요.」 번호가 없든, 남의 것이든, 용도가 다르든, 이미 연결됐든, 만료됐든 같은 답이다. 사유를 구분하지 않는 건 정보 유출 방지다 — 어떤 번호가 존재하는지 응답으로 알 수 없게 한다.
- 저장 API 는 URL 문자열을 받지 않는다. 번호만 받는다. 문자열을 받으면 외부 이미지·추적 픽셀을 꽂을 수 있다.

### 3. 정리 배치 — 먼저 `DELETING` 으로 찜하고 나서 지운다

한 시간마다 돈다. 알림 모듈의 폴링 스케줄러(`@Scheduled` + 행 선점)와 같은 방식.

```sql
-- 1단계 찜하기
UPDATE STORAGE_OBJECT
SET STATUS = 'DELETING'
WHERE STATUS = 'PENDING'              -- 아직 연결 안 됐고
  AND CREATED_AT < now - 24시간        -- 올린 지 하루가 지난 것만
```

2단계는 `DELETING` 행을 전부 읽어 하나씩 S3 파일 삭제 → 행 삭제. 교체·지우기·탈퇴가 남긴 `DELETING` 도 같이 치운다. 한 건이 실패해도 나머지는 계속 가고, 실패한 건 `DELETING` 그대로 남아 다음 시간에 다시 시도한다.

찜하기를 먼저 하는 이유는 연결과의 경쟁이다. 배치가 먼저 `DELETING` 으로 바꾸면 그 뒤에 온 연결은 `STATUS='PENDING'` 조건에 안 맞아 400, 연결이 먼저였으면 찜하기 조건에 안 맞아 배치가 건너뛴다. 어느 순서든 한쪽만 이긴다. 서버 두 대가 2단계에서 같은 행을 집어도 S3 는 없는 키를 지워도 성공이라 괜찮다.

### 4. 교체는 새 키 · 옛 파일은 커밋 뒤 삭제

- 올릴 때마다 새 UUID 키다. 같은 키에 덮어쓰면 CloudFront 가 복사본을 들고 있다가 옛 사진을 최대 하루 계속 준다.
- 연결 트랜잭션 안: 계정 행 잠금 → 새 업로드 조건부 UPDATE(0 행이면 400, 롤백) → 옛 주소가 우리 것이면 옛 `STORAGE_OBJECT` 행을 `DELETING` → `PROFILE_IMG_URL` 갱신 → 커밋.
- 커밋 뒤: 옛 파일 S3 삭제 → 행 삭제. 실패해도 응답은 성공이고, 행이 `DELETING` 으로 남아 배치가 다시 지운다.
- 옛 주소가 구글 사진(`https://lh3.googleusercontent.com/...`)이거나 `null` 이면 우리 S3 에 없다. DB 값만 바꾼다.
- 지우기도 같다. `PROFILE_IMG_URL` 을 null 로, 우리 파일이면 `DELETING`, 커밋 뒤 삭제. 구글 사진으로 되돌리지 않는다.

### 5. 저장 전에 메타데이터를 지운다

폰 사진의 EXIF 에는 촬영 위치(GPS)·시각·기기 모델이 들어 있다. `gigs/` 는 공개 폴더라 그대로 저장하면 주소만 알면 위치까지 읽힌다. 픽셀은 건드리지 않고 메타데이터 부분만 걷어낸다 — 재압축이 없어 화질이 그대로고 라이브러리도 필요 없다.

| 형식 | 지우는 부분 | 남기는 부분 |
|---|---|---|
| jpeg | `APP0` · ICC 색 프로필(`APP2`) · `APP14` 를 뺀 모든 `APPn` 세그먼트, `COM`, `EOI` 뒤에 붙은 데이터 | `APP0`(JFIF) · `APP2` 중 ICC 색 프로필 · `APP14`(Adobe 색변환) · 디코딩 테이블(DQT · DHT · SOF · DRI) · 압축 데이터. EXIF 의 회전 값(Orientation)은 그 값 하나만 든 `APP1` 로 다시 쓴다 |
| png | 아래 목록에 없는 청크 전부 (`eXIf` · 텍스트 · `tIME` · C2PA `caBX` 같은 제조사 전용 포함) | 필수(`IHDR` `PLTE` `IDAT` `IEND`) · 색(`iCCP` `sRGB` `gAMA` `cHRM` `cICP` `mDCV` `cLLI` `sBIT`) · 투명도·배경(`tRNS` `bKGD` `hIST` `sPLT`) · `pHYs` · 애니메이션(`acTL` `fcTL` `fdAT`) |
| webp | 아래 목록에 없는 청크 전부 (`EXIF` · `XMP ` 포함). `VP8X` 의 EXIF·XMP 비트를 끄고 `RIFF` 길이를 다시 쓴다 | `VP8 ` · `VP8L` · `VP8X` · `ALPH` · `ANIM` · `ANMF` · `ICCP` |

세 형식 모두 지우는 목록이 아니라 남기는 목록이다. 갤럭시는 EXIF 밖에도 메타데이터를 넣는다 — `APP4` 에 센서 고유 ID와 보정값, `EOI` 뒤 꼬리에 촬영 시각(`Image_UTC_Data`)과 이동통신 국가코드(`MCC_Data`). 갤럭시 S25+ 실사진으로 확인했다. 남기는 목록으로 하면 제조사가 새 자리를 만들어도 빠진다.

걷어낸 결과가 깨져 있으면 `400` 「이미지를 읽을 수 없습니다.」 — 깨진 채로 저장하지 않는다.

### 6. 서버 경유 · 5MB · 형식은 파일 내용으로

- 브라우저 → 서버 → S3. 서명 주소(브라우저 → S3 직접)는 쓰지 않는다. 형식 검사와 메타데이터 제거를 서버가 해야 한다.
- jpeg · png · webp, 5MB. 형식은 맨 앞 바이트(jpeg `FF D8 FF`, png `89 50 4E 47`, webp `RIFF`+`WEBP`)로 판단한다. 확장자와 브라우저가 보낸 `Content-Type` 은 믿지 않는다. 저장 확장자도 판정 결과로.
- 서버가 메모리에 통째로 받으므로 `spring.servlet.multipart.max-file-size=5MB`, `max-request-size=6MB`. 넘치면 `400 INVALID_INPUT`. Tomcat `max-swallow-size` 도 6MB — 거부한 요청의 남은 본문을 끝까지 읽어야 브라우저가 400 응답을 받는다. 기본값(2MB)이면 연결을 끊어 네트워크 오류로 보인다.
- S3 에 넣을 때 `Content-Type` 은 판정한 형식, `Cache-Control: public, max-age=86400`.
- 키는 `gigs/<용도 폴더>/<UUID>.<확장자>`, 주소는 `<S3_PUBLIC_BASE_URL>/<키>`. `gigs/` 는 S3 문서가 공개 파일 폴더로 정한 곳이다.

### 7. 용도(purpose)와 상한

- `purpose` 는 `PROFILE` · `STUDY_THUMBNAIL`. 폴더(`gigs/profiles/` · `gigs/thumbnails/`)를 정하고, 연결할 때 칸과 맞는지 본다. 프로필용으로 올린 파일을 썸네일에 꽂지 못한다.
- 연결 안 한(`PENDING`) 파일이 계정에 20개면 `400`. 연결 안 하고 계속 올리는 남용 방지. 배치가 돌면 다시 올릴 수 있다.

### 8. 연결은 `PATCH /api/me` 에 넣지 않는다

그 API 는 닉네임·시간대 둘 다 필수에 부분 갱신이 없다. 사진은 저장 버튼 없이 고른 즉시 반영되는 별도 동작이라 따로 둔다.

### 9. S3 설정이 없으면 503, 서버는 뜬다

로컬처럼 키가 없는 환경에서 올리기는 `503 EXTERNAL_SERVICE_ERROR`. S3 호출 실패도 같은 503. 정리 배치는 설정이 없으면 아무것도 안 한다.

### 10. 모델은 S3 에 묶지 않는다

테이블은 「올린 파일」(`STORAGE_OBJECT`)이지 「올리기 행위」가 아니다. 행마다 `PROVIDER`(`S3` / `R2`)와 `OBJECT_KEY` 를 적는다. 지금은 `S3` 만 쓰지만 저장·삭제가 행의 `PROVIDER` 로 구현을 고르므로, 다른 오브젝트 스토리지로 옮길 때 코드가 아니라 행이 바뀐다. 버킷·CloudFront·환경변수는 S3 구현의 것이라 그대로 S3 이름이다. 이 문서에서 S3 라고 쓴 곳은 지금 구현을 말한다.

## 이미지 올리기

### 기본 정보

- **Method**: POST
- **Path**: `/api/uploads/images`
- **인증**: 필요 + 온보딩 완료
- **설명**: 이미지를 올려 두고 파일 번호를 받는다. 어디에 쓸지는 아직 정하지 않아도 된다

### Request — `multipart/form-data`

| 파트 | 타입 | 필수 | 제약 | 설명 |
|------|------|------|------|------|
| file | 파일 | Y | jpeg · png · webp, 5MB 이하 | |
| purpose | String | Y | `PROFILE` · `STUDY_THUMBNAIL` | 폴더와 연결 가능한 칸을 정한다 |

### Response — 201

```json
{
  "fileId": 32,
  "url": "https://d27gz6v6wvae1d.cloudfront.net/studyclub/gigs/profiles/3f2a9c1e-7b4d-4e8a-9c2f-1a5b6d7e8f90.webp"
}
```

| 필드 | 타입 | NULL | 설명 | 소스 |
|------|------|------|------|------|
| fileId | Long | N | 파일 번호. 저장 API 에 넘긴다 | STORAGE_OBJECT.ID |
| url | String | N | 볼 수 있는 주소. 연결 전에도 주소만 알면 보인다. 미리보기용 | `S3_PUBLIC_BASE_URL` + STORAGE_OBJECT.OBJECT_KEY |

### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 400 | INVALID_INPUT | `file` 없음 · 빈 파일 · jpeg/png/webp 아님 · 5MB 초과 · 구조가 깨짐 · `purpose` 없음·모르는 값 · `PENDING` 20개 |
| 401 | UNAUTHORIZED | 토큰 없음 · 만료 |
| 403 | ONBOARDING_REQUIRED | 온보딩 미완료 |
| 503 | EXTERNAL_SERVICE_ERROR | S3 설정 없음 · S3 에 못 올림 |

400 `errorMessage`: 형식 `jpeg, png, webp 파일만 올릴 수 있습니다.` · 크기 `5MB 이하 파일만 올릴 수 있습니다.` · 빈 파일 `파일이 비어 있습니다.` · 깨짐 `이미지를 읽을 수 없습니다.` · 용도 `용도가 올바르지 않습니다.` · 상한 `올린 뒤 쓰지 않은 사진이 너무 많습니다. 잠시 후 다시 시도해 주세요.`

### 프론트엔드 사용처

- core-front `ProfileCard` 사진 바꾸기 — `FormData` 에 `file`·`purpose='PROFILE'`. `Content-Type` 헤더는 직접 넣지 않는다(브라우저가 붙인다)
- 스터디 등록 폼 썸네일 — `purpose='STUDY_THUMBNAIL'`, 후속

## 프로필 사진 연결

### 기본 정보

- **Method**: PUT
- **Path**: `/api/me/profile-image`
- **인증**: 필요 + 온보딩 완료
- **설명**: 올려 둔 사진을 내 프로필에 연결한다. 이미 있으면 바꾼다

### Request Body

```json
{ "fileId": 32 }
```

| 필드 | 타입 | 필수 | 제약 | 설명 |
|------|------|------|------|------|
| fileId | Long | Y | 내가 올린 것, `purpose=PROFILE`, `PENDING` | `POST /api/uploads/images` 가 돌려준 번호 |

### Response — 200

`AccountView` — `GET /auth/me` 와 같은 모양. `picture` 에 새 주소. 프론트는 이 응답으로 세션 user 를 바꾸고 다시 조회하지 않는다.

### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 400 | INVALID_INPUT | `fileId` 없음 · 조건부 UPDATE 0 행 (번호 없음 · 남의 것 · 용도 다름 · 이미 연결 · 만료). 전부 `업로드한 사진을 찾을 수 없습니다. 다시 올려 주세요.` |
| 401 | UNAUTHORIZED | 토큰 없음 · 만료 |
| 403 | ONBOARDING_REQUIRED | 온보딩 미완료 |

S3 호출이 없는 API 라 503 이 없다. 옛 파일 삭제는 커밋 뒤라 응답에 영향이 없다.

### 프론트엔드 사용처

- core-front `ProfileCard` — 올리기 201 직후 호출. 올리기부터 연결까지 사진 버튼 둘 다 잠근다. 연결이 실패하면 사유만 보여준다(올린 파일은 하루 뒤 서버가 지운다)

## 프로필 사진 지우기

### 기본 정보

- **Method**: DELETE
- **Path**: `/api/me/profile-image`
- **인증**: 필요 + 온보딩 완료
- **설명**: 내 프로필 사진을 지운다

### Response — 200

`AccountView`. `picture` 는 `null`. 사진이 원래 없어도 200. `204` 가 아닌 이유는 프론트가 연결과 똑같이 세션을 바꾸게 하려고.

### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 401 | UNAUTHORIZED | 토큰 없음 · 만료 |
| 403 | ONBOARDING_REQUIRED | 온보딩 미완료 |

### 프론트엔드 사용처

- core-front `ProfileCard` 지우기 — 확인 창 없음. 지운 사진은 캐시가 살아 있는 동안(최대 1일) 옛 주소로 보일 수 있지만 응답이 `picture: null` 이라 우리 화면에선 즉시 사라진다

## 정리 배치

- `api` 모듈 `upload` 패키지에 스케줄러 하나. `NotificationPollingScheduler` 와 같은 모양 — `@Scheduled(fixedDelayString)`, 찜하기 → 읽기 → 건별 처리, 건별 실패는 로그만.
- 주기 1시간, 보관 24시간, `PENDING` 상한 20 은 설정값(기본값 적음). 테스트에서 줄여 쓴다.
- 서버 다중 실행은 막지 않는다. 찜하기가 조건부 UPDATE 라 같은 행을 두 번 찜하지 못하고, 2단계는 두 번 해도 결과가 같다.

## 스키마 변경

`STORAGE_OBJECT` 테이블 신설, Flyway 마이그레이션 1개(`domain` 모듈 다음 번호). 컬럼·인덱스·상태 전이는 [ERD STORAGE_OBJECT](../../docs/erd/STORAGE_OBJECT.md).

| 컬럼 | 뜻 |
|---|---|
| ID | 파일 번호 |
| ACCOUNT_ID | 올린 사람. FK 없음(애그리거트 간 참조) |
| PURPOSE | `PROFILE` · `STUDY_THUMBNAIL` |
| PROVIDER · OBJECT_KEY | 어디에. `S3` · `R2`, 지금은 `S3` 만. `OBJECT_KEY` UNIQUE |
| CONTENT_TYPE · SIZE | 무엇이 |
| STATUS | `PENDING` · `ATTACHED` · `DELETING` |
| ATTACHED_AT · CREATED_AT · UPDATED_AT | 시각 |

기능 쪽 칼럼(`ACCOUNT.PROFILE_IMG_URL`, `STUDY.THUMBNAIL_URL`)은 그대로 주소를 담는다. 화면·응답은 지금처럼 주소를 읽는다. `ErrorCode` 추가 없음.

## 백엔드 구현 지점

- `domain`: `StorageObject` 엔티티 + 리포지토리의 조건부 UPDATE 셋(연결 · 찜하기 · `ATTACHED`→`DELETING`). `@Modifying` 으로 바뀐 행 수를 돌려준다.
- `api/upload`: 컨트롤러(`POST /api/uploads/images`), 서비스(올리기 · 연결 · 버리기 · 커밋 뒤 삭제), 스케줄러. 올리기에서 `STORAGE_OBJECT` INSERT 가 실패하면 방금 올린 S3 파일을 지운다 — 행이 없으면 배치도 못 찾는다.
- `api/storage`: 저장소 인터페이스 하나(올리기 · 지우기 · 키↔주소)와 S3 구현 하나. 올리기는 설정된 `PROVIDER` 로, 지우기는 행의 `PROVIDER` 로 구현을 고른다. S3 구현은 SES 클라이언트와 같은 방식, AWS SDK v2 `s3`.
- 형식 판정 · 메타데이터 제거 헬퍼 둘. 라이브러리 없음.
- `AccountProfileController`/`Service` 에 연결·지우기. 커밋 뒤 삭제는 `TransactionSynchronization.afterCommit`.
- `GlobalExceptionHandler` 에 `MaxUploadSizeExceededException` → 400 한 줄.
- 설정: `AWS_REGION` · `S3_BUCKET` · `AWS_ACCESS_KEY_ID` · `AWS_SECRET_ACCESS_KEY` · `S3_PUBLIC_BASE_URL`(예 `https://d27gz6v6wvae1d.cloudfront.net/studyclub`). `.env.example` 에 이름만.
- 문서: `endpoint-convention.md` 세 줄, `docs/s3-storage.md` 에 `S3_PUBLIC_BASE_URL` 한 줄.

## 프론트 (core-front)

- `ProfileCard` 위쪽에 사진 영역. 둥근 사진, 없으면 닉네임 첫 글자. "사진 바꾸기" · "지우기". 프로토에 없어 위치·문구는 임시.
- 숨긴 `<input type="file" accept="image/jpeg,image/png,image/webp">`. 고른 직후 크기·`file.type` 을 보고 안 맞으면 서버에 안 보낸다.
- 올리기 → 연결 두 호출을 `features/profile/queries.ts` mutation 으로. 올리기 mutation 은 `purpose` 를 인자로 받아 썸네일 폼에서도 쓴다.
- 성공 응답 `AccountView` 로 `setUser`. 헤더의 `user.picture` 가 그대로 바뀐다.
- 잠금: 올리기~연결, 지우기 중 사진 버튼 둘 다. 닉네임 저장 중(`saving`)에도 — 두 응답이 세션을 번갈아 쓰면 한쪽이 덮인다.
- 오류: 400·503 은 서버 사유를 사진 아래 한 줄, 401 은 재로그인, 403 은 온보딩으로.

## 테스트

S3 클라이언트를 가짜로 바꾼 통합 테스트.

- 올리기: 성공 201 · 이름만 `.jpg` 인 텍스트 · 빈 파일 · 깨진 구조 · `purpose` 없음 · `PENDING` 상한 → 400 · 설정 없음 → 503. 5MB 초과는 테스트 클라이언트가 응답 전에 연결이 끊겨 통합 테스트로 못 잡는다 — 로컬 서버에 curl 로 확인한다
- 연결: 성공(`ATTACHED`, `PROFILE_IMG_URL`) · 남의 번호 · 썸네일용 번호 · 같은 번호 두 번 → 400
- 교체: 옛 행 `DELETING` → 커밋 뒤 S3 삭제·행 삭제. 옛 주소가 구글이면 안 지움. S3 삭제 실패 시 `DELETING` 으로 남음
- 지우기: `picture` null · 사진 없을 때 200
- 배치: 24시간 지난 `PENDING` 과 남은 `DELETING` 을 지우고 `ATTACHED` 는 안 건드림 · 찜한 행에 연결 → 400
- 메타데이터: GPS 든 jpeg · `eXIf` png · `EXIF` webp → S3 에 넘어간 바이트에 없음. jpeg 는 `APP4` · `COM` · `EOI` 뒤 꼬리도 빠지고 `APP0` · ICC · `APP14` 는 남음. S3 요청 `Content-Type` 이 판정한 형식

## 미확정

- **운영 인그레스의 요청 크기 제한.** 5MB 요청이 통과하는지 인프라 확인. 막혀 있으면 그쪽을 올리거나 우리 상한을 내린다.
- **사진 영역 위치와 문구.** 프로토에 없다. 기획 수정본이 나오면 맞춘다.
- **개인정보 처리방침 개정이 기능을 켜기 전에 필요하다.** 수집항목(제2조)·수탁(제7조, AWS)·보유기간(제4조) — 시행 전 공지. 할 일은 [legal-placeholders](../../docs/legal/legal-placeholders.md#도입-예정-서비스와-그때-해야-할-개정). 특히 CloudFront 해외 엣지 사본이 국외 이전에 해당하는지.
- **지운 사진이 캐시에 남는 시간.** 기본 1일(`max-age=86400`). 줄이려면 지울 때·탈퇴할 때 CloudFront 무효화 — 배포 ID 환경변수와 권한이 더 필요하다.
- **보관 24시간 · 상한 20개.** 제안값. 설정값이라 코드 수정 없이 바꾼다.

## 알려진 한계

- **스터디 썸네일** — 올리기는 `purpose=STUDY_THUMBNAIL` 로 이 API 를 그대로 쓴다. 스터디 등록·수정 API 가 `thumbnailFileId` 를 받아 결정 2 의 연결 규칙을 타는 변경과, 썸네일 교체·스터디 삭제 시 옛 파일을 `DELETING` 으로 넘기는 것은 스터디 스펙에서.
- **연결 전 파일도 주소만 알면 보인다** — `gigs/` 는 공개 폴더다. 주소가 UUID 라 추측은 못 하고, 하루 뒤 지워진다.
- **크기 줄이기 · 자르기 없음** — 원본이 그대로 내려간다. 필요해지면 서버에서 줄이거나 CloudFront 쪽에서 변환한다.
- **탈퇴** — 탈퇴 스펙이 `PROFILE_IMG_URL` 의 파일과 그 계정의 `PENDING` 파일을 `DELETING` 으로 넘기고 커밋 뒤 지운다.

## 변경이력

| 날짜 | 변경 | 근거 |
|------|------|------|
| 2026-10-16 | jpeg 회전 값(Orientation)만 남기기 · png·webp 도 남기는 목록 방식 · 옛 파일 찜에 주인 조건 | 리뷰: 폰은 세로 사진을 픽셀은 눕힌 채 회전 값으로 세운다 — 통째로 지우면 사진이 눕는다. 제조사 전용 청크가 빠지지 않았다 |
| 2026-10-14 | jpeg 메타데이터 제거를 남기는 목록 방식으로, `EOI` 뒤 데이터 버림, png `tIME` 추가 | 갤럭시 S25+ 실사진에서 `APP4` 센서 고유 ID와 `EOI` 뒤 촬영 시각·국가코드가 남는 것 확인 |
| 2026-10-14 | 구현 완료 — 백엔드(`domain` V37 · `api/storage` · `api/upload` · 프로필 연결·지우기 · 탈퇴 · 정리 배치)와 core-front 사진 영역. Tomcat `max-swallow-size` 6MB | 구현 PR |
| 2026-10-14 | 테이블 `UPLOAD` → `STORAGE_OBJECT`, `S3_KEY` → `OBJECT_KEY`, `PROVIDER`(`S3` / `R2`) 추가, 응답 `uploadId` → `fileId`. S3 호출은 인터페이스 뒤로 | 리뷰: 모델은 행위가 아니라 결과물 이름으로, S3 에 묶지 말고 다른 오브젝트 스토리지 이관을 열어 둔다 |
| 2026-10-13 | 공용 업로드 API `POST /api/uploads/images` + `UPLOAD` 테이블 + 조건부 UPDATE 연결 + 정리 배치. 프로필 연결은 `PUT /api/me/profile-image { uploadId }`. 팀 스펙 틀로 재구성 | 리뷰: 스터디 썸네일은 등록 폼에서 스터디가 생기기 전에 올려야 한다 |
| 2026-10-09 | 메타데이터(EXIF 등) 제거, S3 `Content-Type`·`Cache-Control`, 탈퇴 시 파일 삭제, 정책·기획 문서 정리 | 리뷰: 원본 그대로 공개 저장하면 위치 정보가 노출된다 · 회원 데이터 정책의 즉시 파기 |
| 2026-10-08 | 최초 작성 — `PUT`·`DELETE /api/me/profile-image`, 서버 경유 업로드, 파일 내용으로 형식 판정, 교체 시 새 파일·옛 파일 삭제 | 리더 요청: 기획을 기다리지 않고 프로필 수정에 사진 등록 |
