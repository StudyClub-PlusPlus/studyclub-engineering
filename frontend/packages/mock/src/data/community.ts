import type { Announcement, Member, Operator, StudyclubEvent } from '../types';

// ── announcements (공지사항) ──────────────────────────────────────────
export const announcements: Announcement[] = [
  {
    id: "site-renewal",
    tag: "update",
    pinned: true,
    title: {
      ko: "StudyClub++ 홈페이지 개편 안내",
      en: "StudyClub++ website renewal",
    },
    body: {
      ko: "스터디·행사·가이드·공지를 한곳에서 볼 수 있도록 홈페이지를 새단장했습니다. 캡틴 소개와 참여 가이드가 새로 추가됐어요. 피드백은 디스코드에서 언제든 환영합니다.",
      en: "We've refreshed the site so studies, events, guide, and notices all live in one place. New Captain intro and a join guide have been added. Feedback is always welcome on Discord.",
    },
    date: "2026-07-01",
  },
  {
    id: "july-study-recruit",
    tag: "recruit",
    title: { ko: "7월 스터디 모집 안내", en: "July study recruiting is open" },
    body: {
      ko: "AI 논문 스터디, PyTorch 실전 코딩, System Design Interview 등 신규 스터디가 모집을 시작했습니다. 모집 중인 스터디는 스터디 탭에서 확인하고 모집폼으로 신청하세요.",
      en: "New studies — AI Paper Study, PyTorch hands-on coding, System Design Interview, and more — are now recruiting. Browse the Studies tab and apply via the recruiting form.",
    },
    date: "2026-06-25",
  },
  {
    id: "new-club-daily-leetcode",
    tag: "recruit",
    title: {
      ko: "신규 클럽 오픈 — Daily LeetCode",
      en: "New club open — Daily LeetCode",
    },
    body: {
      ko: "매일 리트코드 한 문제를 함께 푸는 Daily LeetCode 클럽이 새로 열렸습니다. 클럽은 매달 상시 추가 모집하니 언제든 합류할 수 있어요.",
      en: "A new Daily LeetCode club — one problem a day, together — is now open. Clubs recruit new members every month, so you can join anytime.",
    },
    date: "2026-06-18",
  },
  {
    id: "offline-meetup-bayarea",
    tag: "event",
    title: {
      ko: "베이 지역 오프라인 밋업 공지",
      en: "Bay Area offline meetup",
    },
    body: {
      ko: "베이 지역 스터디원들을 위한 오프라인 네트워킹 밋업을 준비 중입니다. 일정과 장소는 디스코드 공지 채널에서 확정되는 대로 안내드립니다.",
      en: "We're planning an offline networking meetup for Bay Area members. Date and venue will be shared on the Discord announcements channel once confirmed.",
    },
    date: "2026-06-10",
  },
  {
    id: "captain-recruit",
    tag: "notice",
    title: {
      ko: "캡틴(운영진) 상시 모집",
      en: "Captains wanted — always open",
    },
    body: {
      ko: "스터디 초기 세팅을 돕는 캡틴을 상시 모집합니다. 100% 자원봉사이며, 캡틴은 모든 스터디·이벤트에 무료로 참여할 수 있습니다. 관심 있으면 디스코드로 문의하세요.",
      en: "We're always looking for Captains to help set up studies. It's 100% volunteer, and Captains join every study and event for free. Reach out on Discord if you're interested.",
    },
    date: "2026-05-30",
  },
  {
    id: "beyond-prompt-recap",
    tag: "event",
    title: {
      ko: "Beyond Prompt Engineering 세션 후기",
      en: "Beyond Prompt Engineering recap",
    },
    body: {
      ko: "온라인으로 진행한 Beyond Prompt Engineering 세션에 약 60명이 참여해주셨습니다. 다음 온라인 세션도 곧 공지할 예정이니 많은 관심 부탁드립니다.",
      en: "Around 60 people joined our online Beyond Prompt Engineering session. The next online session will be announced soon — stay tuned.",
    },
    date: "2026-06-02",
  },
];

