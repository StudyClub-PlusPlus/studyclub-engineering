import type { MemberRegion, L10n } from '@studyclub/types';

export const STUDY_CATEGORIES = [
  "AI · ML",
  "알고리즘",
  "데이터",
  "소프트웨어 개발",
  "커리어",
  "북클럽",
  "어학",
  "라이프스타일",
  "기획 · PM",
  "비즈니스",
  "기타",
] as const;

export const CATEGORY_DISPLAY: Record<string, string> = {
  AI_ML: "AI · ML",
  ALGORITHM: "알고리즘",
  DATA: "데이터",
  SOFTWARE: "소프트웨어 개발",
  CAREER: "커리어",
  BOOK_CLUB: "북클럽",
  LANGUAGE: "어학",
  LIFESTYLE: "라이프스타일",
  PRODUCT: "기획 · PM",
  BUSINESS: "비즈니스",
  OTHER: "기타",
};

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

