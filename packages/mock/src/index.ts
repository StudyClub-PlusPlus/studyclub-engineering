// @studyclub/mock — 하드코딩 mock 데이터 + 공유 타입.
// PUBLIC repo: 실명/연락처/시크릿 없음. 공개 가능한 실제 스터디/행사 목록.
// TODO(api): 팀 합류 후 api.studyclub-plusplus.com 응답으로 교체.

export type Locale = "ko" | "en";
export type L10n = { ko: string; en: string };

export type StudyStatus = "recruiting" | "ongoing" | "closed";
export type StudyFormat = "online" | "offline" | "hybrid";

// 스터디(코호트·1회성 기수) vs 클럽(주기적·매달/상시 모집).
export type StudyKind = "study" | "club";

// 모집 정보 — 스터디 라이프사이클(status)과 별개의 "모집" 모델.
export type RecruitmentStatus = "open" | "monthly" | "always" | "closed";
export type Recruitment = {
  status: RecruitmentStatus; // open=마감기한 있는 모집, monthly=매달 정기, always=상시, closed=마감
  cadence?: "one-time" | "monthly" | "weekly" | "rolling";
  form_url?: string; // 모집 구글폼
  deadline?: string; // 모집 기한 (예: "2026/03/21")
  kickoff?: string; // 킥오프 일시 (예: "2026/03/23 (월) 6:00 PM PDT")
  capacity?: number; // 모집 인원
  note?: L10n; // "초과시 반을 나눌 수 있습니다" 등
};

// 주차별 커리큘럼.
export type StudyWeek = { label: L10n; title: L10n };

// 후기 (익명/마스킹).
export type StudyReview = { text: L10n; author?: L10n };

// 참여 통계 (마스킹된 집계 — 개인식별 불가).
export type StudyStats = {
  participants: number; // 총 참여 인원
  completion_rate?: number; // 완주율 0-100
  demographics?: { label: L10n; count: number }[]; // "40대", "SWE" 등 세그먼트별 인원
};

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
  recruit_url?: string;
  order?: number;
  year?: string;
  // ── 확장 (전부 옵션) ──
  kind?: StudyKind; // 기본 study
  category?: string;
  goal?: L10n; // 목표
  topics?: L10n[]; // 예시 주제
  how_it_works?: L10n[]; // 진행 방식 (단계별)
  audience?: L10n; // 모집 대상
  duration?: L10n; // 기간 요약 (예: "킥오프 포함 총 10주")
  weeks?: StudyWeek[]; // 주차별 커리큘럼
  recruitment?: Recruitment; // 모집 모델 (별도)
  reviews?: StudyReview[]; // 후기
  stats?: StudyStats; // 참여 통계 (마스킹)
  past_participants?: L10n[]; // 마스킹된 참여자 (예: "김OO / SWE")
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
  discord_invite: "https://discord.gg/wKdMvFpSDp",
  // mentoring_url: 실제 멘토링 URL 없음 — 생기면 채운다 (없으면 Nav/Footer 멘토링 메뉴 미표시)
  community: {
    member_count: 2000,
    region: { ko: "미국·한국·캐나다·유럽", en: "US · Korea · Canada · Europe" },
  },
};

