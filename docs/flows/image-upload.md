# 이미지 업로드 — 새 화면에 붙이는 법

> 이미지가 필요한 기능(프로필 사진·스터디 썸네일·배너…)은 전부 이 길 하나를 쓴다. 새로 만들지 않는다.
> 계약 정본: [specs/profile-image/spec.md](../../specs/profile-image/spec.md) · 버킷·공개 폴더: [s3-storage.md](../s3-storage.md)
> 갱신: 2026-10-16 — 프로필 사진(core-front) · 스터디 썸네일(back-office) 연동

## 한 줄 요약

**파일을 먼저 올려 번호(`fileId`)를 받고, 기능 쪽 저장 API 가 그 번호를 받아 연결한다.**
올리는 시점에 붙일 대상이 없어도(스터디 등록 폼) 같은 길을 쓸 수 있게 올리기와 연결을 나눴다.

```mermaid
sequenceDiagram
    participant B as 브라우저
    participant API as API 서버
    participant S as 저장소 (S3 · 로컬)
    B->>API: POST /api/uploads/images (file, purpose)
    API->>API: 형식 판정 · 메타데이터 제거
    API->>S: 파일 저장
    API-->>B: 201 { fileId, url }  — 행은 PENDING
    B->>API: 기능 저장 API (… fileId …)
    API->>API: attach — PENDING → ATTACHED, 주소를 기능 칼럼에
    Note over API,S: 연결 안 된 PENDING 은 24시간 뒤 정리 배치가 지운다
```

| 상태 | 뜻 | 누가 바꾸나 |
|---|---|---|
| `PENDING` | 올렸지만 아직 어디에도 안 붙음 | 올리기 |
| `ATTACHED` | 기능 칼럼에 주소가 들어감 | 기능 쪽 저장 API (`uploadService.attach`) |
| `DELETING` | 지우는 중 — 커밋 뒤 파일 → 행 순으로 지운다 | 교체·지우기·탈퇴·정리 배치 |

## 규칙 (서버가 강제한다)

- jpeg · png · webp, **5MB**. 형식은 파일 앞 바이트로 판정한다 — 확장자·브라우저 `Content-Type` 은 안 믿는다
- 위치·기기 정보(EXIF 등)는 서버가 지운다. jpeg 회전 값만 남긴다
- 연결 안 한 파일이 계정당 **20개**면 더 못 올린다. 24시간 지나면 정리 배치가 지운다
- 기능 API 는 **주소 문자열을 받지 않는다. `fileId` 만 받는다** — 주소를 받으면 외부 이미지·추적 픽셀을 꽂을 수 있다

## 프론트 — 훅 하나

`@studyclub/ui` 의 `useImageUpload` 가 고르기 · 브라우저 검사(형식·5MB) · 올리는 중 잠금 · 오류 문구를 맡는다.
서버 호출(`upload`)은 앱이 넘긴다 — 앱마다 http 클라이언트가 따로라서다.

```tsx
import { useImageUpload } from '@studyclub/ui';
import { uploadImage } from '@/lib/upload'; // POST /api/uploads/images 한 줄

const thumb = useImageUpload({
  purpose: 'STUDY_THUMBNAIL',
  upload: uploadImage,
  // 올린 뒤 할 일. 폼이면 값에 넣고, 즉시 저장이면 저장 API 를 부른다. 끝날 때까지 잠금이 유지된다
  onUploaded: ({ fileId, url }) => {
    setValue('thumbnailFileId', fileId);
    setPreview(url);
  },
  // 선택. 401·403 처럼 앱이 직접 처리하면 null 을 돌려 문구를 안 띄운다
  onError: (err) => (err instanceof ApiError ? err.message : '사진을 올리지 못했습니다'),
});

<input {...thumb.inputProps} className='hidden' aria-label='썸네일 파일' />
<button type='button' onClick={thumb.pick} disabled={thumb.isUploading}>
  {thumb.isUploading ? '올리는 중' : '이미지 고르기'}
</button>
{thumb.error && <p role='alert'>{thumb.error}</p>}
```

| 붙인 곳 | 방식 | 코드 |
|---|---|---|
| core-front 마이페이지 프로필 사진 | 고르면 바로 연결 (저장 버튼 없음) | `apps/core-front/src/features/profile/ProfileCard.tsx` |
| back-office 스터디 등록·정보 탭 썸네일 | 고르면 미리보기, 「저장」 때 `thumbnailFileId` 로 연결 | `apps/back-office-front/src/features/studies/StudyForm.tsx` (`ThumbnailField`) |

- 두 앱 모두 `lib/upload.ts` 에 서버 호출 한 줄이 있다. 새 앱이면 같은 한 줄을 만든다
- 폼 방식이면 **올리는 동안 다른 칸을 고쳐도 덮이지 않게** 최신 폼 값을 ref 로 들고 썸네일만 얹는다 (`ThumbnailField` 참고)
- 수정 PATCH 는 **바뀌었을 때만** 번호를 보낸다 — 같은 번호를 두 번 연결하면 400

