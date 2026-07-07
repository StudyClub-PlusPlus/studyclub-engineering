// Site(사이트 전역 설정) 도메인 모델.
import type { L10n } from "./common";

export type Site = {
  discord_invite: string;
  mentoring_url?: string;
  community: { member_count: number; region: L10n };
};
