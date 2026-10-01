import type { L10n } from './study';

export type StudyclubEvent = {
  id: string;
  title: L10n;
  summary: L10n;
  date: string;
  type: "meetup" | "workshop" | "talk" | "online";
  location?: L10n;
  link?: string;
  order?: number;
  image?: string;
};

export type Operator = {
  id: string;
  name: L10n;
  role: L10n;
  bio: L10n;
  avatar?: string;
  links?: Record<string, string>;
  order?: number;
};

export type MemberRegion = "KR" | "NA" | "ETC";

export type Member = {
  id: string;
  region?: MemberRegion;
  name: L10n;
  headline: L10n;
  track?: string;
  studies?: string[];
  cohort?: string;
  links?: Record<string, string>;
  order?: number;
};

export type Site = {
  discord_invite: string;
  mentoring_url?: string;
  community: { member_count: number; region: L10n };
};

export type Announcement = {
  id: string;
  title: L10n;
  body: L10n;
  date: string;
  pinned?: boolean;
  tag?: "notice" | "update" | "recruit" | "event";
};
