// @studyclub/mock — 하드코딩 mock 데이터 + 공유 타입.
// PUBLIC repo: 실명/연락처/시크릿 없음. 공개 가능한 실제 스터디/행사 목록.
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
  recruit_url?: string;
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
    title: { ko: "AI 논문 스터디", en: "AI Paper Study" },
    summary: {
      ko: "최신 AI·딥러닝 논문을 함께 읽고 발표·토론합니다.",
      en: "Read, present, and discuss the latest AI and deep-learning papers.",
    },
    status: "recruiting",
    format: "online",
    tags: ["AI/ML"],
    recruit_url: "https://forms.gle/Zynn7eGdjQZQLUEx9",
    order: 1,
  },
  {
    id: "pytorch-ai-coding",
    title: { ko: "PyTorch AI 실전 코딩 스터디", en: "PyTorch AI Hands-on Coding" },
    summary: {
      ko: "Deep Learning·Attention·GPT 개념을 PyTorch로 구현 (7/10 시작).",
      en: "Implement deep learning, attention, and GPT concepts in PyTorch (starts 7/10).",
    },
    status: "recruiting",
    format: "online",
    tags: ["AI/ML", "코딩"],
    recruit_url: "https://forms.gle/CLEr7JzvjwxkdTGP8",
    order: 2,
  },
  {
    id: "python-pandas-ml-coding",
    title: { ko: "Python(Pandas) & ML(Numpy) 실전 코딩", en: "Python (Pandas) & ML (Numpy) Coding" },
    summary: {
      ko: "Data Scientist/Analyst를 위한 파이썬·ML 실전 코딩.",
      en: "Hands-on Python and ML coding for data scientists and analysts.",
    },
    status: "recruiting",
    format: "online",
    tags: ["데이터", "코딩"],
    recruit_url: "https://forms.gle/Xj2u6v3npRSrzSV19",
    order: 3,
  },
  {
    id: "early-bird",
    title: { ko: "얼리버드", en: "Early Bird" },
    summary: {
      ko: "아침에 일찍 일어나 공부·자기개발 (매월 추가모집).",
      en: "Wake up early to study and grow yourself (new members monthly).",
    },
    status: "recruiting",
    format: "online",
    tags: ["습관"],
    recruit_url: "https://forms.gle/Ub9YHsQjuhyw7o166",
    order: 4,
  },
  {
    id: "weeklyx",
    title: { ko: "WeeklyX", en: "WeeklyX" },
    summary: {
      ko: "일주일 X시간, 꾸준히 공부하기 (매월 추가모집).",
      en: "Study X hours a week, consistently (new members monthly).",
    },
    status: "recruiting",
    format: "online",
    tags: ["습관"],
    recruit_url: "https://forms.gle/4RpAXWfWCVNVmRAU8",
    order: 5,
  },
  {
    id: "past-project-review",
    title: { ko: "지난 플젝 톺아보기", en: "Past Project Review" },
    summary: {
      ko: "내 프로젝트를 돌아보며 글로 정리합니다.",
      en: "Look back on your projects and write them up.",
    },
    status: "recruiting",
    format: "online",
    tags: ["회고", "글쓰기"],
    recruit_url: "https://forms.gle/SMQeimGZKMQ2Zbeq8",
    order: 6,
  },
  {
    id: "system-design-interview",
    title: { ko: "System Design Interview Study", en: "System Design Interview Study" },
    summary: {
      ko: "Hello Interview 자료 기반 시스템 디자인 인터뷰 준비.",
      en: "System design interview prep based on Hello Interview material.",
    },
    status: "recruiting",
    format: "online",
    tags: ["인터뷰"],
    recruit_url: "https://forms.gle/QD54d719pDyGcuLF8",
    order: 7,
  },
  {
    id: "daily-leetcode",
    title: { ko: "Daily LeetCode", en: "Daily LeetCode" },
    summary: {
      ko: "리트코드 1일 1문제 챌린지.",
      en: "One LeetCode problem a day challenge.",
    },
    status: "recruiting",
    format: "online",
    tags: ["알고리즘"],
    recruit_url: "https://forms.gle/7tqPWZXf8m4eSz2t5",
    order: 8,
  },

  // ── 진행중 ──────────────────────────────────────────────────────────
  {
    id: "claude-code-source-study",
    title: { ko: "Claude Code 소스코드 스터디", en: "Claude Code Source Code Study" },
    summary: {
      ko: "화요모임 ~8명, 토요저녁 ~12명이 꾸준히 참석 중.",
      en: "~8 at Tuesday sessions, ~12 at Saturday evenings, going strong.",
    },
    status: "ongoing",
    format: "hybrid",
    tags: ["개발"],
    order: 9,
  },
  {
    id: "system-design-interview-ongoing",
    title: { ko: "시스템 디자인 인터뷰 스터디", en: "System Design Interview Study" },
    summary: {
      ko: "시스템 디자인 인터뷰 스터디 진행 중.",
      en: "System design interview study, in progress.",
    },
    status: "ongoing",
    format: "online",
    tags: ["인터뷰"],
    order: 10,
  },
  {
    id: "ddia-2nd",
    title: { ko: "DDIA 2판 (Designing Data-Intensive Applications)", en: "DDIA 2nd Edition" },
    summary: {
      ko: "데이터 집약 애플리케이션 설계 2판을 함께 읽습니다.",
      en: "Reading Designing Data-Intensive Applications, 2nd edition.",
    },
    status: "ongoing",
    format: "online",
    tags: ["기본기"],
    order: 11,
  },
  {
    id: "renaissance-club",
    title: { ko: "르네상스 클럽", en: "Renaissance Club" },
    summary: {
      ko: "상시 운영하는 회고 모임.",
      en: "An always-on retrospective club.",
    },
    status: "ongoing",
    format: "online",
    tags: ["회고"],
    order: 12,
  },

  // ── 이전(종료) · 2026 ───────────────────────────────────────────────
  {
    id: "business-articles",
    title: { ko: "Business Articles", en: "Business Articles" },
    summary: { ko: "비즈니스 아티클을 함께 읽는 스터디.", en: "Reading business articles together." },
    status: "closed",
    format: "online",
    tags: ["아티클"],
    order: 13,
  },
  {
    id: "ai-engineering-book-club",
    title: { ko: "AI Engineering 북클럽", en: "AI Engineering Book Club" },
    summary: { ko: "\"AI Engineering\" 북클럽.", en: "\"AI Engineering\" book club." },
    status: "closed",
    format: "online",
    tags: ["AI/ML"],
    order: 14,
  },
  {
    id: "sql-for-data-analysis",
    title: { ko: "SQL for Data Analysis", en: "SQL for Data Analysis" },
    summary: { ko: "데이터 분석을 위한 SQL 스터디.", en: "SQL for data analysis." },
    status: "closed",
    format: "online",
    tags: ["데이터"],
    order: 15,
  },
  {
    id: "db1-db2",
    title: { ko: "DB1 / DB2", en: "DB1 / DB2" },
    summary: { ko: "데이터베이스 기초 2트랙.", en: "Two-track database fundamentals." },
    status: "closed",
    format: "online",
    tags: ["기본기"],
    order: 16,
  },
  {
    id: "aws-cpc",
    title: { ko: "AWS CPC", en: "AWS CPC" },
    summary: { ko: "AWS Cloud Practitioner 자격 준비.", en: "Prep for the AWS Cloud Practitioner cert." },
    status: "closed",
    format: "online",
    tags: ["클라우드"],
    order: 17,
  },
  {
    id: "vibe-coding-basic-3",
    title: { ko: "Vibe Coding Basic 3", en: "Vibe Coding Basic 3" },
    summary: { ko: "바이브 코딩 입문 3기.", en: "Vibe coding basics, cohort 3." },
    status: "closed",
    format: "online",
    tags: ["코딩"],
    order: 18,
  },
  {
    id: "leetcode150-2026",
    title: { ko: "LeetCode150 2026", en: "LeetCode150 2026" },
    summary: { ko: "리트코드 150선 완주 (2026).", en: "Grinding LeetCode 150 (2026)." },
    status: "closed",
    format: "online",
    tags: ["알고리즘"],
    order: 19,
  },
  {
    id: "security-study",
    title: { ko: "Security Study", en: "Security Study" },
    summary: { ko: "보안 기초 스터디.", en: "Security fundamentals study." },
    status: "closed",
    format: "online",
    tags: ["보안"],
    order: 20,
  },
  {
    id: "studyclub-improvement",
    title: { ko: "스터디 클럽 개선 프로젝트", en: "Study Club Improvement Project" },
    summary: { ko: "스터디 클럽 운영을 개선하는 프로젝트.", en: "A project to improve how the study club runs." },
    status: "closed",
    format: "online",
    tags: ["운영"],
    order: 21,
  },
  {
    id: "winning-resume",
    title: { ko: "합격을 부르는 이력서", en: "Resume That Gets You Hired" },
    summary: { ko: "합격을 부르는 이력서 만들기.", en: "Crafting a resume that lands offers." },
    status: "closed",
    format: "online",
    tags: ["커리어"],
    order: 22,
  },
  {
    id: "causal-inference-workshop",
    title: { ko: "Causal Inference Workshop", en: "Causal Inference Workshop" },
    summary: { ko: "인과추론 워크샵.", en: "Causal inference workshop." },
    status: "closed",
    format: "online",
    tags: ["AI/ML"],
    order: 23,
  },

  // ── 이전(종료) · 2025 ───────────────────────────────────────────────
  {
    id: "ml-system-design-interview",
    title: { ko: "ML 시스템 디자인 인터뷰", en: "ML System Design Interview" },
    summary: { ko: "ML 시스템 디자인 인터뷰 준비.", en: "Prep for ML system design interviews." },
    status: "closed",
    format: "online",
    tags: ["AI/ML", "인터뷰"],
    order: 24,
  },
  {
    id: "german",
    title: { ko: "독일어", en: "German" },
    summary: { ko: "독일어 학습 스터디.", en: "German language study." },
    status: "closed",
    format: "online",
    tags: ["언어"],
    order: 25,
  },
  {
    id: "superintelligence",
    title: { ko: "Superintelligence", en: "Superintelligence" },
    summary: { ko: "\"Superintelligence\" 북클럽.", en: "\"Superintelligence\" book club." },
    status: "closed",
    format: "online",
    tags: ["북클럽"],
    order: 26,
  },
  {
    id: "practical-causal-inference",
    title: { ko: "Practical Causal Inference", en: "Practical Causal Inference" },
    summary: { ko: "실전 인과추론 스터디.", en: "Practical causal inference." },
    status: "closed",
    format: "online",
    tags: ["AI/ML"],
    order: 27,
  },
  {
    id: "start-with-why",
    title: { ko: "Start With Why", en: "Start With Why" },
    summary: { ko: "\"Start With Why\" 북클럽.", en: "\"Start With Why\" book club." },
    status: "closed",
    format: "online",
    tags: ["북클럽"],
    order: 28,
  },
  {
    id: "streaming-systems",
    title: { ko: "Streaming Systems", en: "Streaming Systems" },
    summary: { ko: "\"Streaming Systems\" 리딩.", en: "Reading \"Streaming Systems\"." },
    status: "closed",
    format: "online",
    tags: ["기본기"],
    order: 29,
  },
  {
    id: "ui-challenge",
    title: { ko: "UI Challenge", en: "UI Challenge" },
    summary: { ko: "UI 구현 챌린지.", en: "UI implementation challenge." },
    status: "closed",
    format: "online",
    tags: ["프론트엔드"],
    order: 30,
  },
  {
    id: "outliers-book-study",
    title: { ko: "아웃라이어 북스터디", en: "Outliers Book Study" },
    summary: { ko: "\"아웃라이어\" 북스터디.", en: "\"Outliers\" book study." },
    status: "closed",
    format: "online",
    tags: ["북클럽"],
    order: 31,
  },
  {
    id: "leetcode150",
    title: { ko: "LeetCode150", en: "LeetCode150" },
    summary: { ko: "리트코드 150선 완주.", en: "Grinding LeetCode 150." },
    status: "closed",
    format: "online",
    tags: ["알고리즘"],
    order: 32,
  },
  {
    id: "sunday-redis-hands-on",
    title: { ko: "일요일 실전 레디스", en: "Sunday Redis Hands-on" },
    summary: { ko: "일요일마다 실전 레디스 스터디.", en: "Hands-on Redis on Sundays." },
    status: "closed",
    format: "online",
    tags: ["백엔드"],
    order: 33,
  },
  {
    id: "neetcode-a",
    title: { ko: "NeetCode A", en: "NeetCode A" },
    summary: { ko: "NeetCode 문제풀이 A반.", en: "NeetCode practice, group A." },
    status: "closed",
    format: "online",
    tags: ["알고리즘"],
    order: 34,
  },
  {
    id: "llm-agents-study",
    title: { ko: "LLM Agents 스터디", en: "LLM Agents Study" },
    summary: { ko: "LLM 에이전트 스터디.", en: "LLM agents study." },
    status: "closed",
    format: "online",
    tags: ["AI/ML"],
    order: 35,
  },
  {
    id: "vibe-coding",
    title: { ko: "Vibe Coding", en: "Vibe Coding" },
    summary: { ko: "바이브 코딩 스터디.", en: "Vibe coding." },
    status: "closed",
    format: "online",
    tags: ["코딩"],
    order: 36,
  },
  {
    id: "vibe-coding-advanced",
    title: { ko: "Vibe Coding Advanced", en: "Vibe Coding Advanced" },
    summary: { ko: "바이브 코딩 심화.", en: "Vibe coding, advanced." },
    status: "closed",
    format: "online",
    tags: ["코딩"],
    order: 37,
  },
  {
    id: "python-for-cv",
    title: { ko: "Python for CV", en: "Python for CV" },
    summary: { ko: "컴퓨터 비전을 위한 파이썬.", en: "Python for computer vision." },
    status: "closed",
    format: "online",
    tags: ["AI/ML"],
    order: 38,
  },
  {
    id: "the-coming-wave-book-club",
    title: { ko: "The Coming Wave 북클럽", en: "The Coming Wave Book Club" },
    summary: { ko: "\"The Coming Wave\" 북클럽.", en: "\"The Coming Wave\" book club." },
    status: "closed",
    format: "online",
    tags: ["북클럽"],
    order: 39,
  },
  {
    id: "latest-llm-advanced",
    title: { ko: "최신 LLM Advanced 스터디", en: "Latest LLM Advanced Study" },
    summary: { ko: "최신 LLM 심화 스터디.", en: "Advanced study on the latest LLMs." },
    status: "closed",
    format: "online",
    tags: ["AI/ML"],
    order: 40,
  },
  {
    id: "system-design-hello-interview",
    title: { ko: "시스템디자인 Hello Interview", en: "System Design Hello Interview" },
    summary: { ko: "Hello Interview로 시스템 디자인 준비.", en: "System design prep via Hello Interview." },
    status: "closed",
    format: "online",
    tags: ["인터뷰"],
    order: 41,
  },
  {
    id: "ai-agents",
    title: { ko: "AI Agents", en: "AI Agents" },
    summary: { ko: "AI 에이전트 스터디.", en: "AI agents study." },
    status: "closed",
    format: "online",
    tags: ["AI/ML"],
    order: 42,
  },
  {
    id: "redis-hands-on",
    title: { ko: "실전 레디스", en: "Redis Hands-on" },
    summary: { ko: "실전 레디스 스터디.", en: "Hands-on Redis." },
    status: "closed",
    format: "online",
    tags: ["백엔드"],
    order: 43,
  },
  {
    id: "algorithm-interview-2025",
    title: { ko: "알고리즘 인터뷰 2025", en: "Algorithm Interview 2025" },
    summary: { ko: "알고리즘 인터뷰 준비 (2025).", en: "Algorithm interview prep (2025)." },
    status: "closed",
    format: "online",
    tags: ["알고리즘"],
    order: 44,
  },
  {
    id: "codegenai-proj",
    title: { ko: "CodeGenAI Proj", en: "CodeGenAI Proj" },
    summary: { ko: "코드 생성 AI 프로젝트.", en: "Code-generation AI project." },
    status: "closed",
    format: "online",
    tags: ["AI/ML"],
    order: 45,
  },
  {
    id: "mobile-app-growth",
    title: { ko: "Mobile App Growth", en: "Mobile App Growth" },
    summary: { ko: "모바일 앱 그로스 스터디.", en: "Mobile app growth." },
    status: "closed",
    format: "online",
    tags: ["프로덕트"],
    order: 46,
  },
  {
    id: "hooked",
    title: { ko: "Hooked", en: "Hooked" },
    summary: { ko: "\"Hooked\" 북클럽.", en: "\"Hooked\" book club." },
    status: "closed",
    format: "online",
    tags: ["북클럽"],
    order: 47,
  },
  {
    id: "vibe-coding-advanced-2",
    title: { ko: "Vibe Coding Advanced 2", en: "Vibe Coding Advanced 2" },
    summary: { ko: "바이브 코딩 심화 2기.", en: "Vibe coding advanced, cohort 2." },
    status: "closed",
    format: "online",
    tags: ["코딩"],
    order: 48,
  },
  {
    id: "system-design-mock",
    title: { ko: "System Design Mock", en: "System Design Mock" },
    summary: { ko: "시스템 디자인 모의 인터뷰.", en: "System design mock interviews." },
    status: "closed",
    format: "online",
    tags: ["인터뷰"],
    order: 49,
  },
  {
    id: "social-motivation",
    title: { ko: "Social Motivation", en: "Social Motivation" },
    summary: { ko: "함께하는 동기부여 스터디.", en: "Staying motivated together." },
    status: "closed",
    format: "online",
    tags: ["습관"],
    order: 50,
  },
  {
    id: "english-newspaper",
    title: { ko: "영자신문", en: "English Newspaper" },
    summary: { ko: "영자신문 읽기 스터디.", en: "Reading English newspapers." },
    status: "closed",
    format: "online",
    tags: ["언어"],
    order: 51,
  },
  {
    id: "product-book-club",
    title: { ko: "Product Book Club", en: "Product Book Club" },
    summary: { ko: "프로덕트 북클럽.", en: "Product book club." },
    status: "closed",
    format: "online",
    tags: ["프로덕트"],
    order: 52,
  },
  {
    id: "intro-chinese",
    title: { ko: "입문 중국어 스터디", en: "Intro Chinese Study" },
    summary: { ko: "입문 중국어 스터디.", en: "Beginner Chinese study." },
    status: "closed",
    format: "online",
    tags: ["언어"],
    order: 53,
  },
  {
    id: "advanced-llm-agents",
    title: { ko: "Advanced LLM Agents", en: "Advanced LLM Agents" },
    summary: { ko: "고급 LLM 에이전트 스터디.", en: "Advanced LLM agents." },
    status: "closed",
    format: "online",
    tags: ["AI/ML"],
    order: 54,
  },
  {
    id: "thinking-fast-and-slow",
    title: { ko: "Thinking Fast and Slow", en: "Thinking Fast and Slow" },
    summary: { ko: "\"Thinking, Fast and Slow\" 북클럽.", en: "\"Thinking, Fast and Slow\" book club." },
    status: "closed",
    format: "online",
    tags: ["북클럽"],
    order: 55,
  },
  {
    id: "python-kaggle",
    title: { ko: "Python Kaggle", en: "Python Kaggle" },
    summary: { ko: "파이썬 캐글 스터디.", en: "Python Kaggle study." },
    status: "closed",
    format: "online",
    tags: ["AI/ML"],
    order: 56,
  },
  {
    id: "vibe-coding-basic",
    title: { ko: "Vibe Coding Basic", en: "Vibe Coding Basic" },
    summary: { ko: "바이브 코딩 입문.", en: "Vibe coding basics." },
    status: "closed",
    format: "online",
    tags: ["코딩"],
    order: 57,
  },
  {
    id: "neetcode-b",
    title: { ko: "NeetCode B", en: "NeetCode B" },
    summary: { ko: "NeetCode 문제풀이 B반.", en: "NeetCode practice, group B." },
    status: "closed",
    format: "online",
    tags: ["알고리즘"],
    order: 58,
  },
  {
    id: "hello-b",
    title: { ko: "Hello B", en: "Hello B" },
    summary: { ko: "Hello 알고리즘 B반.", en: "Hello algorithms, group B." },
    status: "closed",
    format: "online",
    tags: ["알고리즘"],
    order: 59,
  },
  {
    id: "blockchain-basics",
    title: { ko: "블록체인 기초", en: "Blockchain Basics" },
    summary: { ko: "블록체인 기초 스터디.", en: "Blockchain fundamentals." },
    status: "closed",
    format: "online",
    tags: ["블록체인"],
    order: 60,
  },

  // ── 이전(종료) · 2024 ───────────────────────────────────────────────
  {
    id: "renaissance-2024",
    title: { ko: "르네상스 클럽 2024", en: "Renaissance Club 2024" },
    summary: { ko: "2024 회고 모임.", en: "2024 retrospective club." },
    status: "closed",
    format: "online",
    tags: ["회고"],
    order: 61,
  },
  {
    id: "react-beginner",
    title: { ko: "React 초급", en: "React Beginner" },
    summary: { ko: "React 입문 스터디.", en: "Beginner React." },
    status: "closed",
    format: "online",
    tags: ["프론트엔드"],
    order: 62,
  },
  {
    id: "golang",
    title: { ko: "Golang", en: "Golang" },
    summary: { ko: "Go 언어 스터디.", en: "Go language study." },
    status: "closed",
    format: "online",
    tags: ["백엔드"],
    order: 63,
  },
  {
    id: "public-speaking",
    title: { ko: "Public Speaking", en: "Public Speaking" },
    summary: { ko: "발표 스킬 스터디.", en: "Public speaking practice." },
    status: "closed",
    format: "online",
    tags: ["소프트스킬"],
    order: 64,
  },
  {
    id: "llm",
    title: { ko: "LLM", en: "LLM" },
    summary: { ko: "LLM 스터디.", en: "LLM study." },
    status: "closed",
    format: "online",
    tags: ["AI/ML"],
    order: 65,
  },
  {
    id: "ds-interview-2",
    title: { ko: "DS 인터뷰 2기", en: "DS Interview Cohort 2" },
    summary: { ko: "데이터 사이언스 인터뷰 2기.", en: "Data science interview, cohort 2." },
    status: "closed",
    format: "online",
    tags: ["데이터", "인터뷰"],
    order: 66,
  },
  {
    id: "leetcode-problem-solving",
    title: { ko: "LeetCode 문제풀이반", en: "LeetCode Problem Solving" },
    summary: { ko: "리트코드 문제풀이 스터디.", en: "LeetCode problem solving." },
    status: "closed",
    format: "online",
    tags: ["알고리즘"],
    order: 67,
  },
  {
    id: "continuous-discovery-habits",
    title: { ko: "Continuous Discovery Habit", en: "Continuous Discovery Habit" },
    summary: { ko: "지속적 발견 습관 스터디.", en: "Continuous discovery habits." },
    status: "closed",
    format: "online",
    tags: ["프로덕트"],
    order: 68,
  },
  {
    id: "ds-algorithms",
    title: { ko: "DS 알고리즘", en: "DS Algorithms" },
    summary: { ko: "데이터 사이언스 알고리즘 스터디.", en: "Data science algorithms." },
    status: "closed",
    format: "online",
    tags: ["데이터", "알고리즘"],
    order: 69,
  },
  {
    id: "efficient-ml",
    title: { ko: "Efficient ML", en: "Efficient ML" },
    summary: { ko: "효율적 ML 스터디.", en: "Efficient ML." },
    status: "closed",
    format: "online",
    tags: ["AI/ML"],
    order: 70,
  },
  {
    id: "english-in-korea",
    title: { ko: "English in Korea", en: "English in Korea" },
    summary: { ko: "한국에서 영어 스터디.", en: "English study in Korea." },
    status: "closed",
    format: "online",
    tags: ["언어"],
    order: 71,
  },
  {
    id: "english-in-us",
    title: { ko: "English in US", en: "English in US" },
    summary: { ko: "미국에서 영어 스터디.", en: "English study in the US." },
    status: "closed",
    format: "online",
    tags: ["언어"],
    order: 72,
  },
  {
    id: "kaggle",
    title: { ko: "Kaggle", en: "Kaggle" },
    summary: { ko: "캐글 스터디.", en: "Kaggle study." },
    status: "closed",
    format: "online",
    tags: ["AI/ML"],
    order: 73,
  },
  {
    id: "ml-basics",
    title: { ko: "ML 기초", en: "ML Basics" },
    summary: { ko: "머신러닝 기초 스터디.", en: "Machine learning basics." },
    status: "closed",
    format: "online",
    tags: ["AI/ML"],
    order: 74,
  },
  {
    id: "sw-book-club",
    title: { ko: "SW 북클럽", en: "SW Book Club" },
    summary: { ko: "소프트웨어 북클럽.", en: "Software book club." },
    status: "closed",
    format: "online",
    tags: ["북클럽"],
    order: 75,
  },
  {
    id: "robot-ai",
    title: { ko: "로봇 AI", en: "Robot AI" },
    summary: { ko: "로봇 AI 스터디.", en: "Robotics AI study." },
    status: "closed",
    format: "online",
    tags: ["AI/ML"],
    order: 76,
  },
  {
    id: "algorithm-mock-interview",
    title: { ko: "알고리즘 목 인터뷰", en: "Algorithm Mock Interview" },
    summary: { ko: "알고리즘 모의 인터뷰.", en: "Algorithm mock interviews." },
    status: "closed",
    format: "online",
    tags: ["알고리즘", "인터뷰"],
    order: 77,
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
