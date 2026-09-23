# S3 스토리지 사용 가이드

## 버킷 정보

| 환경 | 버킷 이름 | CDN URL |
|---|---|---|
| Production | `studyclub-production` | `https://ducf0htkez9mz.cloudfront.net/studyclub/gigs/<key>` |
| Stage | `studyclub-stage` | `https://d27gz6v6wvae1d.cloudfront.net/studyclub/gigs/<key>` |

**Region**: `ap-northeast-2` (서울)

## 환경변수

```env
# ── Production ──
AWS_REGION=ap-northeast-2
S3_BUCKET=studyclub-production
AWS_ACCESS_KEY_ID=     # 인프라 담당자에게 요청
AWS_SECRET_ACCESS_KEY= # 인프라 담당자에게 요청

# ── Stage ──
AWS_REGION=ap-northeast-2
S3_BUCKET=studyclub-stage
AWS_ACCESS_KEY_ID=     # 인프라 담당자에게 요청
AWS_SECRET_ACCESS_KEY= # 인프라 담당자에게 요청
```

> 키는 인프라 레포의 AWS IAM terraform 에서 `terraform output` 으로 꺼낸다 (인프라 담당자에게 요청).
> **이 문서에 실제 키를 적지 않는다.**

## 권한

| 액션 | 허용 |
|---|---|
| ListBucket | O |
| GetBucketLocation | O |
| PutObject | O |
| GetObject | O |
| DeleteObject | O |
| Multipart Upload | O |
| CreateBucket / DeleteBucket | X |
| PutBucketPolicy / ACL | X |

---

## 1. Public 업로드 (이미지 — CDN 으로 서빙)

`gigs/` prefix 로 올리면 CloudFront 를 통해 퍼블릭으로 접근 가능해요.

### 업로드

```typescript
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

async function uploadPublicImage(file: Buffer, filename: string, contentType: string) {
  const key = `gigs/${filename}`; // gigs/ prefix 필수!

  await s3.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: key,
    Body: file,
    ContentType: contentType,
  }));

  // CloudFront URL 반환
  const cdnBase = process.env.NODE_ENV === "production"
    ? "https://ducf0htkez9mz.cloudfront.net"
    : "https://d27gz6v6wvae1d.cloudfront.net";

  return `${cdnBase}/studyclub/gigs/${filename}`;
}

// 사용 예시
const url = await uploadPublicImage(
  imageBuffer,
  `profiles/${userId}.webp`,
  "image/webp"
);
// → https://ducf0htkez9mz.cloudfront.net/studyclub/gigs/profiles/abc123.webp
```

### CDN URL 구조

```
CloudFront 요청: /studyclub/gigs/profiles/abc123.webp
  → CloudFront Function 이 /studyclub/ prefix 제거
  → S3 에서 가져오는 key: gigs/profiles/abc123.webp
```

**주의**: `gigs/` 밖의 파일은 퍼블릭으로 접근 불가 — 아래 Private 방식 사용.

---

## 2. Private 업로드 (문서/파일 — Signed URL 로 서빙)

`gigs/` 밖에 올리면 퍼블릭 접근 불가. Signed URL 로 일시적으로 열어줘요.

### 업로드

```typescript
async function uploadPrivateFile(file: Buffer, filename: string, contentType: string) {
  const key = `private/${filename}`; // gigs/ 밖 — 퍼블릭 접근 불가

  await s3.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: key,
    Body: file,
    ContentType: contentType,
  }));

  return key; // DB 에 key 만 저장
}
```

### Signed URL 로 다운로드

```typescript
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

async function getDownloadUrl(key: string, expiresIn = 3600) {
  const command = new GetObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: key,
  });

  // expiresIn 초 동안만 유효한 URL 발급
  return getSignedUrl(s3, command, { expiresIn });
}

// 사용 예시
const url = await getDownloadUrl("private/reports/2026-09.pdf");
// → https://studyclub-production.s3.ap-northeast-2.amazonaws.com/private/reports/2026-09.pdf?X-Amz-...
// 1시간 뒤 만료
```

### Signed URL 로 브라우저 직접 업로드 (대용량)

서버를 거치지 않고 클라이언트가 직접 S3 에 올릴 때:

```typescript
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// 서버: presigned URL 발급
async function getUploadUrl(filename: string, contentType: string, expiresIn = 600) {
  const key = `uploads/${Date.now()}-${filename}`;

  const command = new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: key,
    ContentType: contentType,
  });

  const url = await getSignedUrl(s3, command, { expiresIn });
  return { url, key };
}

// 클라이언트: fetch 로 직접 업로드
const { url, key } = await fetch("/api/upload-url", {
  method: "POST",
  body: JSON.stringify({ filename: "photo.jpg", contentType: "image/jpeg" }),
}).then(r => r.json());

await fetch(url, {
  method: "PUT",
  body: file,
  headers: { "Content-Type": "image/jpeg" },
});
```

---

## 3. 패키지 설치

```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

---

## 폴더 구조 권장

```
gigs/                    ← 퍼블릭 (CDN 서빙)
  profiles/              ← 프로필 이미지
  thumbnails/            ← 썸네일
  banners/               ← 배너/커버 이미지
private/                 ← 비공개 (signed URL 필요)
  documents/             ← 문서/PDF
  exports/               ← 내보내기 파일
uploads/                 ← 임시 업로드 (presigned URL 용)
```

---

## SES 메일 발송 정보

별도 문서: [ses-mail.md](./ses-mail.md)
