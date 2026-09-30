import type { MemberRegion, Site } from '../types/community';
import type { L10n } from '../types/study';

export const MEMBER_REGIONS: {
  key: MemberRegion;
  label: L10n;
  tzLabel: string;
  timeZone: string;
}[] = [
  {
    key: "KR",
    label: { ko: "한국", en: "Korea" },
    tzLabel: "KST",
    timeZone: "Asia/Seoul",
  },
  {
    key: "NA",
    label: { ko: "북미", en: "North America" },
    tzLabel: "PT",
    timeZone: "America/Los_Angeles",
  },
  {
    key: "ETC",
    label: { ko: "기타", en: "Other" },
    tzLabel: "UTC",
    timeZone: "UTC",
  },
];

export const site: Site = {
  discord_invite: "https://discord.gg/wKdMvFpSDp",
  community: {
    member_count: 2000,
    region: { ko: "미국·한국·캐나다·유럽", en: "US · Korea · Canada · Europe" },
  },
};