## 백엔드 — 새 용도를 붙일 때

1. **용도 추가** — `StoragePurpose` 에 enum 하나. 폴더는 반드시 `gigs/` 아래 (`gigs/` 밖은 CloudFront 가 403 이다).
   프론트 `ImagePurpose` 타입에도 같은 이름을 추가한다
2. **저장 API 는 `fileId` 를 받는다** — 요청 DTO 에 `Long fileId`. 주소 문자열 필드를 만들지 않는다
3. **연결은 기능 서비스의 트랜잭션 안에서**
   ```java
   StorageObject attached = uploadService.attach(fileId, accountId, StoragePurpose.STUDY_THUMBNAIL, now);
   entity.setThumbnailUrl(uploadService.publicUrl(attached));
   ```
   번호가 없음·남의 것·용도 다름·이미 연결됨이면 같은 400 이 난다 (사유를 구분하지 않는다)
4. **교체·지우기** — 옛 주소의 행을 찜하고 커밋 뒤 지운다. S3 호출을 트랜잭션 안에서 하지 않는다
   ```java
   Optional<StorageObject> old = uploadService.markDeletingByUrl(entity.getThumbnailUrl(), accountId, now);
   entity.setThumbnailUrl(newUrl); // 또는 null
   uploadService.deleteAfterCommit(old.stream().toList());
   ```
   주인이 **계정**인 자원(프로필 사진)은 `markDeletingByUrl(url, accountId, now)` — 올린 사람이 다르면 찜하지 않는다.
   여러 사람이 고치는 **자원**(스터디 썸네일)은 `markDeletingByUrlForPurpose(url, purpose, now)` — 주인 대신 용도를 건다.
   A 가 올린 썸네일을 B 가 바꿔도 지워지고, 칸에 다른 용도의 파일이 들어가도 지우지 않는다. 자원을 고칠 권한은 호출자가 먼저 확인한다
   ```java
   var old = uploadService.markDeletingByUrlForPurpose(study.getThumbnailUrl(), StoragePurpose.STUDY_THUMBNAIL, now);
   ```
6. **자원을 지울 때** — 그 자원의 이미지도 같은 방식으로 찜하고 커밋 뒤 지운다 (스터디 삭제가 예)
7. **탈퇴** — 이미 처리돼 있다. 그 계정의 **프로필 사진과 연결 안 된 파일**만 지운다. 자원에 붙은 파일(스터디 썸네일)은 자원의 것이라 남긴다 — 운영자가 탈퇴해도 썸네일이 깨지지 않게

## 로컬 개발 — 키 없이

로컬은 **기본이 로컬 저장소**다 (`.env.example` · docker compose 에 `STORAGE_LOCAL_ENABLED=true`).
파일은 로컬 폴더에 쓰고 API 가 `/local-storage/<키>` 로 내준다. S3 키 없이 올리기·연결·지우기가 끝까지 돈다.

| 하고 싶은 것 | 설정 |
|---|---|
| 키 없이 개발 (기본) | `STORAGE_LOCAL_ENABLED=true` |
| stage S3 로 실연동 확인 | `STORAGE_LOCAL_ENABLED=false` + S3 키 4개 + `S3_PUBLIC_BASE_URL` (인프라 담당자에게 요청) |
| 폴더 바꾸기 | `STORAGE_LOCAL_DIR` (기본 `<임시 폴더>/studyclub-storage`) |
| 호스트 `bootRun` 인데 포트가 8080 이 아님 | `STORAGE_LOCAL_PUBLIC_BASE_URL=http://localhost:<포트>/local-storage` |

- stage·production 은 이 값을 켜지 않는다. 기본값(꺼짐)이라 키가 빠지면 503 으로 드러난다
- 로컬 저장소로 올린 행은 `PROVIDER=LOCAL` 이다. 로컬 DB 를 stage 로 옮기지 않는다

## 응답 코드

| 코드 | 언제 | 화면 |
|---|---|---|
| 201 | 올리기 성공 | — |
| 400 | 형식·크기·빈 파일·깨진 이미지·용도 없음·PENDING 20개·번호 연결 실패 | 서버 문구를 그대로 |
| 401 | 로그인 만료 | 재로그인 |
| 403 | 온보딩 미완료 | 온보딩으로 |
| 503 | 저장소 설정 없음 (운영 키 누락) | 잠시 후 다시 |

## 하지 말 것

- 브라우저 → S3 직접 올리기(서명 주소). 형식 검사와 메타데이터 제거를 서버가 해야 한다
- 기능 API 에 이미지 주소 문자열 받기
- 저장소 호출을 `@Transactional` 안에서 하기 — 네트워크를 기다리는 동안 DB 잠금을 잡는다
- 용도 폴더를 `gigs/` 밖에 두기
