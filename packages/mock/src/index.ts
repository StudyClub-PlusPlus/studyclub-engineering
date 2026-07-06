// @studyclub/mock — 하드코딩 mock 데이터 + 공유 타입.
// PUBLIC repo: 실명/연락처/시크릿 없음. 전부 더미 placeholder.
// TODO(api): 팀 합류 후 api.studyclub-plusplus.com 응답으로 교체.

export type Locale = "ko" | "en";
export type L10n = { ko: string; en: string };

export type StudyStatus = "recruiting" | "ongoing" | "closed";
export type StudyFormat = "online" | "offline" | "hybrid";

export type Study = {
  id: string;
  title: L10n;
  summary: L10n;
  description?: L10n;
  status: StudyStatus;
  format: StudyFormat;
  tags?: string[];
  schedule?: L10n;
  lead?: string;
  seats?: { total: number; taken: number };
  discord_url?: string;
  order?: number;
};

export type StudyclubEvent = {
  id: string;
  title: L10n;
  summary: L10n;
  date: string;
  type: "meetup" | "workshop" | "talk" | "online";
  location?: L10n;
  link?: string;
  order?: number;
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

export type Member = {
  id: string;
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

// ── site ──────────────────────────────────────────────────────────────
export const site: Site = {
  discord_invite: "https://discord.gg/example",
  mentoring_url: "https://example.com/mentoring",
  community: {
    member_count: 700,
    region: { ko: "온라인 & 오프라인", en: "Online & Offline" },
  },
};

// ── studies ───────────────────────────────────────────────────────────
export const studies: Study[] = [
  {
    id: "mle-interview-prep",
    title: { ko: "MLE 인터뷰 준비반", en: "MLE Interview Prep" },
    summary: {
      ko: "ML 엔지니어 채용 인터뷰를 함께 준비하는 8주 코호트.",
      en: "An 8-week cohort preparing together for ML engineer hiring interviews.",
    },
    description: {
      ko: "ML 시스템 디자인, 코딩, behavioral 까지 매주 모의 인터뷰와 피드백으로 채용 인터뷰를 대비합니다.",
      en: "Mock interviews and feedback every week covering ML system design, coding, and behavioral rounds.",
    },
    status: "recruiting",
    format: "hybrid",
    tags: ["MLE", "interview", "system-design"],
    schedule: { ko: "매주 화 20:00", en: "Tue 20:00 weekly" },
    lead: "alex",
    seats: { total: 12, taken: 7 },
    order: 1,
  },
  {
    id: "resume-clinic",
    title: { ko: "이력서 클리닉", en: "Resume Clinic" },
    summary: {
      ko: "현직 채용 매니저 관점으로 이력서를 리뷰하고 고쳐쓰는 라이브 세션.",
      en: "Live sessions reviewing and rewriting resumes from a hiring manager's perspective.",
    },
    description: {
      ko: "현직자가 실제 이력서를 라이브로 첨삭합니다. 매주 2~3명 집중 리뷰.",
      en: "Working engineers give live resume feedback. 2-3 deep reviews per week.",
    },
    status: "ongoing",
    format: "online",
    tags: ["resume", "career"],
    schedule: { ko: "격주 목 21:00", en: "Thu 21:00 biweekly" },
    lead: "robin",
    seats: { total: 20, taken: 18 },
    order: 2,
  },
  {
    id: "system-design-reading",
    title: { ko: "시스템 디자인 리딩 클럽", en: "System Design Reading Club" },
    summary: {
      ko: "DDIA 와 실무 사례를 매주 한 챕터씩 읽고 토론하는 모임.",
      en: "Reading and discussing one chapter a week — DDIA plus real-world cases.",
    },
    description: {
      ko: "Designing Data-Intensive Applications 를 베이스로, 참가자 실무 경험을 케이스 스터디로 나눕니다.",
      en: "Based on Designing Data-Intensive Applications, with members sharing real-world case studies.",
    },
    status: "closed",
    format: "offline",
    tags: ["system-design", "reading", "DDIA"],
    schedule: { ko: "지난 코호트 종료", en: "Past cohort ended" },
    lead: "alex",
    order: 3,
  },
];

// ── events ────────────────────────────────────────────────────────────
export const events: StudyclubEvent[] = [
  {
    id: "2026-06-meetup",
    title: { ko: "6월 오프라인 밋업", en: "June Meetup" },
    summary: {
      ko: "스터디 클럽 멤버 오프라인 네트워킹 + 라이트닝 토크 3건.",
      en: "In-person networking for study club members plus 3 lightning talks.",
    },
    date: "2026-06-21T18:00",
    type: "meetup",
    location: { ko: "장소 추후 공지", en: "Venue TBA" },
    link: "https://example.com/rsvp",
    order: 1,
  },
  {
    id: "2026-07-online-workshop",
    title: { ko: "온라인 워크샵: ML 시스템 디자인", en: "Online Workshop: ML System Design" },
    summary: {
      ko: "현직 MLE 가 진행하는 2시간 라이브 워크샵 (원격 참여 가능).",
      en: "A 2-hour live workshop led by a working MLE (remote-friendly).",
    },
    date: "2026-07-12T11:00",
    type: "workshop",
    location: { ko: "온라인 (Zoom)", en: "Online (Zoom)" },
    link: "https://example.com/register",
    order: 2,
  },
];

// ── operators ─────────────────────────────────────────────────────────
export const operators: Operator[] = [
  {
    id: "alex",
    name: { ko: "Alex", en: "Alex" },
    role: { ko: "운영 리드 · 창립자", en: "Lead Organizer · Founder" },
    bio: {
      ko: "StudyClub++ 를 시작하고 운영하는 사람. SWE/MLE 커리어 커뮤니티를 키우는 중.",
      en: "Founder and operator of StudyClub++. Growing the SWE/MLE career community.",
    },
    links: { linkedin: "https://linkedin.com/in/example" },
    order: 1,
  },
  {
    id: "robin",
    name: { ko: "Robin", en: "Robin" },
    role: { ko: "이력서 클리닉 운영", en: "Resume Clinic Organizer" },
    bio: {
      ko: "현직 시니어 엔지니어. 채용 매니저 관점으로 이력서·커리어 피드백을 제공.",
      en: "Senior engineer. Provides resume and career feedback from a hiring manager's lens.",
    },
    links: { linkedin: "https://linkedin.com/in/example" },
    order: 2,
  },
];

// ── members ───────────────────────────────────────────────────────────
export const members: Member[] = [
  {
    id: "jiwon",
    name: { ko: "지원", en: "Jiwon" },
    headline: { ko: "ML 엔지니어 인터뷰 준비 중", en: "Preparing for MLE interviews" },
    track: "MLE",
    studies: ["mle-interview-prep"],
    cohort: "2026 Spring",
    links: { github: "https://github.com/example" },
    order: 1,
  },
  {
    id: "minseo",
    name: { ko: "민서", en: "Minseo" },
    headline: { ko: "백엔드 → 빅테크 이직 준비", en: "Backend engineer aiming for big tech" },
    track: "SWE",
    studies: ["resume-clinic", "system-design-reading"],
    cohort: "2026 Spring",
    links: { linkedin: "https://linkedin.com/in/example" },
    order: 2,
  },
  {
    id: "daniel",
    name: { ko: "다니엘", en: "Daniel" },
    headline: { ko: "신입 SWE 취업 준비 (New Grad)", en: "New grad SWE job search" },
    track: "New Grad",
    studies: ["mle-interview-prep", "resume-clinic"],
    cohort: "2026 Spring",
    links: { github: "https://github.com/example" },
    order: 3,
  },
  {
    id: "soyeon",
    name: { ko: "소연", en: "Soyeon" },
    headline: { ko: "데이터 엔지니어 · 시스템 디자인 강화", en: "Data engineer sharpening system design" },
    track: "Data",
    studies: ["system-design-reading"],
    cohort: "2025 Fall",
    links: { linkedin: "https://linkedin.com/in/example" },
    order: 4,
  },
  {
    id: "hyun",
    name: { ko: "현", en: "Hyun" },
    headline: { ko: "스타트업 풀스택 · 멘토링 참여", en: "Startup full-stack, joining mentoring" },
    track: "Full-stack",
    studies: ["resume-clinic"],
    cohort: "2026 Spring",
    links: { github: "https://github.com/example" },
    order: 5,
  },
];
