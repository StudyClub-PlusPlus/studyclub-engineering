/** PATCH /api/me 요청 바디. 닉네임·시간대 둘 다 필수 — 부분 갱신이 없다. */
export type ProfilePayload = { nickname: string; timeZone: string };

/** 마케팅 수신 동의 현재 값. 동의 기록이 없으면 `agreedAt` 은 null 이다. */
export type MarketingConsent = { agreed: boolean; agreedAt: string | null };