// ── studies ───────────────────────────────────────────────────────────
export const studies: Study[] = [
  // ── 예정(모집중) ────────────────────────────────────────────────────
  {
    id: "ai-paper-study",
    kind: "study",
    title: { ko: "AI 논문 스터디", en: "AI Paper Study" },
    summary: {
      ko: "최신 AI·딥러닝 논문을 함께 읽고 발표·토론합니다.",
      en: "Read, present, and discuss the latest AI and deep-learning papers.",
    },
    status: "recruiting",
    format: "online",
    tags: ["AI/ML"],
    recruit_url: "https://forms.gle/Zynn7eGdjQZQLUEx9",
    recruitment: {
      status: "open",
      cadence: "one-time",
      form_url: "https://forms.gle/Zynn7eGdjQZQLUEx9",
    },
    order: 1,
    year: "2026",
  },
  {
    id: "pytorch-ai-coding",
    kind: "study",
    title: { ko: "PyTorch AI 실전 코딩 스터디", en: "PyTorch AI Hands-on Coding" },
    summary: {
      ko: "Deep Learning·Attention·GPT 개념을 PyTorch로 구현 (7/10 시작).",
      en: "Implement deep learning, attention, and GPT concepts in PyTorch (starts 7/10).",
    },
    status: "recruiting",
    format: "online",
    tags: ["AI/ML", "코딩"],
    recruit_url: "https://forms.gle/CLEr7JzvjwxkdTGP8",
    recruitment: {
      status: "open",
      cadence: "one-time",
      form_url: "https://forms.gle/CLEr7JzvjwxkdTGP8",
      kickoff: "7/10 시작",
    },
    order: 2,
    year: "2026",
  },
  {
    id: "python-pandas-ml-coding",
    kind: "study",
    title: { ko: "Python(Pandas) & ML(Numpy) 실전 코딩", en: "Python (Pandas) & ML (Numpy) Coding" },
    summary: {
      ko: "Data Scientist/Analyst를 위한 파이썬·ML 실전 코딩.",
      en: "Hands-on Python and ML coding for data scientists and analysts.",
    },
    status: "recruiting",
    format: "online",
    tags: ["데이터", "코딩"],
    recruit_url: "https://forms.gle/Xj2u6v3npRSrzSV19",
    recruitment: {
      status: "open",
      cadence: "one-time",
      form_url: "https://forms.gle/Xj2u6v3npRSrzSV19",
    },
    order: 3,
    year: "2026",
  },
  {
    id: "early-bird",
    kind: "club",
    title: { ko: "얼리버드", en: "Early Bird" },
    summary: {
      ko: "아침에 일찍 일어나 공부·자기개발 (매월 추가모집).",
      en: "Wake up early to study and grow yourself (new members monthly).",
    },
    status: "recruiting",
    format: "online",
    tags: ["습관"],
    recruit_url: "https://forms.gle/Ub9YHsQjuhyw7o166",
    recruitment: {
      status: "monthly",
      cadence: "monthly",
      form_url: "https://forms.gle/Ub9YHsQjuhyw7o166",
      note: { ko: "매달 추가 모집합니다", en: "New members recruited monthly" },
    },
    order: 4,
    year: "2026",
  },
  {
    id: "weeklyx",
    kind: "club",
    title: { ko: "WeeklyX", en: "WeeklyX" },
    summary: {
      ko: "일주일 X시간, 꾸준히 공부하기 (매월 추가모집).",
      en: "Study X hours a week, consistently (new members monthly).",
    },
    status: "recruiting",
    format: "online",
    tags: ["습관"],
    recruit_url: "https://forms.gle/4RpAXWfWCVNVmRAU8",
    recruitment: {
      status: "monthly",
      cadence: "monthly",
      form_url: "https://forms.gle/4RpAXWfWCVNVmRAU8",
      note: { ko: "매달 추가 모집합니다", en: "New members recruited monthly" },
    },
    order: 5,
    year: "2026",
  },
  {
    id: "past-project-review",
    kind: "study",
    title: { ko: "지난 플젝 톺아보기", en: "Past Project Review" },
    summary: {
      ko: "내 프로젝트를 돌아보며 글로 정리합니다.",
      en: "Look back on your projects and write them up.",
    },
    status: "recruiting",
    format: "online",
    tags: ["회고", "글쓰기"],
    recruit_url: "https://forms.gle/SMQeimGZKMQ2Zbeq8",
    recruitment: {
      status: "open",
      cadence: "one-time",
      form_url: "https://forms.gle/SMQeimGZKMQ2Zbeq8",
    },
    order: 6,
    year: "2026",
  },
  {
    id: "system-design-interview",
    kind: "study",
    title: { ko: "System Design Interview Study", en: "System Design Interview Study" },
    summary: {
      ko: "Hello Interview 자료 기반 시스템 디자인 인터뷰 준비.",
      en: "System design interview prep based on Hello Interview material.",
    },
    status: "recruiting",
    format: "online",
    tags: ["인터뷰"],
    recruit_url: "https://forms.gle/QD54d719pDyGcuLF8",
    recruitment: {
      status: "open",
      cadence: "one-time",
      form_url: "https://forms.gle/QD54d719pDyGcuLF8",
    },
    order: 7,
    year: "2026",
  },
  {
    id: "daily-leetcode",
    kind: "club",
    title: { ko: "Daily LeetCode", en: "Daily LeetCode" },
    summary: {
      ko: "리트코드 1일 1문제 챌린지.",
      en: "One LeetCode problem a day challenge.",
    },
    status: "recruiting",
    format: "online",
    tags: ["알고리즘"],
    recruit_url: "https://forms.gle/7tqPWZXf8m4eSz2t5",
    recruitment: {
      status: "monthly",
      cadence: "monthly",
      form_url: "https://forms.gle/7tqPWZXf8m4eSz2t5",
      note: { ko: "매달 추가 모집합니다", en: "New members recruited monthly" },
    },
    order: 8,
    year: "2026",
  },

  // ── 진행중 ──────────────────────────────────────────────────────────
  {
    id: "claude-code-source-study",
    kind: "study",
    title: { ko: "Claude Code 소스코드 스터디", en: "Claude Code Source Code Study" },
    summary: {
      ko: "화요모임 ~8명, 토요저녁 ~12명이 꾸준히 참석 중.",
      en: "~8 at Tuesday sessions, ~12 at Saturday evenings, going strong.",
    },
    status: "ongoing",
    format: "hybrid",
    tags: ["개발"],
    order: 9,
    year: "2026",
  },
  {
    id: "system-design-interview-ongoing",
    kind: "study",
    title: { ko: "시스템 디자인 인터뷰 스터디", en: "System Design Interview Study" },
    summary: {
      ko: "시스템 디자인 인터뷰 스터디 진행 중.",
      en: "System design interview study, in progress.",
    },
    status: "ongoing",
    format: "online",
    tags: ["인터뷰"],
    order: 10,
    year: "2026",
  },
  {
    id: "ddia-2nd",
    kind: "study",
    title: { ko: "DDIA 2판 (Designing Data-Intensive Applications)", en: "DDIA 2nd Edition" },
    summary: {
      ko: "데이터 집약 애플리케이션 설계 2판을 함께 읽습니다.",
      en: "Reading Designing Data-Intensive Applications, 2nd edition.",
    },
    status: "ongoing",
    format: "online",
    tags: ["기본기"],
    reviews: [
      {
        text: {
          ko: "챕터마다 실무 사례로 연결해 토론하니 이해가 훨씬 깊어졌다.",
          en: "Tying each chapter to real-world cases made it click much deeper.",
        },
        author: { ko: "익명 · 백엔드", en: "Anonymous · Backend" },
      },
      {
        text: {
          ko: "혼자 읽다 멈췄던 책을 완주 페이스로 끌고 가줘서 좋았다.",
          en: "A book I kept abandoning solo — the group pace got me through it.",
        },
        author: { ko: "익명 · 데이터 엔지니어", en: "Anonymous · Data Engineer" },
      },
    ],
    stats: {
      participants: 14,
      completion_rate: 71,
      demographics: [
        { label: { ko: "SWE", en: "SWE" }, count: 8 },
        { label: { ko: "MLE/DS", en: "MLE/DS" }, count: 3 },
        { label: { ko: "30대", en: "30s" }, count: 9 },
        { label: { ko: "40대", en: "40s" }, count: 3 },
      ],
    },
    past_participants: [
      { ko: "김OO / SWE / Bay Area", en: "Kim** / SWE / Bay Area" },
      { ko: "이OO / 백엔드 / Seattle", en: "Lee** / Backend / Seattle" },
      { ko: "박OO / 데이터 엔지니어 / Seoul", en: "Park** / Data Engineer / Seoul" },
      { ko: "최OO / SWE / Toronto", en: "Choi** / SWE / Toronto" },
      { ko: "정OO / 플랫폼 / Remote", en: "Jung** / Platform / Remote" },
      { ko: "한OO / MLE / NYC", en: "Han** / MLE / NYC" },
    ],
    order: 11,
    year: "2026",
  },
  {
    id: "renaissance-club",
    kind: "club",
    title: { ko: "르네상스 클럽", en: "Renaissance Club" },
    summary: {
      ko: "상시 운영하는 회고 모임.",
      en: "An always-on retrospective club.",
    },
    status: "ongoing",
    format: "online",
    tags: ["회고"],
    recruitment: {
      status: "always",
      cadence: "rolling",
    },
    order: 12,
    year: "2026",
  },

  // ── 이전(종료) · 2026 ───────────────────────────────────────────────
  {
    id: "business-articles",
    kind: "study",
    title: { ko: "Business Articles", en: "Business Articles" },
    summary: { ko: "비즈니스 아티클을 함께 읽는 스터디.", en: "Reading business articles together." },
    status: "closed",
    format: "online",
    tags: ["아티클"],
    order: 13,
    year: "2026",
  },
  {
    id: "ai-engineering-book-club",
    kind: "study",
    title: { ko: "AI Engineering 북클럽", en: "AI Engineering Book Club" },
    summary: { ko: "\"AI Engineering\" 북클럽.", en: "\"AI Engineering\" book club." },
    status: "closed",
    format: "online",
    tags: ["AI/ML"],
    order: 14,
    year: "2026",
  },
  {
    id: "sql-for-data-analysis",
    kind: "study",
    title: { ko: "SQL for Data Analysis", en: "SQL for Data Analysis" },
    summary: { ko: "데이터 분석을 위한 SQL 스터디.", en: "SQL for data analysis." },
    status: "closed",
    format: "online",
    tags: ["데이터"],
    order: 15,
    year: "2026",
  },
  {
    id: "db1-db2",
    kind: "study",
    title: { ko: "DB1 / DB2", en: "DB1 / DB2" },
    summary: { ko: "데이터베이스 기초 2트랙.", en: "Two-track database fundamentals." },
    status: "closed",
    format: "online",
    tags: ["기본기"],
    order: 16,
    year: "2026",
  },
  {
    id: "aws-cpc",
    kind: "study",
    title: { ko: "AWS CPC", en: "AWS CPC" },
    summary: { ko: "AWS Cloud Practitioner 자격 준비.", en: "Prep for the AWS Cloud Practitioner cert." },
    status: "closed",
    format: "online",
    tags: ["클라우드"],
    order: 17,
    year: "2026",
  },
  {
    id: "vibe-coding-basic-3",
    kind: "study",
    title: { ko: "Vibe Coding Basic 3", en: "Vibe Coding Basic 3" },
    summary: { ko: "바이브 코딩 입문 3기.", en: "Vibe coding basics, cohort 3." },
    status: "closed",
    format: "online",
    tags: ["코딩"],
    order: 18,
    year: "2026",
  },
  {
    id: "leetcode150-2026",
    kind: "study",
    title: { ko: "LeetCode150 2026", en: "LeetCode150 2026" },
    summary: { ko: "리트코드 150선 완주 (2026).", en: "Grinding LeetCode 150 (2026)." },
    status: "closed",
    format: "online",
    tags: ["알고리즘"],
    order: 19,
    year: "2026",
  },
  {
    id: "security-study",
    kind: "study",
    title: { ko: "Security Study", en: "Security Study" },
    summary: { ko: "보안 기초 스터디.", en: "Security fundamentals study." },
    status: "closed",
    format: "online",
    tags: ["보안"],
    order: 20,
    year: "2026",
  },
  {
    id: "studyclub-improvement",
    kind: "study",
    title: { ko: "스터디 클럽 개선 프로젝트", en: "Study Club Improvement Project" },
    summary: { ko: "스터디 클럽 운영을 개선하는 프로젝트.", en: "A project to improve how the study club runs." },
    status: "closed",
    format: "online",
    tags: ["운영"],
    order: 21,
    year: "2026",
  },
  {
    id: "winning-resume",
    kind: "study",
    title: { ko: "합격을 부르는 이력서", en: "Resume That Gets You Hired" },
    summary: { ko: "합격을 부르는 이력서 만들기.", en: "Crafting a resume that lands offers." },
    status: "closed",
    format: "online",
    tags: ["커리어"],
    order: 22,
    year: "2026",
  },
  {
    id: "causal-inference-workshop",
    kind: "study",
    title: { ko: "Causal Inference Workshop", en: "Causal Inference Workshop" },
    summary: { ko: "인과추론 워크샵.", en: "Causal inference workshop." },
    status: "closed",
    format: "online",
    tags: ["AI/ML"],
    order: 23,
    year: "2026",
  },
  {
    id: "security-study-2026",
    kind: "study",
    category: "보안",
    title: { ko: "보안 스터디", en: "Security Study" },
    summary: {
      ko: "실제 보안 사고 사례를 분석하며 개발자 관점의 실용 보안을 공부합니다.",
      en: "Study practical, developer-oriented security by analyzing real breach cases.",
    },
    goal: {
      ko: "실제 보안 사고 사례를 분석하면서 공격자 모델을 이해하고, 지금 당장 내 서비스에 적용할 수 있는 보안 대응 방법을 함께 공부합니다. 이론 중심이 아니라 개발자 관점의 실용 보안 지식을 얻는 것이 목표입니다.",
      en: "Understand attacker models through real breach cases and learn security measures you can apply to your own service today. Practical, developer-focused — not theory-heavy.",
    },
    topics: [
      {
        ko: "웹 보안: XSS, 쿠키/세션 탈취, CSRF, 인증/인가 취약점",
        en: "Web security: XSS, cookie/session hijacking, CSRF, authn/authz flaws",
      },
      {
        ko: "클라우드 보안: AWS 과금 공격, IAM 권한 오용, S3 유출",
        en: "Cloud security: AWS billing attacks, IAM privilege misuse, S3 leaks",
      },
      {
        ko: "인증/보안 설계: 세션 관리, 토큰 인증, 서명",
        en: "Auth & security design: session management, token auth, signing",
      },
      {
        ko: "실제 보안 사고 분석 (기업 사례)",
        en: "Analysis of real breach incidents (company case studies)",
      },
    ],
    how_it_works: [
      {
        ko: "매주 하나의 보안 주제를 정합니다",
        en: "Pick one security topic each week",
      },
      {
        ko: "스터디원 1~2명이 공격 사례·공격 방식·방어 방법을 조사해 발표합니다",
        en: "1–2 members research and present attack cases, methods, and defenses",
      },
      {
        ko: "발표는 공격자 모델 / 실제 사고 사례 / 공격이 가능한 이유 / 실제 서비스 대응 방법 중심",
        en: "Presentations focus on attacker model / real incident / why it works / how real services defend",
      },
      {
        ko: "발표 후 실제 개발 환경에서의 방어를 토론합니다",
        en: "Discuss defenses in real development environments after each talk",
      },
    ],
    duration: { ko: "킥오프 포함 총 10주", en: "10 weeks total (incl. kickoff)" },
    weeks: [
      {
        label: { ko: "1주차", en: "Week 1" },
        title: {
          ko: "킥오프 — 자기소개, 요일/시간 결정, 운영 방식 확정",
          en: "Kickoff — intros, schedule, format",
        },
      },
      {
        label: { ko: "2~9주차", en: "Weeks 2–9" },
        title: { ko: "본 스터디 진행", en: "Main study sessions" },
      },
      {
        label: { ko: "10주차", en: "Week 10" },
        title: { ko: "회고 / 정리", en: "Retro / wrap-up" },
      },
    ],
    audience: {
      ko: "보안 전공자가 아니어도 개발 경험이 있거나 보안에 관심 있는 분이면 누구나.",
      en: "Anyone with dev experience or interest in security — no security background required.",
    },
    status: "closed",
    format: "online",
    tags: ["보안", "웹보안", "클라우드"],
    recruitment: {
      status: "closed",
      cadence: "one-time",
      form_url:
        "https://docs.google.com/forms/d/e/1FAIpQLSdZ54SZX6UVkjK469TBRpU0cbZmDGsWDbPAcxV77GQ9RuKcRg/viewform?usp=header",
      deadline: "2026/03/21",
      kickoff: "2026/03/23 (월) 6:00 PM PDT",
      capacity: 10,
      note: {
        ko: "10명 (초과 시 반을 나눌 수 있습니다)",
        en: "10 people (may split into groups if oversubscribed)",
      },
    },
    reviews: [
      {
        text: {
          ko: "실제 사고 사례를 보니 우리 서비스 취약점이 보였다.",
          en: "Seeing real cases exposed gaps in our own service.",
        },
        author: { ko: "익명 · SWE", en: "Anonymous · SWE" },
      },
      {
        text: {
          ko: "이론이 아니라 바로 적용할 수 있는 방어법을 배워서 좋았다.",
          en: "Loved learning defenses I could apply immediately, not just theory.",
        },
        author: { ko: "익명 · 백엔드", en: "Anonymous · Backend" },
      },
      {
        text: {
          ko: "공격자 관점으로 생각해보니 코드 리뷰 시각이 달라졌다.",
          en: "Thinking like an attacker changed how I review code.",
        },
        author: { ko: "익명 · 플랫폼", en: "Anonymous · Platform" },
      },
    ],
    stats: {
      participants: 10,
      completion_rate: 80,
      demographics: [
        { label: { ko: "SWE", en: "SWE" }, count: 6 },
        { label: { ko: "MLE/DS", en: "MLE/DS" }, count: 2 },
        { label: { ko: "30대", en: "30s" }, count: 7 },
        { label: { ko: "40대", en: "40s" }, count: 2 },
      ],
    },
    past_participants: [
      { ko: "김OO / SWE / Bay Area", en: "Kim** / SWE / Bay Area" },
      { ko: "이OO / 백엔드 / Seattle", en: "Lee** / Backend / Seattle" },
      { ko: "박OO / 보안 / Remote", en: "Park** / Security / Remote" },
      { ko: "최OO / SWE / Seoul", en: "Choi** / SWE / Seoul" },
      { ko: "정OO / 플랫폼 / Toronto", en: "Jung** / Platform / Toronto" },
    ],
    order: 999,
    year: "2026",
  },

  // ── 이전(종료) · 2025 ───────────────────────────────────────────────
  {
    id: "ml-system-design-interview",
    kind: "study",
    title: { ko: "ML 시스템 디자인 인터뷰", en: "ML System Design Interview" },
    summary: { ko: "ML 시스템 디자인 인터뷰 준비.", en: "Prep for ML system design interviews." },
    status: "closed",
    format: "online",
    tags: ["AI/ML", "인터뷰"],
    order: 24,
    year: "2025",
  },
  {
    id: "german",
    kind: "study",
    title: { ko: "독일어", en: "German" },
    summary: { ko: "독일어 학습 스터디.", en: "German language study." },
    status: "closed",
    format: "online",
    tags: ["언어"],
    order: 25,
    year: "2025",
  },
  {
    id: "superintelligence",
    kind: "study",
    title: { ko: "Superintelligence", en: "Superintelligence" },
    summary: { ko: "\"Superintelligence\" 북클럽.", en: "\"Superintelligence\" book club." },
    status: "closed",
    format: "online",
    tags: ["북클럽"],
    order: 26,
    year: "2025",
  },
  {
    id: "practical-causal-inference",
    kind: "study",
    title: { ko: "Practical Causal Inference", en: "Practical Causal Inference" },
    summary: { ko: "실전 인과추론 스터디.", en: "Practical causal inference." },
    status: "closed",
    format: "online",
    tags: ["AI/ML"],
    order: 27,
    year: "2025",
  },
  {
    id: "start-with-why",
    kind: "study",
    title: { ko: "Start With Why", en: "Start With Why" },
    summary: { ko: "\"Start With Why\" 북클럽.", en: "\"Start With Why\" book club." },
    status: "closed",
    format: "online",
    tags: ["북클럽"],
    order: 28,
    year: "2025",
  },
  {
    id: "streaming-systems",
    kind: "study",
    title: { ko: "Streaming Systems", en: "Streaming Systems" },
    summary: { ko: "\"Streaming Systems\" 리딩.", en: "Reading \"Streaming Systems\"." },
    status: "closed",
    format: "online",
    tags: ["기본기"],
    order: 29,
    year: "2025",
  },
  {
    id: "ui-challenge",
    kind: "study",
    title: { ko: "UI Challenge", en: "UI Challenge" },
    summary: { ko: "UI 구현 챌린지.", en: "UI implementation challenge." },
    status: "closed",
    format: "online",
    tags: ["프론트엔드"],
    order: 30,
    year: "2025",
  },
  {
    id: "outliers-book-study",
    kind: "study",
    title: { ko: "아웃라이어 북스터디", en: "Outliers Book Study" },
    summary: { ko: "\"아웃라이어\" 북스터디.", en: "\"Outliers\" book study." },
    status: "closed",
    format: "online",
    tags: ["북클럽"],
    order: 31,
    year: "2025",
  },
  {
    id: "leetcode150",
    kind: "study",
    title: { ko: "LeetCode150", en: "LeetCode150" },
    summary: { ko: "리트코드 150선 완주.", en: "Grinding LeetCode 150." },
    status: "closed",
    format: "online",
    tags: ["알고리즘"],
    order: 32,
    year: "2025",
  },
  {
    id: "sunday-redis-hands-on",
    kind: "study",
    title: { ko: "일요일 실전 레디스", en: "Sunday Redis Hands-on" },
    summary: { ko: "일요일마다 실전 레디스 스터디.", en: "Hands-on Redis on Sundays." },
    status: "closed",
    format: "online",
    tags: ["백엔드"],
    order: 33,
    year: "2025",
  },
  {
    id: "neetcode-a",
    kind: "study",
    title: { ko: "NeetCode A", en: "NeetCode A" },
    summary: { ko: "NeetCode 문제풀이 A반.", en: "NeetCode practice, group A." },
    status: "closed",
    format: "online",
    tags: ["알고리즘"],
    order: 34,
    year: "2025",
  },
  {
    id: "llm-agents-study",
    kind: "study",
    title: { ko: "LLM Agents 스터디", en: "LLM Agents Study" },
    summary: { ko: "LLM 에이전트 스터디.", en: "LLM agents study." },
    status: "closed",
    format: "online",
    tags: ["AI/ML"],
    order: 35,
    year: "2025",
  },
  {
    id: "vibe-coding",
    kind: "study",
    title: { ko: "Vibe Coding", en: "Vibe Coding" },
    summary: { ko: "바이브 코딩 스터디.", en: "Vibe coding." },
    status: "closed",
    format: "online",
    tags: ["코딩"],
    order: 36,
    year: "2025",
  },
  {
    id: "vibe-coding-advanced",
    kind: "study",
    title: { ko: "Vibe Coding Advanced", en: "Vibe Coding Advanced" },
    summary: { ko: "바이브 코딩 심화.", en: "Vibe coding, advanced." },
    status: "closed",
    format: "online",
    tags: ["코딩"],
    order: 37,
    year: "2025",
  },
  {
    id: "python-for-cv",
    kind: "study",
    title: { ko: "Python for CV", en: "Python for CV" },
    summary: { ko: "컴퓨터 비전을 위한 파이썬.", en: "Python for computer vision." },
    status: "closed",
    format: "online",
    tags: ["AI/ML"],
    order: 38,
    year: "2025",
  },
  {
    id: "the-coming-wave-book-club",
    kind: "study",
    title: { ko: "The Coming Wave 북클럽", en: "The Coming Wave Book Club" },
    summary: { ko: "\"The Coming Wave\" 북클럽.", en: "\"The Coming Wave\" book club." },
    status: "closed",
    format: "online",
    tags: ["북클럽"],
    order: 39,
    year: "2025",
  },
  {
    id: "latest-llm-advanced",
    kind: "study",
    title: { ko: "최신 LLM Advanced 스터디", en: "Latest LLM Advanced Study" },
    summary: { ko: "최신 LLM 심화 스터디.", en: "Advanced study on the latest LLMs." },
    status: "closed",
    format: "online",
    tags: ["AI/ML"],
    reviews: [
      {
        text: {
          ko: "매주 새 논문·릴리스를 따라가며 감을 잃지 않을 수 있었다.",
          en: "Keeping up with weekly papers and releases kept me sharp.",
        },
        author: { ko: "익명 · MLE", en: "Anonymous · MLE" },
      },
      {
        text: {
          ko: "실무에 바로 써먹을 프롬프트·평가 패턴을 많이 얻었다.",
          en: "Picked up prompt and eval patterns I use at work right away.",
        },
        author: { ko: "익명 · 데이터 사이언티스트", en: "Anonymous · Data Scientist" },
      },
    ],
    stats: {
      participants: 18,
      completion_rate: 66,
      demographics: [
        { label: { ko: "SWE", en: "SWE" }, count: 7 },
        { label: { ko: "MLE/DS", en: "MLE/DS" }, count: 9 },
        { label: { ko: "30대", en: "30s" }, count: 11 },
        { label: { ko: "40대", en: "40s" }, count: 4 },
      ],
    },
    past_participants: [
      { ko: "김OO / MLE / Bay Area", en: "Kim** / MLE / Bay Area" },
      { ko: "이OO / 데이터 사이언티스트 / Seattle", en: "Lee** / Data Scientist / Seattle" },
      { ko: "박OO / SWE / Remote", en: "Park** / SWE / Remote" },
      { ko: "최OO / MLE / Seoul", en: "Choi** / MLE / Seoul" },
      { ko: "정OO / 리서치 / NYC", en: "Jung** / Research / NYC" },
      { ko: "한OO / SWE / Toronto", en: "Han** / SWE / Toronto" },
      { ko: "오OO / DS / Vancouver", en: "Oh** / DS / Vancouver" },
    ],
    order: 40,
    year: "2025",
  },
  {
    id: "system-design-hello-interview",
    kind: "study",
    title: { ko: "시스템디자인 Hello Interview", en: "System Design Hello Interview" },
    summary: { ko: "Hello Interview로 시스템 디자인 준비.", en: "System design prep via Hello Interview." },
    status: "closed",
    format: "online",
    tags: ["인터뷰"],
    order: 41,
    year: "2025",
  },
  {
    id: "ai-agents",
    kind: "study",
    title: { ko: "AI Agents", en: "AI Agents" },
    summary: { ko: "AI 에이전트 스터디.", en: "AI agents study." },
    status: "closed",
    format: "online",
    tags: ["AI/ML"],
    order: 42,
    year: "2025",
  },
  {
    id: "redis-hands-on",
    kind: "study",
    title: { ko: "실전 레디스", en: "Redis Hands-on" },
    summary: { ko: "실전 레디스 스터디.", en: "Hands-on Redis." },
    status: "closed",
    format: "online",
    tags: ["백엔드"],
    order: 43,
    year: "2025",
  },
  {
    id: "algorithm-interview-2025",
    kind: "study",
    title: { ko: "알고리즘 인터뷰 2025", en: "Algorithm Interview 2025" },
    summary: { ko: "알고리즘 인터뷰 준비 (2025).", en: "Algorithm interview prep (2025)." },
    status: "closed",
    format: "online",
    tags: ["알고리즘"],
    order: 44,
    year: "2025",
  },
  {
    id: "codegenai-proj",
    kind: "study",
    title: { ko: "CodeGenAI Proj", en: "CodeGenAI Proj" },
    summary: { ko: "코드 생성 AI 프로젝트.", en: "Code-generation AI project." },
    status: "closed",
    format: "online",
    tags: ["AI/ML"],
    order: 45,
    year: "2025",
  },
  {
    id: "mobile-app-growth",
    kind: "study",
    title: { ko: "Mobile App Growth", en: "Mobile App Growth" },
    summary: { ko: "모바일 앱 그로스 스터디.", en: "Mobile app growth." },
    status: "closed",
    format: "online",
    tags: ["프로덕트"],
    order: 46,
    year: "2025",
  },
  {
    id: "hooked",
    kind: "study",
    title: { ko: "Hooked", en: "Hooked" },
    summary: { ko: "\"Hooked\" 북클럽.", en: "\"Hooked\" book club." },
    status: "closed",
    format: "online",
    tags: ["북클럽"],
    order: 47,
    year: "2025",
  },
  {
    id: "vibe-coding-advanced-2",
    kind: "study",
    title: { ko: "Vibe Coding Advanced 2", en: "Vibe Coding Advanced 2" },
    summary: { ko: "바이브 코딩 심화 2기.", en: "Vibe coding advanced, cohort 2." },
    status: "closed",
    format: "online",
    tags: ["코딩"],
    order: 48,
    year: "2025",
  },
  {
    id: "system-design-mock",
    kind: "study",
    title: { ko: "System Design Mock", en: "System Design Mock" },
    summary: { ko: "시스템 디자인 모의 인터뷰.", en: "System design mock interviews." },
    status: "closed",
    format: "online",
    tags: ["인터뷰"],
    order: 49,
    year: "2025",
  },
  {
    id: "social-motivation",
    kind: "study",
    title: { ko: "Social Motivation", en: "Social Motivation" },
    summary: { ko: "함께하는 동기부여 스터디.", en: "Staying motivated together." },
    status: "closed",
    format: "online",
    tags: ["습관"],
    order: 50,
    year: "2025",
  },
  {
    id: "english-newspaper",
    kind: "study",
    title: { ko: "영자신문", en: "English Newspaper" },
    summary: { ko: "영자신문 읽기 스터디.", en: "Reading English newspapers." },
    status: "closed",
    format: "online",
    tags: ["언어"],
    order: 51,
    year: "2025",
  },
  {
    id: "product-book-club",
    kind: "study",
    title: { ko: "Product Book Club", en: "Product Book Club" },
    summary: { ko: "프로덕트 북클럽.", en: "Product book club." },
    status: "closed",
    format: "online",
    tags: ["프로덕트"],
    order: 52,
    year: "2025",
  },
  {
    id: "intro-chinese",
    kind: "study",
    title: { ko: "입문 중국어 스터디", en: "Intro Chinese Study" },
    summary: { ko: "입문 중국어 스터디.", en: "Beginner Chinese study." },
    status: "closed",
    format: "online",
    tags: ["언어"],
    order: 53,
    year: "2025",
  },
  {
    id: "advanced-llm-agents",
    kind: "study",
    title: { ko: "Advanced LLM Agents", en: "Advanced LLM Agents" },
    summary: { ko: "고급 LLM 에이전트 스터디.", en: "Advanced LLM agents." },
    status: "closed",
    format: "online",
    tags: ["AI/ML"],
    order: 54,
    year: "2025",
  },
  {
    id: "thinking-fast-and-slow",
    kind: "study",
    title: { ko: "Thinking Fast and Slow", en: "Thinking Fast and Slow" },
    summary: { ko: "\"Thinking, Fast and Slow\" 북클럽.", en: "\"Thinking, Fast and Slow\" book club." },
    status: "closed",
    format: "online",
    tags: ["북클럽"],
    order: 55,
    year: "2025",
  },
  {
    id: "python-kaggle",
    kind: "study",
    title: { ko: "Python Kaggle", en: "Python Kaggle" },
    summary: { ko: "파이썬 캐글 스터디.", en: "Python Kaggle study." },
    status: "closed",
    format: "online",
    tags: ["AI/ML"],
    order: 56,
    year: "2025",
  },
  {
    id: "vibe-coding-basic",
    kind: "study",
    title: { ko: "Vibe Coding Basic", en: "Vibe Coding Basic" },
    summary: { ko: "바이브 코딩 입문.", en: "Vibe coding basics." },
    status: "closed",
    format: "online",
    tags: ["코딩"],
    order: 57,
    year: "2025",
  },
  {
    id: "neetcode-b",
    kind: "study",
    title: { ko: "NeetCode B", en: "NeetCode B" },
    summary: { ko: "NeetCode 문제풀이 B반.", en: "NeetCode practice, group B." },
    status: "closed",
    format: "online",
    tags: ["알고리즘"],
    order: 58,
    year: "2025",
  },
  {
    id: "hello-b",
    kind: "study",
    title: { ko: "Hello B", en: "Hello B" },
    summary: { ko: "Hello 알고리즘 B반.", en: "Hello algorithms, group B." },
    status: "closed",
    format: "online",
    tags: ["알고리즘"],
    order: 59,
    year: "2025",
  },
  {
    id: "blockchain-basics",
    kind: "study",
    title: { ko: "블록체인 기초", en: "Blockchain Basics" },
    summary: { ko: "블록체인 기초 스터디.", en: "Blockchain fundamentals." },
    status: "closed",
    format: "online",
    tags: ["블록체인"],
    order: 60,
    year: "2025",
  },

  // ── 이전(종료) · 2024 ───────────────────────────────────────────────
  {
    id: "renaissance-2024",
    kind: "study",
    title: { ko: "르네상스 클럽 2024", en: "Renaissance Club 2024" },
    summary: { ko: "2024 회고 모임.", en: "2024 retrospective club." },
    status: "closed",
    format: "online",
    tags: ["회고"],
    order: 61,
    year: "2024",
  },
  {
    id: "react-beginner",
    kind: "study",
    title: { ko: "React 초급", en: "React Beginner" },
    summary: { ko: "React 입문 스터디.", en: "Beginner React." },
    status: "closed",
    format: "online",
    tags: ["프론트엔드"],
    order: 62,
    year: "2024",
  },
  {
    id: "golang",
    kind: "study",
    title: { ko: "Golang", en: "Golang" },
    summary: { ko: "Go 언어 스터디.", en: "Go language study." },
    status: "closed",
    format: "online",
    tags: ["백엔드"],
    order: 63,
    year: "2024",
  },
  {
    id: "public-speaking",
    kind: "study",
    title: { ko: "Public Speaking", en: "Public Speaking" },
    summary: { ko: "발표 스킬 스터디.", en: "Public speaking practice." },
    status: "closed",
    format: "online",
    tags: ["소프트스킬"],
    order: 64,
    year: "2024",
  },
  {
    id: "llm",
    kind: "study",
    title: { ko: "LLM", en: "LLM" },
    summary: { ko: "LLM 스터디.", en: "LLM study." },
    status: "closed",
    format: "online",
    tags: ["AI/ML"],
    order: 65,
    year: "2024",
  },
  {
    id: "ds-interview-2",
    kind: "study",
    title: { ko: "DS 인터뷰 2기", en: "DS Interview Cohort 2" },
    summary: { ko: "데이터 사이언스 인터뷰 2기.", en: "Data science interview, cohort 2." },
    status: "closed",
    format: "online",
    tags: ["데이터", "인터뷰"],
    order: 66,
    year: "2024",
  },
  {
    id: "leetcode-problem-solving",
    kind: "study",
    title: { ko: "LeetCode 문제풀이반", en: "LeetCode Problem Solving" },
    summary: { ko: "리트코드 문제풀이 스터디.", en: "LeetCode problem solving." },
    status: "closed",
    format: "online",
    tags: ["알고리즘"],
    order: 67,
    year: "2024",
  },
  {
    id: "continuous-discovery-habits",
    kind: "study",
    title: { ko: "Continuous Discovery Habit", en: "Continuous Discovery Habit" },
    summary: { ko: "지속적 발견 습관 스터디.", en: "Continuous discovery habits." },
    status: "closed",
    format: "online",
    tags: ["프로덕트"],
    order: 68,
    year: "2024",
  },
  {
    id: "ds-algorithms",
    kind: "study",
    title: { ko: "DS 알고리즘", en: "DS Algorithms" },
    summary: { ko: "데이터 사이언스 알고리즘 스터디.", en: "Data science algorithms." },
    status: "closed",
    format: "online",
    tags: ["데이터", "알고리즘"],
    order: 69,
    year: "2024",
  },
  {
    id: "efficient-ml",
    kind: "study",
    title: { ko: "Efficient ML", en: "Efficient ML" },
    summary: { ko: "효율적 ML 스터디.", en: "Efficient ML." },
    status: "closed",
    format: "online",
    tags: ["AI/ML"],
    order: 70,
    year: "2024",
  },
  {
    id: "english-in-korea",
    kind: "study",
    title: { ko: "English in Korea", en: "English in Korea" },
    summary: { ko: "한국에서 영어 스터디.", en: "English study in Korea." },
    status: "closed",
    format: "online",
    tags: ["언어"],
    order: 71,
    year: "2024",
  },
  {
    id: "english-in-us",
    kind: "study",
    title: { ko: "English in US", en: "English in US" },
    summary: { ko: "미국에서 영어 스터디.", en: "English study in the US." },
    status: "closed",
    format: "online",
    tags: ["언어"],
    order: 72,
    year: "2024",
  },
  {
    id: "kaggle",
    kind: "study",
    title: { ko: "Kaggle", en: "Kaggle" },
    summary: { ko: "캐글 스터디.", en: "Kaggle study." },
    status: "closed",
    format: "online",
    tags: ["AI/ML"],
    order: 73,
    year: "2024",
  },
  {
    id: "ml-basics",
    kind: "study",
    title: { ko: "ML 기초", en: "ML Basics" },
    summary: { ko: "머신러닝 기초 스터디.", en: "Machine learning basics." },
    status: "closed",
    format: "online",
    tags: ["AI/ML"],
    order: 74,
    year: "2024",
  },
  {
    id: "sw-book-club",
    kind: "study",
    title: { ko: "SW 북클럽", en: "SW Book Club" },
    summary: { ko: "소프트웨어 북클럽.", en: "Software book club." },
    status: "closed",
    format: "online",
    tags: ["북클럽"],
    order: 75,
    year: "2024",
  },
  {
    id: "robot-ai",
    kind: "study",
    title: { ko: "로봇 AI", en: "Robot AI" },
    summary: { ko: "로봇 AI 스터디.", en: "Robotics AI study." },
    status: "closed",
    format: "online",
    tags: ["AI/ML"],
    order: 76,
    year: "2024",
  },
  {
    id: "algorithm-mock-interview",
    kind: "study",
    title: { ko: "알고리즘 목 인터뷰", en: "Algorithm Mock Interview" },
    summary: { ko: "알고리즘 모의 인터뷰.", en: "Algorithm mock interviews." },
    status: "closed",
    format: "online",
    tags: ["알고리즘", "인터뷰"],
    order: 77,
    year: "2024",
  },
];

// ── events ────────────────────────────────────────────────────────────
export const events: StudyclubEvent[] = [
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
    title: { ko: "AIML Scientist 네트워킹 커피챗", en: "AIML Scientist Networking Coffee Chat" },
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
    title: { ko: "데이터 사이언티스트 커피챗", en: "Data Scientist Coffee Chat" },
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
    title: { ko: "디자인씽킹 101 (1기·2기)", en: "Design Thinking 101 (Cohorts 1 & 2)" },
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
