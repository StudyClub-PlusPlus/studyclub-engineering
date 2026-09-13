# SES 메일 발송 가이드

## 도메인 구성

| 서브도메인 | 용도 | From 주소 | Config Set |
|---|---|---|---|
| `auth.studyclub-plusplus.com` | 인증/비번리셋/2FA | `no_reply@auth.studyclub-plusplus.com` | `studyclub-auth-default` |
| `news.studyclub-plusplus.com` | 공지/뉴스레터 | `no_reply@news.studyclub-plusplus.com` | `studyclub-news-default` |
| `notify.studyclub-plusplus.com` | 알림/리마인드 | `no_reply@notify.studyclub-plusplus.com` | `studyclub-notify-default` |
| `order.studyclub-plusplus.com` | 결제/정산 | `no_reply@order.studyclub-plusplus.com` | `studyclub-order-default` |
| `cs.studyclub-plusplus.com` | 고객지원 | `no_reply@cs.studyclub-plusplus.com` | `studyclub-cs-default` |
| `studyclub-plusplus.com` | 범용 (트랜잭션) | `no_reply@studyclub-plusplus.com` | `studyclub-plusplus-com-default` |

**왜 서브도메인을 나누나**: 대량 뉴스레터에서 스팸 신고를 받아도 인증 메일(`auth`) 평판이 오염되지 않는다.

## 환경변수

```env
AWS_REGION=ap-northeast-2
SES_SMTP_ENDPOINT=email-smtp.ap-northeast-2.amazonaws.com

# 서브도메인별 키 — 용도에 맞는 것만 사용
# 실제 값은 인프라 담당자에게 요청하거나
# fleet/infrastructure/terraform/modules/aws/ses/ 에서 terraform output 으로 꺼낸다

# auth
SES_AUTH_ACCESS_KEY_ID=
SES_AUTH_SECRET_ACCESS_KEY=

# news
SES_NEWS_ACCESS_KEY_ID=
SES_NEWS_SECRET_ACCESS_KEY=

# notify
SES_NOTIFY_ACCESS_KEY_ID=
SES_NOTIFY_SECRET_ACCESS_KEY=

# order
SES_ORDER_ACCESS_KEY_ID=
SES_ORDER_SECRET_ACCESS_KEY=

# cs
SES_CS_ACCESS_KEY_ID=
SES_CS_SECRET_ACCESS_KEY=

# root (범용)
SES_ROOT_ACCESS_KEY_ID=
SES_ROOT_SECRET_ACCESS_KEY=
```

> **이 문서에 실제 키를 적지 않는다.** 키는 terraform output 또는 비공개 채널로 전달.

## 발송 예시

```typescript
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";

// 용도별 클라이언트 생성
function createSesClient(accessKeyId: string, secretAccessKey: string) {
  return new SESv2Client({
    region: process.env.AWS_REGION,
    credentials: { accessKeyId, secretAccessKey },
  });
}

// 인증 메일 (비번 리셋 등)
const authSes = createSesClient(
  process.env.SES_AUTH_ACCESS_KEY_ID!,
  process.env.SES_AUTH_SECRET_ACCESS_KEY!,
);

async function sendAuthEmail(to: string, subject: string, html: string) {
  await authSes.send(new SendEmailCommand({
    FromEmailAddress: "no_reply@auth.studyclub-plusplus.com",
    Destination: { ToAddresses: [to] },
    Content: {
      Simple: {
        Subject: { Data: subject },
        Body: { Html: { Data: html } },
      },
    },
    // ⚠️ 필수! 이걸 안 넣으면 bounce/complaint 추적이 안 걸린다
    ConfigurationSetName: "studyclub-auth-default",
  }));
}

// 뉴스레터
const newsSes = createSesClient(
  process.env.SES_NEWS_ACCESS_KEY_ID!,
  process.env.SES_NEWS_SECRET_ACCESS_KEY!,
);

async function sendNewsletter(to: string, subject: string, html: string) {
  await newsSes.send(new SendEmailCommand({
    FromEmailAddress: "no_reply@news.studyclub-plusplus.com",
    Destination: { ToAddresses: [to] },
    Content: {
      Simple: {
        Subject: { Data: subject },
        Body: { Html: { Data: html } },
      },
    },
    ConfigurationSetName: "studyclub-news-default",
  }));
}
```

## 패키지 설치

```bash
npm install @aws-sdk/client-sesv2
```

## 주의사항

- **ConfigurationSetName 필수** — 안 넣으면 bounce/complaint 가 SNS 로 안 간다
- **각 키는 해당 서브도메인에서만 발송 가능** — auth 키로 news 도메인 발송 시 AccessDenied
- **워밍업 필요** — 새 서브도메인은 초기에 소량 → 점진적 증량 권장 (SES 일일 할당 확인)
- **DKIM 검증 대기 중** — DNS 전파 후 수분~수시간 내 자동 완료. SES 콘솔에서 확인