// ── events ────────────────────────────────────────────────────────────
export const events: StudyclubEvent[] = [
  // ── 예정된 행사 ──
  {
    id: "fall-kickoff-meetup",
    title: {
      ko: "2026 가을 시즌 킥오프 밋업",
      en: "2026 Fall Season Kickoff Meetup",
    },
    summary: {
      ko: "가을 시즌 스터디 소개와 크루 네트워킹.",
      en: "Fall season study intros and crew networking.",
    },
    date: "2026-08-22",
    type: "meetup",
    location: { ko: "온라인", en: "Online" },
    order: 0,
  },
  {
    id: "resume-review-workshop",
    title: { ko: "이력서 리뷰 워크샵", en: "Resume Review Workshop" },
    summary: {
      ko: "현직자와 함께 이력서를 고쳐 쓰는 실습 워크샵.",
      en: "Hands-on resume rewriting with working engineers.",
    },
    date: "2026-09-05",
    type: "workshop",
    location: { ko: "온라인", en: "Online" },
    order: 0,
  },
  {
    id: "system-design-live-talk",
    title: { ko: "시스템 디자인 라이브 토크", en: "System Design Live Talk" },
    summary: {
      ko: "실제 면접 문제를 함께 풀어보는 라이브 세션.",
      en: "Solving real interview problems live.",
    },
    date: "2026-09-19",
    type: "talk",
    location: { ko: "온라인", en: "Online" },
    order: 0,
  },
  {
    id: "beyond-prompt-engineering",
    title: { ko: "Beyond Prompt Engineering", en: "Beyond Prompt Engineering" },
    summary: {
      ko: "온라인으로 진행한 프롬프트 엔지니어링 그 너머 세션 (~60명).",
      en: "An online session going beyond prompt engineering (~60 attendees).",
    },
    date: "2026-06-01",
    type: "online",
    location: { ko: "온라인", en: "Online" },
    order: 1,
  },
  {
    id: "aiml-scientist-coffee-chat",
    title: {
      ko: "AIML Scientist 네트워킹 커피챗",
      en: "AIML Scientist Networking Coffee Chat",
    },
    summary: {
      ko: "AI/ML 사이언티스트들의 네트워킹 커피챗.",
      en: "Networking coffee chat for AI/ML scientists.",
    },
    date: "2026-01-01",
    type: "meetup",
    order: 2,
  },
  {
    id: "data-scientist-coffee-chat",
    title: {
      ko: "데이터 사이언티스트 커피챗",
      en: "Data Scientist Coffee Chat",
    },
    summary: {
      ko: "데이터 사이언티스트들의 네트워킹 커피챗.",
      en: "Networking coffee chat for data scientists.",
    },
    date: "2026-01-01",
    type: "meetup",
    order: 3,
  },
  {
    id: "friday-salon",
    title: { ko: "금요살롱 (로비)", en: "Friday Salon (Lobby)" },
    summary: {
      ko: "로비에서 열린 금요 살롱 네트워킹.",
      en: "Friday salon networking in the lobby.",
    },
    date: "2025-01-01",
    type: "meetup",
    order: 4,
  },
  {
    id: "career-talk-hwe-hr-ux",
    title: { ko: "직업탐방 HWE/HR/UX", en: "Career Talk: HWE/HR/UX" },
    summary: {
      ko: "HWE·HR·UX 직군 현직자 직업탐방.",
      en: "Career talks with HWE, HR, and UX professionals.",
    },
    date: "2024-01-01",
    type: "talk",
    order: 5,
  },
  {
    id: "career-talk-swe-mle",
    title: { ko: "직업탐방 SWE/MLE", en: "Career Talk: SWE/MLE" },
    summary: {
      ko: "SWE·MLE 직군 현직자 직업탐방.",
      en: "Career talks with SWE and MLE professionals.",
    },
    date: "2024-01-01",
    type: "talk",
    order: 6,
  },
  {
    id: "design-thinking-101",
    title: {
      ko: "디자인씽킹 101 (1기·2기)",
      en: "Design Thinking 101 (Cohorts 1 & 2)",
    },
    summary: {
      ko: "디자인씽킹 입문 워크샵 (1기·2기).",
      en: "Intro design thinking workshop (cohorts 1 & 2).",
    },
    date: "2024-01-01",
    type: "workshop",
    order: 7,
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
    headline: {
      ko: "ML 엔지니어 인터뷰 준비 중",
      en: "Preparing for MLE interviews",
    },
    track: "MLE",
    studies: ["mle-interview-prep"],
    cohort: "2026 Spring",
    links: { github: "https://github.com/example" },
    order: 1,
  },
  {
    id: "minseo",
    name: { ko: "민서", en: "Minseo" },
    headline: {
      ko: "백엔드 → 빅테크 이직 준비",
      en: "Backend engineer aiming for big tech",
    },
    track: "SWE",
    studies: ["resume-clinic", "system-design-reading"],
    cohort: "2026 Spring",
    links: { linkedin: "https://linkedin.com/in/example" },
    order: 2,
  },
  {
    id: "daniel",
    name: { ko: "다니엘", en: "Daniel" },
    headline: {
      ko: "신입 SWE 취업 준비 (New Grad)",
      en: "New grad SWE job search",
    },
    track: "New Grad",
    studies: ["mle-interview-prep", "resume-clinic"],
    cohort: "2026 Spring",
    links: { github: "https://github.com/example" },
    order: 3,
  },
  {
    id: "soyeon",
    name: { ko: "소연", en: "Soyeon" },
    headline: {
      ko: "데이터 엔지니어 · 시스템 디자인 강화",
      en: "Data engineer sharpening system design",
    },
    track: "Data",
    studies: ["system-design-reading"],
    cohort: "2025 Fall",
    links: { linkedin: "https://linkedin.com/in/example" },
    order: 4,
  },
  {
    id: "hyun",
    name: { ko: "현", en: "Hyun" },
    headline: {
      ko: "스타트업 풀스택 · 멘토링 참여",
      en: "Startup full-stack, joining mentoring",
    },
    track: "Full-stack",
    studies: ["resume-clinic"],
    cohort: "2026 Spring",
    links: { github: "https://github.com/example" },
    order: 5,
  },
];
