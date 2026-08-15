// @studyclub/mock — 하드코딩 mock 데이터 + 공유 타입.
// PUBLIC repo: 실명/연락처/시크릿 없음. 공개 가능한 실제 스터디/행사 목록.
// TODO(api): 팀 합류 후 api.studyclub-plusplus.com 응답으로 교체.

export type Locale = "ko" | "en";
export type L10n = { ko: string; en: string };

export type StudyStatus = "recruiting" | "ongoing" | "closed";
export type StudyFormat = "online" | "offline" | "hybrid";

// 스터디는 하나의 개념. 모집 마감일이 있으면 기한 모집, 없으면 상시 모집으로만 구분한다.
export type StudyKind = "study" | "club";

/**
 * 스터디 카테고리 (canonical 11종).
 *
 * ⚠️ **이 배열의 순서는 "드롭다운에 보이는 순서"일 뿐이다.** 자주 등록하는 분야를 위로 둔다.
 * 자유입력 레거시 값을 분류하는 **매칭 우선순위는 별개**이며 UI 쪽 RULES 가 보유한다
 * (거기서는 포괄 항목인 "소프트웨어 개발"·"기타"가 반드시 맨 아래여야 구체 분야를 안 삼킨다).
 *
 * 등록 폼은 이 목록만 선택지로 제공한다. 자유 입력이면 표기 흔들림(AI/ML vs AI·ML)으로
 * 카드 색·아이콘 매칭이 깨진다.
 */
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

export type StudyCategory = (typeof STUDY_CATEGORIES)[number];


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
  schedule?: L10n;
  lead?: string;
  seats?: { total: number; taken: number };
  discord_url?: string;
  recruit_url?: string;
  order?: number;
  year?: string;
  date?: string; // 대표 날짜(ISO). 없으면 content 에서 `${year}-01-01` 로 추정 주입.
  publish_at?: string; // 공개일(ISO). 미래면 사용자 사이트에 노출되지 않는다. 비우면 즉시 공개.
  image?: string; // 썸네일 URL(옵션). 없으면 카테고리 기반 기본 이미지 생성.
  host?: { name: L10n; credential?: L10n; avatar?: string }; // 클럽장/진행자 (동행클럽 host 패턴)
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

/* ────────────────────────────────────────────────────────────────────────────
 * 스터디 상태 판정 — 사용자 사이트와 운영자 콘솔이 **같은 기준**을 쓰도록 여기서 단일 정의한다.
 * 각 앱에서 따로 계산하면 "사이트에는 모집중인데 콘솔에는 마감"처럼 어긋난다.
 * 문구(로케일)는 각 앱이 붙이고, 여기서는 판정만 한다.
 * ────────────────────────────────────────────────────────────────────────── */

/** "2026/03/21"·"2026-3-21" 등 표기 흔들림을 yyyy-mm-dd 로 통일. 파싱 실패 시 원문 유지. */
export function toISODate(raw?: string): string | undefined {
  if (!raw) return undefined;
  const m = raw.trim().match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);
  if (!m) return raw.trim() || undefined;
  return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * 모집 상태. 판정 축은 **모집 마감일 하나**.
 * 마감일을 비우면 마감 없이 계속 모집하는 것으로 본다(= 모집중).
 */
export type RecruitState = "apply" | "closed";

export function recruitState(study: Study): RecruitState {
  if (study.status !== "recruiting" || study.recruitment?.status === "closed") return "closed";
  const deadline = toISODate(study.recruitment?.deadline);
  if (!deadline) return "apply";
  return deadline >= todayISO() ? "apply" : "closed";
}

/**
 * 공개 상태. 등록 폼의 「공개일」 하나로 결정된다.
 * - live      : 공개일이 없거나(= 등록 즉시 공개) 이미 지남
 * - scheduled : 공개일이 아직 오지 않음 — 사용자 사이트에 보이지 않는다
 */
export type PublishState = "live" | "scheduled";

export function publishState(study: Study): PublishState {
  const at = toISODate(study.publish_at);
  return !at || at <= todayISO() ? "live" : "scheduled";
}

export type StudyclubEvent = {
  id: string;
  title: L10n;
  summary: L10n;
  date: string;
  type: "meetup" | "workshop" | "talk" | "online";
  location?: L10n;
  link?: string;
  order?: number;
  image?: string; // 썸네일 URL(옵션). 없으면 기본 이미지 생성.
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

/**
 * 회원 거주 지역. 신청 시 "가능한 시간"을 **각자의 현지 시간**으로 받기 위한 기준.
 * 한국의 일요일 밤과 북미의 일요일 밤은 서로 다른 시각이므로, 지역 없이 요일·시간대만 받으면
 * 운영자가 겹치는 시간을 계산할 수 없다.
 */
export type MemberRegion = "KR" | "NA" | "ETC";

export const MEMBER_REGIONS: { key: MemberRegion; label: L10n; tzLabel: string; utcOffset: number }[] = [
  { key: "KR", label: { ko: "한국", en: "Korea" }, tzLabel: "KST", utcOffset: 9 },
  { key: "NA", label: { ko: "북미", en: "North America" }, tzLabel: "PST", utcOffset: -8 },
  { key: "ETC", label: { ko: "기타", en: "Other" }, tzLabel: "UTC", utcOffset: 0 },
];

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

// 공지사항 — 모집/개편/밋업 등 커뮤니티 소식.
export type Announcement = {
  id: string;
  title: L10n;
  body: L10n;
  date: string; // ISO (예: "2026-07-01")
  pinned?: boolean;
  tag?: "notice" | "update" | "recruit" | "event";
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
    host: {
      name: { ko: "H. 김", en: "H. Kim" },
      credential: { ko: "現 AI 리서처 · 논문 리뷰어", en: "AI Researcher · paper reviewer" },
    },
    summary: {
      ko: "최신 AI·딥러닝 논문을 함께 읽고 발표·토론합니다.",
      en: "Read, present, and discuss the latest AI and deep-learning papers.",
    },
    status: "recruiting",
    format: "online",
    category: "AI · ML",
    schedule: { ko: "매주 목 20:00 · 8주 과정", en: "Thu 8:00 PM · 8 weeks" },
    description: {
      ko: "매주 정해진 논문이나 자료를 각자 읽고 모여서 정리한 내용을 나눕니다. 발표자는 돌아가며 맡고, 나머지는 미리 읽어 온 뒤 질문을 준비합니다. 이론만 훑지 않고 코드나 실제 사례로 확인하는 시간을 함께 가집니다. 배경 지식이 부족해도 따라올 수 있도록 첫 주에 기초를 정리하고 시작합니다.",
      en: "Each week we read the assigned paper or material on our own, then meet to share what we took away. Presenters rotate, and everyone comes with questions prepared. We go beyond theory by checking ideas against code or real cases. The first week covers fundamentals so newcomers can keep up.",
    },
    recruit_url: "https://forms.gle/Zynn7eGdjQZQLUEx9",
    recruitment: {
      status: "open",
      deadline: "2026-08-25",
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
    host: {
      name: { ko: "J. 신", en: "J. Shin" },
      credential: { ko: "現 빅테크 MLE · 10년차", en: "Big-tech MLE · 10 yrs" },
    },
    summary: {
      ko: "Deep Learning·Attention·GPT 개념을 PyTorch로 구현 (7/10 시작).",
      en: "Implement deep learning, attention, and GPT concepts in PyTorch (starts 7/10).",
    },
    status: "recruiting",
    format: "online",
    category: "AI · ML",
    description: {
      ko: "매주 정해진 논문이나 자료를 각자 읽고 모여서 정리한 내용을 나눕니다. 발표자는 돌아가며 맡고, 나머지는 미리 읽어 온 뒤 질문을 준비합니다. 이론만 훑지 않고 코드나 실제 사례로 확인하는 시간을 함께 가집니다. 배경 지식이 부족해도 따라올 수 있도록 첫 주에 기초를 정리하고 시작합니다.",
      en: "Each week we read the assigned paper or material on our own, then meet to share what we took away. Presenters rotate, and everyone comes with questions prepared. We go beyond theory by checking ideas against code or real cases. The first week covers fundamentals so newcomers can keep up.",
    },
    recruit_url: "https://forms.gle/CLEr7JzvjwxkdTGP8",
    recruitment: {
      status: "open",
      deadline: "2026-08-31",
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
    host: {
      name: { ko: "S. 이", en: "S. Lee" },
      credential: { ko: "現 데이터 사이언티스트", en: "Data Scientist" },
    },
    summary: {
      ko: "Data Scientist/Analyst를 위한 파이썬·ML 실전 코딩.",
      en: "Hands-on Python and ML coding for data scientists and analysts.",
    },
    status: "recruiting",
    format: "online",
    category: "AI · ML",
    schedule: { ko: "매주 목 20:00 · 8주 과정", en: "Thu 8:00 PM · 8 weeks" },
    description: {
      ko: "매주 정해진 논문이나 자료를 각자 읽고 모여서 정리한 내용을 나눕니다. 발표자는 돌아가며 맡고, 나머지는 미리 읽어 온 뒤 질문을 준비합니다. 이론만 훑지 않고 코드나 실제 사례로 확인하는 시간을 함께 가집니다. 배경 지식이 부족해도 따라올 수 있도록 첫 주에 기초를 정리하고 시작합니다.",
      en: "Each week we read the assigned paper or material on our own, then meet to share what we took away. Presenters rotate, and everyone comes with questions prepared. We go beyond theory by checking ideas against code or real cases. The first week covers fundamentals so newcomers can keep up.",
    },
    recruit_url: "https://forms.gle/Xj2u6v3npRSrzSV19",
    recruitment: {
      status: "open",
      deadline: "2026-09-05",
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
    host: {
      name: { ko: "M. 박", en: "M. Park" },
      credential: { ko: "얼리버드 클럽장 · 3년째 운영", en: "Early Bird host · 3rd year" },
    },
    summary: {
      ko: "아침에 일찍 일어나 공부·자기개발 (매월 추가모집).",
      en: "Wake up early to study and grow yourself (new members monthly).",
    },
    status: "recruiting",
    format: "online",
    category: "라이프스타일",
    schedule: { ko: "매일 인증 · 주 1회 회고", en: "Daily check-in · weekly retro" },
    description: {
      ko: "혼자서는 이어가기 어려운 습관을 함께 만들어 갑니다. 각자 목표를 정하고 매일 인증하며, 주 1회 모여 지난 한 주를 돌아봅니다. 잘 안 된 주도 그대로 이야기하는 것이 규칙입니다. 부담 없이 오래 가는 것을 목표로 합니다.",
      en: "We build habits that are hard to keep alone. Everyone sets a goal, checks in daily, and we meet weekly to look back. Talking about the weeks that didn't go well is part of the rule. The aim is to last, not to be intense.",
    },
    recruit_url: "https://forms.gle/Ub9YHsQjuhyw7o166",
    recruitment: {
      status: "monthly",
      deadline: "2026-08-28",
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
    host: {
      name: { ko: "Y. 정", en: "Y. Jung" },
      credential: { ko: "WeeklyX 클럽장", en: "WeeklyX host" },
    },
    summary: {
      ko: "일주일 X시간, 꾸준히 공부하기 (매월 추가모집).",
      en: "Study X hours a week, consistently (new members monthly).",
    },
    status: "recruiting",
    format: "online",
    category: "라이프스타일",
    schedule: { ko: "매일 인증 · 주 1회 회고", en: "Daily check-in · weekly retro" },
    description: {
      ko: "혼자서는 이어가기 어려운 습관을 함께 만들어 갑니다. 각자 목표를 정하고 매일 인증하며, 주 1회 모여 지난 한 주를 돌아봅니다. 잘 안 된 주도 그대로 이야기하는 것이 규칙입니다. 부담 없이 오래 가는 것을 목표로 합니다.",
      en: "We build habits that are hard to keep alone. Everyone sets a goal, checks in daily, and we meet weekly to look back. Talking about the weeks that didn't go well is part of the rule. The aim is to last, not to be intense.",
    },
    recruit_url: "https://forms.gle/4RpAXWfWCVNVmRAU8",
    recruitment: {
      status: "monthly",
      deadline: "2026-08-28",
      cadence: "monthly",
      form_url: "https://forms.gle/4RpAXWfWCVNVmRAU8",
      note: { ko: "매달 추가 모집합니다", en: "New members recruited monthly" },
    },
    order: 5,
    year: "2026",
  },
  {
    id: "past-project-review",
    // 공개일이 미래 = 사용자 사이트에 아직 안 보임. 운영자 콘솔에서만 보인다.
    publish_at: "2026-09-15",
    kind: "study",
    title: { ko: "지난 플젝 톺아보기", en: "Past Project Review" },
    host: {
      name: { ko: "D. 최", en: "D. Choi" },
      credential: { ko: "시니어 SWE · 글쓰기 멘토", en: "Senior SWE · writing mentor" },
    },
    summary: {
      ko: "내 프로젝트를 돌아보며 글로 정리합니다.",
      en: "Look back on your projects and write them up.",
    },
    status: "recruiting",
    format: "online",
    category: "라이프스타일",
    description: {
      ko: "혼자서는 이어가기 어려운 습관을 함께 만들어 갑니다. 각자 목표를 정하고 매일 인증하며, 주 1회 모여 지난 한 주를 돌아봅니다. 잘 안 된 주도 그대로 이야기하는 것이 규칙입니다. 부담 없이 오래 가는 것을 목표로 합니다.",
      en: "We build habits that are hard to keep alone. Everyone sets a goal, checks in daily, and we meet weekly to look back. Talking about the weeks that didn't go well is part of the rule. The aim is to last, not to be intense.",
    },
    recruit_url: "https://forms.gle/SMQeimGZKMQ2Zbeq8",
    recruitment: {
      status: "open",
      deadline: "2026-09-10",
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
    host: {
      name: { ko: "K. 한", en: "K. Han" },
      credential: { ko: "現 빅테크 스태프 엔지니어", en: "Big-tech Staff Engineer" },
    },
    summary: {
      ko: "Hello Interview 자료 기반 시스템 디자인 인터뷰 준비.",
      en: "System design interview prep based on Hello Interview material.",
    },
    status: "recruiting",
    format: "online",
    category: "커리어",
    description: {
      ko: "이력서와 포트폴리오를 실제로 고쳐가며 진행합니다. 각자 초안을 가져오면 함께 읽고 고칠 부분을 짚습니다. 모의 면접도 포함되며, 피드백은 구체적으로 남깁니다. 지원 중인 분과 준비 단계인 분 모두 참여할 수 있습니다.",
      en: "We revise resumes and portfolios for real. Bring a draft; we read it together and mark what to fix. Mock interviews are included, with concrete feedback. Open to both active applicants and those still preparing.",
    },
    recruit_url: "https://forms.gle/QD54d719pDyGcuLF8",
    recruitment: {
      status: "open",
      deadline: "2026-08-20",
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
    host: {
      name: { ko: "R. 오", en: "R. Oh" },
      credential: { ko: "알고리즘 코치 · ICPC 출신", en: "Algorithm coach · ex-ICPC" },
    },
    summary: {
      ko: "리트코드 1일 1문제 챌린지.",
      en: "One LeetCode problem a day challenge.",
    },
    status: "recruiting",
    format: "online",
    category: "AI · ML",
    schedule: { ko: "매주 목 20:00 · 8주 과정", en: "Thu 8:00 PM · 8 weeks" },
    description: {
      ko: "매주 정해진 논문이나 자료를 각자 읽고 모여서 정리한 내용을 나눕니다. 발표자는 돌아가며 맡고, 나머지는 미리 읽어 온 뒤 질문을 준비합니다. 이론만 훑지 않고 코드나 실제 사례로 확인하는 시간을 함께 가집니다. 배경 지식이 부족해도 따라올 수 있도록 첫 주에 기초를 정리하고 시작합니다.",
      en: "Each week we read the assigned paper or material on our own, then meet to share what we took away. Presenters rotate, and everyone comes with questions prepared. We go beyond theory by checking ideas against code or real cases. The first week covers fundamentals so newcomers can keep up.",
    },
    recruit_url: "https://forms.gle/7tqPWZXf8m4eSz2t5",
    recruitment: {
      status: "monthly",
      deadline: "2026-08-30",
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
    host: {
      name: { ko: "T. 강", en: "T. Kang" },
      credential: { ko: "시니어 SWE · 오픈소스 컨트리뷰터", en: "Senior SWE · OSS contributor" },
    },
    summary: {
      ko: "화요모임 ~8명, 토요저녁 ~12명이 꾸준히 참석 중.",
      en: "~8 at Tuesday sessions, ~12 at Saturday evenings, going strong.",
    },
    status: "ongoing",
    format: "hybrid",
    category: "소프트웨어 개발",
    schedule: { ko: "매주 토 10:00 · 10주 과정", en: "Sat 10:00 AM · 10 weeks" },
    description: {
      ko: "직접 만들어 보면서 배우는 방식입니다. 매주 목표를 정하고 각자 구현한 뒤 코드를 서로 리뷰합니다. 정답을 알려주기보다 왜 그렇게 했는지 설명하는 데 시간을 씁니다. 완성보다 꾸준히 이어가는 것을 우선합니다.",
      en: "We learn by building. Each week has a goal; we implement on our own and review each other's code. More time goes to explaining why than to giving answers. Consistency matters more than finishing.",
    },
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
    category: "커리어",
    schedule: { ko: "격주 수 20:00 · 4회", en: "Every other Wed 8:00 PM · 4 sessions" },
    description: {
      ko: "이력서와 포트폴리오를 실제로 고쳐가며 진행합니다. 각자 초안을 가져오면 함께 읽고 고칠 부분을 짚습니다. 모의 면접도 포함되며, 피드백은 구체적으로 남깁니다. 지원 중인 분과 준비 단계인 분 모두 참여할 수 있습니다.",
      en: "We revise resumes and portfolios for real. Bring a draft; we read it together and mark what to fix. Mock interviews are included, with concrete feedback. Open to both active applicants and those still preparing.",
    },
    order: 10,
    year: "2026",
  },
  {
    id: "ddia-2nd",
    kind: "study",
    title: { ko: "DDIA 2판 (Designing Data-Intensive Applications)", en: "DDIA 2nd Edition" },
    host: {
      name: { ko: "S. 서", en: "S. Seo" },
      credential: { ko: "現 시니어 백엔드 · 분산시스템", en: "Senior Backend · distributed systems" },
    },
    summary: {
      ko: "데이터 집약 애플리케이션 설계 2판을 함께 읽습니다.",
      en: "Reading Designing Data-Intensive Applications, 2nd edition.",
    },
    status: "ongoing",
    format: "online",
    category: "데이터",
    schedule: { ko: "매주 수 20:30 · 6주 과정", en: "Wed 8:30 PM · 6 weeks" },
    description: {
      ko: "실제 데이터셋을 놓고 쿼리와 분석을 직접 해보는 방식으로 진행합니다. 이론 설명은 짧게 하고 대부분의 시간을 손으로 만지는 데 씁니다. 매주 과제가 있고, 각자 결과를 공유하며 다른 접근을 배웁니다. 도구 설치와 환경 설정은 첫 주에 함께 끝냅니다.",
      en: "We work hands-on with real datasets — queries and analysis you run yourself. Theory is kept short; most of the time is spent doing. Weekly assignments are shared so everyone sees other approaches. Setup is done together in week one.",
    },
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
    category: "라이프스타일",
    schedule: { ko: "매일 인증 · 주 1회 회고", en: "Daily check-in · weekly retro" },
    description: {
      ko: "혼자서는 이어가기 어려운 습관을 함께 만들어 갑니다. 각자 목표를 정하고 매일 인증하며, 주 1회 모여 지난 한 주를 돌아봅니다. 잘 안 된 주도 그대로 이야기하는 것이 규칙입니다. 부담 없이 오래 가는 것을 목표로 합니다.",
      en: "We build habits that are hard to keep alone. Everyone sets a goal, checks in daily, and we meet weekly to look back. Talking about the weeks that didn't go well is part of the rule. The aim is to last, not to be intense.",
    },
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
    category: "비즈니스",
    schedule: { ko: "매주 일 10:00 · 상시", en: "Sun 10:00 AM · ongoing" },
    description: {
      ko: "정해진 아티클이나 리포트를 읽고 모여 의견을 나눕니다. 시장과 산업의 흐름을 각자의 관점에서 해석해 보는 시간입니다. 배경 지식이 달라도 괜찮으며, 오히려 다른 시각이 논의를 풍부하게 만듭니다. 자료는 매주 미리 공유됩니다.",
      en: "We read the assigned article or report and meet to discuss. It's a space to interpret market and industry shifts from your own angle. Different backgrounds are welcome — they make the discussion better. Materials are shared in advance.",
    },
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
    category: "AI · ML",
    schedule: { ko: "매주 목 20:00 · 8주 과정", en: "Thu 8:00 PM · 8 weeks" },
    description: {
      ko: "매주 정해진 논문이나 자료를 각자 읽고 모여서 정리한 내용을 나눕니다. 발표자는 돌아가며 맡고, 나머지는 미리 읽어 온 뒤 질문을 준비합니다. 이론만 훑지 않고 코드나 실제 사례로 확인하는 시간을 함께 가집니다. 배경 지식이 부족해도 따라올 수 있도록 첫 주에 기초를 정리하고 시작합니다.",
      en: "Each week we read the assigned paper or material on our own, then meet to share what we took away. Presenters rotate, and everyone comes with questions prepared. We go beyond theory by checking ideas against code or real cases. The first week covers fundamentals so newcomers can keep up.",
    },
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
    category: "데이터",
    schedule: { ko: "매주 수 20:30 · 6주 과정", en: "Wed 8:30 PM · 6 weeks" },
    description: {
      ko: "실제 데이터셋을 놓고 쿼리와 분석을 직접 해보는 방식으로 진행합니다. 이론 설명은 짧게 하고 대부분의 시간을 손으로 만지는 데 씁니다. 매주 과제가 있고, 각자 결과를 공유하며 다른 접근을 배웁니다. 도구 설치와 환경 설정은 첫 주에 함께 끝냅니다.",
      en: "We work hands-on with real datasets — queries and analysis you run yourself. Theory is kept short; most of the time is spent doing. Weekly assignments are shared so everyone sees other approaches. Setup is done together in week one.",
    },
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
    category: "데이터",
    schedule: { ko: "매주 수 20:30 · 6주 과정", en: "Wed 8:30 PM · 6 weeks" },
    description: {
      ko: "실제 데이터셋을 놓고 쿼리와 분석을 직접 해보는 방식으로 진행합니다. 이론 설명은 짧게 하고 대부분의 시간을 손으로 만지는 데 씁니다. 매주 과제가 있고, 각자 결과를 공유하며 다른 접근을 배웁니다. 도구 설치와 환경 설정은 첫 주에 함께 끝냅니다.",
      en: "We work hands-on with real datasets — queries and analysis you run yourself. Theory is kept short; most of the time is spent doing. Weekly assignments are shared so everyone sees other approaches. Setup is done together in week one.",
    },
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
    category: "소프트웨어 개발",
    schedule: { ko: "매주 토 10:00 · 10주 과정", en: "Sat 10:00 AM · 10 weeks" },
    description: {
      ko: "직접 만들어 보면서 배우는 방식입니다. 매주 목표를 정하고 각자 구현한 뒤 코드를 서로 리뷰합니다. 정답을 알려주기보다 왜 그렇게 했는지 설명하는 데 시간을 씁니다. 완성보다 꾸준히 이어가는 것을 우선합니다.",
      en: "We learn by building. Each week has a goal; we implement on our own and review each other's code. More time goes to explaining why than to giving answers. Consistency matters more than finishing.",
    },
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
    category: "소프트웨어 개발",
    schedule: { ko: "매주 토 10:00 · 10주 과정", en: "Sat 10:00 AM · 10 weeks" },
    description: {
      ko: "직접 만들어 보면서 배우는 방식입니다. 매주 목표를 정하고 각자 구현한 뒤 코드를 서로 리뷰합니다. 정답을 알려주기보다 왜 그렇게 했는지 설명하는 데 시간을 씁니다. 완성보다 꾸준히 이어가는 것을 우선합니다.",
      en: "We learn by building. Each week has a goal; we implement on our own and review each other's code. More time goes to explaining why than to giving answers. Consistency matters more than finishing.",
    },
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
    category: "알고리즘",
    schedule: { ko: "매주 화·목 21:00 · 상시", en: "Tue & Thu 9:00 PM · ongoing" },
    description: {
      ko: "정해진 문제를 각자 풀어 온 뒤 모여서 풀이를 비교합니다. 같은 문제를 서로 다르게 접근한 지점을 짚어보는 것이 핵심입니다. 시간 복잡도와 더 나은 풀이를 함께 찾고, 막힌 부분은 그 자리에서 같이 봅니다. 난이도는 참여자 수준에 맞춰 조정합니다.",
      en: "We each solve the assigned problems beforehand, then compare approaches together. The point is spotting where our solutions diverged. We review complexity, look for better solutions, and work through blockers on the spot. Difficulty adapts to the group.",
    },
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
    category: "소프트웨어 개발",
    schedule: { ko: "매주 토 10:00 · 10주 과정", en: "Sat 10:00 AM · 10 weeks" },
    description: {
      ko: "직접 만들어 보면서 배우는 방식입니다. 매주 목표를 정하고 각자 구현한 뒤 코드를 서로 리뷰합니다. 정답을 알려주기보다 왜 그렇게 했는지 설명하는 데 시간을 씁니다. 완성보다 꾸준히 이어가는 것을 우선합니다.",
      en: "We learn by building. Each week has a goal; we implement on our own and review each other's code. More time goes to explaining why than to giving answers. Consistency matters more than finishing.",
    },
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
    category: "기타",
    schedule: { ko: "킥오프에서 확정", en: "Set at kickoff" },
    description: {
      ko: "관심사가 비슷한 사람들이 모여 함께 배우고 이야기합니다. 진행 방식은 참여자와 상의해 정하며, 첫 모임에서 목표와 일정을 함께 맞춥니다. 부담 없이 참여할 수 있도록 운영합니다. 자세한 내용은 킥오프에서 안내합니다.",
      en: "People with shared interests gather to learn and talk. The format is decided with participants; goals and schedule are set at the first meeting. It's run to be low-pressure. Details are covered at kickoff.",
    },
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
    category: "커리어",
    schedule: { ko: "격주 수 20:00 · 4회", en: "Every other Wed 8:00 PM · 4 sessions" },
    description: {
      ko: "이력서와 포트폴리오를 실제로 고쳐가며 진행합니다. 각자 초안을 가져오면 함께 읽고 고칠 부분을 짚습니다. 모의 면접도 포함되며, 피드백은 구체적으로 남깁니다. 지원 중인 분과 준비 단계인 분 모두 참여할 수 있습니다.",
      en: "We revise resumes and portfolios for real. Bring a draft; we read it together and mark what to fix. Mock interviews are included, with concrete feedback. Open to both active applicants and those still preparing.",
    },
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
    category: "AI · ML",
    schedule: { ko: "매주 목 20:00 · 8주 과정", en: "Thu 8:00 PM · 8 weeks" },
    description: {
      ko: "매주 정해진 논문이나 자료를 각자 읽고 모여서 정리한 내용을 나눕니다. 발표자는 돌아가며 맡고, 나머지는 미리 읽어 온 뒤 질문을 준비합니다. 이론만 훑지 않고 코드나 실제 사례로 확인하는 시간을 함께 가집니다. 배경 지식이 부족해도 따라올 수 있도록 첫 주에 기초를 정리하고 시작합니다.",
      en: "Each week we read the assigned paper or material on our own, then meet to share what we took away. Presenters rotate, and everyone comes with questions prepared. We go beyond theory by checking ideas against code or real cases. The first week covers fundamentals so newcomers can keep up.",
    },
    order: 23,
    year: "2026",
  },
  {
    id: "security-study-2026",
    kind: "study",
    category: "소프트웨어 개발",
    schedule: { ko: "매주 토 10:00 · 10주 과정", en: "Sat 10:00 AM · 10 weeks" },
    description: {
      ko: "직접 만들어 보면서 배우는 방식입니다. 매주 목표를 정하고 각자 구현한 뒤 코드를 서로 리뷰합니다. 정답을 알려주기보다 왜 그렇게 했는지 설명하는 데 시간을 씁니다. 완성보다 꾸준히 이어가는 것을 우선합니다.",
      en: "We learn by building. Each week has a goal; we implement on our own and review each other's code. More time goes to explaining why than to giving answers. Consistency matters more than finishing.",
    },
    title: { ko: "보안 스터디", en: "Security Study" },
    host: {
      name: { ko: "P. 문", en: "P. Moon" },
      credential: { ko: "現 보안 엔지니어 · 8년차", en: "Security Engineer · 8 yrs" },
    },
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
    category: "AI · ML",
    schedule: { ko: "매주 목 20:00 · 8주 과정", en: "Thu 8:00 PM · 8 weeks" },
    description: {
      ko: "매주 정해진 논문이나 자료를 각자 읽고 모여서 정리한 내용을 나눕니다. 발표자는 돌아가며 맡고, 나머지는 미리 읽어 온 뒤 질문을 준비합니다. 이론만 훑지 않고 코드나 실제 사례로 확인하는 시간을 함께 가집니다. 배경 지식이 부족해도 따라올 수 있도록 첫 주에 기초를 정리하고 시작합니다.",
      en: "Each week we read the assigned paper or material on our own, then meet to share what we took away. Presenters rotate, and everyone comes with questions prepared. We go beyond theory by checking ideas against code or real cases. The first week covers fundamentals so newcomers can keep up.",
    },
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
    category: "어학",
    schedule: { ko: "매주 금 20:00 · 상시", en: "Fri 8:00 PM · ongoing" },
    description: {
      ko: "실제로 말하고 쓰는 시간을 최대한 확보합니다. 문법 설명은 최소로 하고, 주제를 정해 대화하거나 짧은 글을 써 옵니다. 서로의 표현을 고쳐주며 자연스러운 문장을 찾아갑니다. 수준이 달라도 짝을 나눠 진행합니다.",
      en: "We maximize time actually speaking and writing. Grammar explanation is kept minimal; instead we hold themed conversations or bring short pieces of writing. We correct each other toward more natural phrasing. Mixed levels are handled by pairing.",
    },
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
    category: "북클럽",
    schedule: { ko: "매주 월 21:00 · 책 1권", en: "Mon 9:00 PM · one book" },
    description: {
      ko: "한 권을 정해 매주 정해진 분량을 읽고 모입니다. 요약보다는 읽으면서 들었던 생각과 질문을 나누는 데 집중합니다. 진도를 못 맞춰도 참석할 수 있으며, 논의는 읽은 만큼만 다룹니다. 책은 참여자 투표로 정합니다.",
      en: "We pick one book and read a set portion each week. Discussion focuses on reactions and questions rather than summaries. You can join even if you fall behind — we only discuss what's been read. The book is chosen by vote.",
    },
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
    category: "AI · ML",
    schedule: { ko: "매주 목 20:00 · 8주 과정", en: "Thu 8:00 PM · 8 weeks" },
    description: {
      ko: "매주 정해진 논문이나 자료를 각자 읽고 모여서 정리한 내용을 나눕니다. 발표자는 돌아가며 맡고, 나머지는 미리 읽어 온 뒤 질문을 준비합니다. 이론만 훑지 않고 코드나 실제 사례로 확인하는 시간을 함께 가집니다. 배경 지식이 부족해도 따라올 수 있도록 첫 주에 기초를 정리하고 시작합니다.",
      en: "Each week we read the assigned paper or material on our own, then meet to share what we took away. Presenters rotate, and everyone comes with questions prepared. We go beyond theory by checking ideas against code or real cases. The first week covers fundamentals so newcomers can keep up.",
    },
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
    category: "북클럽",
    schedule: { ko: "매주 월 21:00 · 책 1권", en: "Mon 9:00 PM · one book" },
    description: {
      ko: "한 권을 정해 매주 정해진 분량을 읽고 모입니다. 요약보다는 읽으면서 들었던 생각과 질문을 나누는 데 집중합니다. 진도를 못 맞춰도 참석할 수 있으며, 논의는 읽은 만큼만 다룹니다. 책은 참여자 투표로 정합니다.",
      en: "We pick one book and read a set portion each week. Discussion focuses on reactions and questions rather than summaries. You can join even if you fall behind — we only discuss what's been read. The book is chosen by vote.",
    },
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
    category: "기타",
    schedule: { ko: "킥오프에서 확정", en: "Set at kickoff" },
    description: {
      ko: "관심사가 비슷한 사람들이 모여 함께 배우고 이야기합니다. 진행 방식은 참여자와 상의해 정하며, 첫 모임에서 목표와 일정을 함께 맞춥니다. 부담 없이 참여할 수 있도록 운영합니다. 자세한 내용은 킥오프에서 안내합니다.",
      en: "People with shared interests gather to learn and talk. The format is decided with participants; goals and schedule are set at the first meeting. It's run to be low-pressure. Details are covered at kickoff.",
    },
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
    category: "소프트웨어 개발",
    schedule: { ko: "매주 토 10:00 · 10주 과정", en: "Sat 10:00 AM · 10 weeks" },
    description: {
      ko: "직접 만들어 보면서 배우는 방식입니다. 매주 목표를 정하고 각자 구현한 뒤 코드를 서로 리뷰합니다. 정답을 알려주기보다 왜 그렇게 했는지 설명하는 데 시간을 씁니다. 완성보다 꾸준히 이어가는 것을 우선합니다.",
      en: "We learn by building. Each week has a goal; we implement on our own and review each other's code. More time goes to explaining why than to giving answers. Consistency matters more than finishing.",
    },
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
    category: "북클럽",
    schedule: { ko: "매주 월 21:00 · 책 1권", en: "Mon 9:00 PM · one book" },
    description: {
      ko: "한 권을 정해 매주 정해진 분량을 읽고 모입니다. 요약보다는 읽으면서 들었던 생각과 질문을 나누는 데 집중합니다. 진도를 못 맞춰도 참석할 수 있으며, 논의는 읽은 만큼만 다룹니다. 책은 참여자 투표로 정합니다.",
      en: "We pick one book and read a set portion each week. Discussion focuses on reactions and questions rather than summaries. You can join even if you fall behind — we only discuss what's been read. The book is chosen by vote.",
    },
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
    category: "알고리즘",
    schedule: { ko: "매주 화·목 21:00 · 상시", en: "Tue & Thu 9:00 PM · ongoing" },
    description: {
      ko: "정해진 문제를 각자 풀어 온 뒤 모여서 풀이를 비교합니다. 같은 문제를 서로 다르게 접근한 지점을 짚어보는 것이 핵심입니다. 시간 복잡도와 더 나은 풀이를 함께 찾고, 막힌 부분은 그 자리에서 같이 봅니다. 난이도는 참여자 수준에 맞춰 조정합니다.",
      en: "We each solve the assigned problems beforehand, then compare approaches together. The point is spotting where our solutions diverged. We review complexity, look for better solutions, and work through blockers on the spot. Difficulty adapts to the group.",
    },
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
    category: "소프트웨어 개발",
    schedule: { ko: "매주 토 10:00 · 10주 과정", en: "Sat 10:00 AM · 10 weeks" },
    description: {
      ko: "직접 만들어 보면서 배우는 방식입니다. 매주 목표를 정하고 각자 구현한 뒤 코드를 서로 리뷰합니다. 정답을 알려주기보다 왜 그렇게 했는지 설명하는 데 시간을 씁니다. 완성보다 꾸준히 이어가는 것을 우선합니다.",
      en: "We learn by building. Each week has a goal; we implement on our own and review each other's code. More time goes to explaining why than to giving answers. Consistency matters more than finishing.",
    },
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
    category: "알고리즘",
    schedule: { ko: "매주 화·목 21:00 · 상시", en: "Tue & Thu 9:00 PM · ongoing" },
    description: {
      ko: "정해진 문제를 각자 풀어 온 뒤 모여서 풀이를 비교합니다. 같은 문제를 서로 다르게 접근한 지점을 짚어보는 것이 핵심입니다. 시간 복잡도와 더 나은 풀이를 함께 찾고, 막힌 부분은 그 자리에서 같이 봅니다. 난이도는 참여자 수준에 맞춰 조정합니다.",
      en: "We each solve the assigned problems beforehand, then compare approaches together. The point is spotting where our solutions diverged. We review complexity, look for better solutions, and work through blockers on the spot. Difficulty adapts to the group.",
    },
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
    category: "AI · ML",
    schedule: { ko: "매주 목 20:00 · 8주 과정", en: "Thu 8:00 PM · 8 weeks" },
    description: {
      ko: "매주 정해진 논문이나 자료를 각자 읽고 모여서 정리한 내용을 나눕니다. 발표자는 돌아가며 맡고, 나머지는 미리 읽어 온 뒤 질문을 준비합니다. 이론만 훑지 않고 코드나 실제 사례로 확인하는 시간을 함께 가집니다. 배경 지식이 부족해도 따라올 수 있도록 첫 주에 기초를 정리하고 시작합니다.",
      en: "Each week we read the assigned paper or material on our own, then meet to share what we took away. Presenters rotate, and everyone comes with questions prepared. We go beyond theory by checking ideas against code or real cases. The first week covers fundamentals so newcomers can keep up.",
    },
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
    category: "소프트웨어 개발",
    schedule: { ko: "매주 토 10:00 · 10주 과정", en: "Sat 10:00 AM · 10 weeks" },
    description: {
      ko: "직접 만들어 보면서 배우는 방식입니다. 매주 목표를 정하고 각자 구현한 뒤 코드를 서로 리뷰합니다. 정답을 알려주기보다 왜 그렇게 했는지 설명하는 데 시간을 씁니다. 완성보다 꾸준히 이어가는 것을 우선합니다.",
      en: "We learn by building. Each week has a goal; we implement on our own and review each other's code. More time goes to explaining why than to giving answers. Consistency matters more than finishing.",
    },
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
    category: "소프트웨어 개발",
    schedule: { ko: "매주 토 10:00 · 10주 과정", en: "Sat 10:00 AM · 10 weeks" },
    description: {
      ko: "직접 만들어 보면서 배우는 방식입니다. 매주 목표를 정하고 각자 구현한 뒤 코드를 서로 리뷰합니다. 정답을 알려주기보다 왜 그렇게 했는지 설명하는 데 시간을 씁니다. 완성보다 꾸준히 이어가는 것을 우선합니다.",
      en: "We learn by building. Each week has a goal; we implement on our own and review each other's code. More time goes to explaining why than to giving answers. Consistency matters more than finishing.",
    },
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
    category: "AI · ML",
    schedule: { ko: "매주 목 20:00 · 8주 과정", en: "Thu 8:00 PM · 8 weeks" },
    description: {
      ko: "매주 정해진 논문이나 자료를 각자 읽고 모여서 정리한 내용을 나눕니다. 발표자는 돌아가며 맡고, 나머지는 미리 읽어 온 뒤 질문을 준비합니다. 이론만 훑지 않고 코드나 실제 사례로 확인하는 시간을 함께 가집니다. 배경 지식이 부족해도 따라올 수 있도록 첫 주에 기초를 정리하고 시작합니다.",
      en: "Each week we read the assigned paper or material on our own, then meet to share what we took away. Presenters rotate, and everyone comes with questions prepared. We go beyond theory by checking ideas against code or real cases. The first week covers fundamentals so newcomers can keep up.",
    },
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
    category: "북클럽",
    schedule: { ko: "매주 월 21:00 · 책 1권", en: "Mon 9:00 PM · one book" },
    description: {
      ko: "한 권을 정해 매주 정해진 분량을 읽고 모입니다. 요약보다는 읽으면서 들었던 생각과 질문을 나누는 데 집중합니다. 진도를 못 맞춰도 참석할 수 있으며, 논의는 읽은 만큼만 다룹니다. 책은 참여자 투표로 정합니다.",
      en: "We pick one book and read a set portion each week. Discussion focuses on reactions and questions rather than summaries. You can join even if you fall behind — we only discuss what's been read. The book is chosen by vote.",
    },
    order: 39,
    year: "2025",
  },
  {
    id: "latest-llm-advanced",
    kind: "study",
    title: { ko: "최신 LLM Advanced 스터디", en: "Latest LLM Advanced Study" },
    host: {
      name: { ko: "A. 윤", en: "A. Yoon" },
      credential: { ko: "現 LLM 리서처", en: "LLM Researcher" },
    },
    summary: { ko: "최신 LLM 심화 스터디.", en: "Advanced study on the latest LLMs." },
    status: "closed",
    format: "online",
    category: "AI · ML",
    schedule: { ko: "매주 목 20:00 · 8주 과정", en: "Thu 8:00 PM · 8 weeks" },
    description: {
      ko: "매주 정해진 논문이나 자료를 각자 읽고 모여서 정리한 내용을 나눕니다. 발표자는 돌아가며 맡고, 나머지는 미리 읽어 온 뒤 질문을 준비합니다. 이론만 훑지 않고 코드나 실제 사례로 확인하는 시간을 함께 가집니다. 배경 지식이 부족해도 따라올 수 있도록 첫 주에 기초를 정리하고 시작합니다.",
      en: "Each week we read the assigned paper or material on our own, then meet to share what we took away. Presenters rotate, and everyone comes with questions prepared. We go beyond theory by checking ideas against code or real cases. The first week covers fundamentals so newcomers can keep up.",
    },
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
    category: "커리어",
    schedule: { ko: "격주 수 20:00 · 4회", en: "Every other Wed 8:00 PM · 4 sessions" },
    description: {
      ko: "이력서와 포트폴리오를 실제로 고쳐가며 진행합니다. 각자 초안을 가져오면 함께 읽고 고칠 부분을 짚습니다. 모의 면접도 포함되며, 피드백은 구체적으로 남깁니다. 지원 중인 분과 준비 단계인 분 모두 참여할 수 있습니다.",
      en: "We revise resumes and portfolios for real. Bring a draft; we read it together and mark what to fix. Mock interviews are included, with concrete feedback. Open to both active applicants and those still preparing.",
    },
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
    category: "AI · ML",
    schedule: { ko: "매주 목 20:00 · 8주 과정", en: "Thu 8:00 PM · 8 weeks" },
    description: {
      ko: "매주 정해진 논문이나 자료를 각자 읽고 모여서 정리한 내용을 나눕니다. 발표자는 돌아가며 맡고, 나머지는 미리 읽어 온 뒤 질문을 준비합니다. 이론만 훑지 않고 코드나 실제 사례로 확인하는 시간을 함께 가집니다. 배경 지식이 부족해도 따라올 수 있도록 첫 주에 기초를 정리하고 시작합니다.",
      en: "Each week we read the assigned paper or material on our own, then meet to share what we took away. Presenters rotate, and everyone comes with questions prepared. We go beyond theory by checking ideas against code or real cases. The first week covers fundamentals so newcomers can keep up.",
    },
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
    category: "소프트웨어 개발",
    schedule: { ko: "매주 토 10:00 · 10주 과정", en: "Sat 10:00 AM · 10 weeks" },
    description: {
      ko: "직접 만들어 보면서 배우는 방식입니다. 매주 목표를 정하고 각자 구현한 뒤 코드를 서로 리뷰합니다. 정답을 알려주기보다 왜 그렇게 했는지 설명하는 데 시간을 씁니다. 완성보다 꾸준히 이어가는 것을 우선합니다.",
      en: "We learn by building. Each week has a goal; we implement on our own and review each other's code. More time goes to explaining why than to giving answers. Consistency matters more than finishing.",
    },
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
    category: "알고리즘",
    schedule: { ko: "매주 화·목 21:00 · 상시", en: "Tue & Thu 9:00 PM · ongoing" },
    description: {
      ko: "정해진 문제를 각자 풀어 온 뒤 모여서 풀이를 비교합니다. 같은 문제를 서로 다르게 접근한 지점을 짚어보는 것이 핵심입니다. 시간 복잡도와 더 나은 풀이를 함께 찾고, 막힌 부분은 그 자리에서 같이 봅니다. 난이도는 참여자 수준에 맞춰 조정합니다.",
      en: "We each solve the assigned problems beforehand, then compare approaches together. The point is spotting where our solutions diverged. We review complexity, look for better solutions, and work through blockers on the spot. Difficulty adapts to the group.",
    },
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
    category: "AI · ML",
    schedule: { ko: "매주 목 20:00 · 8주 과정", en: "Thu 8:00 PM · 8 weeks" },
    description: {
      ko: "매주 정해진 논문이나 자료를 각자 읽고 모여서 정리한 내용을 나눕니다. 발표자는 돌아가며 맡고, 나머지는 미리 읽어 온 뒤 질문을 준비합니다. 이론만 훑지 않고 코드나 실제 사례로 확인하는 시간을 함께 가집니다. 배경 지식이 부족해도 따라올 수 있도록 첫 주에 기초를 정리하고 시작합니다.",
      en: "Each week we read the assigned paper or material on our own, then meet to share what we took away. Presenters rotate, and everyone comes with questions prepared. We go beyond theory by checking ideas against code or real cases. The first week covers fundamentals so newcomers can keep up.",
    },
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
    category: "기획 · PM",
    schedule: { ko: "격주 목 20:00 · 상시", en: "Every other Thu 8:00 PM · ongoing" },
    description: {
      ko: "실무에서 겪는 문제를 사례로 놓고 이야기합니다. 매주 한 명이 진행 중인 과제나 고민을 가져오면 함께 뜯어봅니다. 정답을 찾기보다 다른 조직은 어떻게 푸는지 비교하는 데 의미를 둡니다. 직무 연차와 무관하게 참여할 수 있습니다.",
      en: "We discuss real problems from our own work. Each week someone brings a live project or question and we unpack it together. The value is comparing how different orgs solve it, not finding one right answer. Open regardless of seniority.",
    },
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
    category: "북클럽",
    schedule: { ko: "매주 월 21:00 · 책 1권", en: "Mon 9:00 PM · one book" },
    description: {
      ko: "한 권을 정해 매주 정해진 분량을 읽고 모입니다. 요약보다는 읽으면서 들었던 생각과 질문을 나누는 데 집중합니다. 진도를 못 맞춰도 참석할 수 있으며, 논의는 읽은 만큼만 다룹니다. 책은 참여자 투표로 정합니다.",
      en: "We pick one book and read a set portion each week. Discussion focuses on reactions and questions rather than summaries. You can join even if you fall behind — we only discuss what's been read. The book is chosen by vote.",
    },
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
    category: "소프트웨어 개발",
    schedule: { ko: "매주 토 10:00 · 10주 과정", en: "Sat 10:00 AM · 10 weeks" },
    description: {
      ko: "직접 만들어 보면서 배우는 방식입니다. 매주 목표를 정하고 각자 구현한 뒤 코드를 서로 리뷰합니다. 정답을 알려주기보다 왜 그렇게 했는지 설명하는 데 시간을 씁니다. 완성보다 꾸준히 이어가는 것을 우선합니다.",
      en: "We learn by building. Each week has a goal; we implement on our own and review each other's code. More time goes to explaining why than to giving answers. Consistency matters more than finishing.",
    },
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
    category: "커리어",
    schedule: { ko: "격주 수 20:00 · 4회", en: "Every other Wed 8:00 PM · 4 sessions" },
    description: {
      ko: "이력서와 포트폴리오를 실제로 고쳐가며 진행합니다. 각자 초안을 가져오면 함께 읽고 고칠 부분을 짚습니다. 모의 면접도 포함되며, 피드백은 구체적으로 남깁니다. 지원 중인 분과 준비 단계인 분 모두 참여할 수 있습니다.",
      en: "We revise resumes and portfolios for real. Bring a draft; we read it together and mark what to fix. Mock interviews are included, with concrete feedback. Open to both active applicants and those still preparing.",
    },
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
    category: "라이프스타일",
    schedule: { ko: "매일 인증 · 주 1회 회고", en: "Daily check-in · weekly retro" },
    description: {
      ko: "혼자서는 이어가기 어려운 습관을 함께 만들어 갑니다. 각자 목표를 정하고 매일 인증하며, 주 1회 모여 지난 한 주를 돌아봅니다. 잘 안 된 주도 그대로 이야기하는 것이 규칙입니다. 부담 없이 오래 가는 것을 목표로 합니다.",
      en: "We build habits that are hard to keep alone. Everyone sets a goal, checks in daily, and we meet weekly to look back. Talking about the weeks that didn't go well is part of the rule. The aim is to last, not to be intense.",
    },
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
    category: "어학",
    schedule: { ko: "매주 금 20:00 · 상시", en: "Fri 8:00 PM · ongoing" },
    description: {
      ko: "실제로 말하고 쓰는 시간을 최대한 확보합니다. 문법 설명은 최소로 하고, 주제를 정해 대화하거나 짧은 글을 써 옵니다. 서로의 표현을 고쳐주며 자연스러운 문장을 찾아갑니다. 수준이 달라도 짝을 나눠 진행합니다.",
      en: "We maximize time actually speaking and writing. Grammar explanation is kept minimal; instead we hold themed conversations or bring short pieces of writing. We correct each other toward more natural phrasing. Mixed levels are handled by pairing.",
    },
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
    category: "기획 · PM",
    schedule: { ko: "격주 목 20:00 · 상시", en: "Every other Thu 8:00 PM · ongoing" },
    description: {
      ko: "실무에서 겪는 문제를 사례로 놓고 이야기합니다. 매주 한 명이 진행 중인 과제나 고민을 가져오면 함께 뜯어봅니다. 정답을 찾기보다 다른 조직은 어떻게 푸는지 비교하는 데 의미를 둡니다. 직무 연차와 무관하게 참여할 수 있습니다.",
      en: "We discuss real problems from our own work. Each week someone brings a live project or question and we unpack it together. The value is comparing how different orgs solve it, not finding one right answer. Open regardless of seniority.",
    },
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
    category: "어학",
    schedule: { ko: "매주 금 20:00 · 상시", en: "Fri 8:00 PM · ongoing" },
    description: {
      ko: "실제로 말하고 쓰는 시간을 최대한 확보합니다. 문법 설명은 최소로 하고, 주제를 정해 대화하거나 짧은 글을 써 옵니다. 서로의 표현을 고쳐주며 자연스러운 문장을 찾아갑니다. 수준이 달라도 짝을 나눠 진행합니다.",
      en: "We maximize time actually speaking and writing. Grammar explanation is kept minimal; instead we hold themed conversations or bring short pieces of writing. We correct each other toward more natural phrasing. Mixed levels are handled by pairing.",
    },
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
    category: "AI · ML",
    schedule: { ko: "매주 목 20:00 · 8주 과정", en: "Thu 8:00 PM · 8 weeks" },
    description: {
      ko: "매주 정해진 논문이나 자료를 각자 읽고 모여서 정리한 내용을 나눕니다. 발표자는 돌아가며 맡고, 나머지는 미리 읽어 온 뒤 질문을 준비합니다. 이론만 훑지 않고 코드나 실제 사례로 확인하는 시간을 함께 가집니다. 배경 지식이 부족해도 따라올 수 있도록 첫 주에 기초를 정리하고 시작합니다.",
      en: "Each week we read the assigned paper or material on our own, then meet to share what we took away. Presenters rotate, and everyone comes with questions prepared. We go beyond theory by checking ideas against code or real cases. The first week covers fundamentals so newcomers can keep up.",
    },
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
    category: "북클럽",
    schedule: { ko: "매주 월 21:00 · 책 1권", en: "Mon 9:00 PM · one book" },
    description: {
      ko: "한 권을 정해 매주 정해진 분량을 읽고 모입니다. 요약보다는 읽으면서 들었던 생각과 질문을 나누는 데 집중합니다. 진도를 못 맞춰도 참석할 수 있으며, 논의는 읽은 만큼만 다룹니다. 책은 참여자 투표로 정합니다.",
      en: "We pick one book and read a set portion each week. Discussion focuses on reactions and questions rather than summaries. You can join even if you fall behind — we only discuss what's been read. The book is chosen by vote.",
    },
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
    category: "AI · ML",
    schedule: { ko: "매주 목 20:00 · 8주 과정", en: "Thu 8:00 PM · 8 weeks" },
    description: {
      ko: "매주 정해진 논문이나 자료를 각자 읽고 모여서 정리한 내용을 나눕니다. 발표자는 돌아가며 맡고, 나머지는 미리 읽어 온 뒤 질문을 준비합니다. 이론만 훑지 않고 코드나 실제 사례로 확인하는 시간을 함께 가집니다. 배경 지식이 부족해도 따라올 수 있도록 첫 주에 기초를 정리하고 시작합니다.",
      en: "Each week we read the assigned paper or material on our own, then meet to share what we took away. Presenters rotate, and everyone comes with questions prepared. We go beyond theory by checking ideas against code or real cases. The first week covers fundamentals so newcomers can keep up.",
    },
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
    category: "소프트웨어 개발",
    schedule: { ko: "매주 토 10:00 · 10주 과정", en: "Sat 10:00 AM · 10 weeks" },
    description: {
      ko: "직접 만들어 보면서 배우는 방식입니다. 매주 목표를 정하고 각자 구현한 뒤 코드를 서로 리뷰합니다. 정답을 알려주기보다 왜 그렇게 했는지 설명하는 데 시간을 씁니다. 완성보다 꾸준히 이어가는 것을 우선합니다.",
      en: "We learn by building. Each week has a goal; we implement on our own and review each other's code. More time goes to explaining why than to giving answers. Consistency matters more than finishing.",
    },
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
    category: "알고리즘",
    schedule: { ko: "매주 화·목 21:00 · 상시", en: "Tue & Thu 9:00 PM · ongoing" },
    description: {
      ko: "정해진 문제를 각자 풀어 온 뒤 모여서 풀이를 비교합니다. 같은 문제를 서로 다르게 접근한 지점을 짚어보는 것이 핵심입니다. 시간 복잡도와 더 나은 풀이를 함께 찾고, 막힌 부분은 그 자리에서 같이 봅니다. 난이도는 참여자 수준에 맞춰 조정합니다.",
      en: "We each solve the assigned problems beforehand, then compare approaches together. The point is spotting where our solutions diverged. We review complexity, look for better solutions, and work through blockers on the spot. Difficulty adapts to the group.",
    },
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
    category: "알고리즘",
    schedule: { ko: "매주 화·목 21:00 · 상시", en: "Tue & Thu 9:00 PM · ongoing" },
    description: {
      ko: "정해진 문제를 각자 풀어 온 뒤 모여서 풀이를 비교합니다. 같은 문제를 서로 다르게 접근한 지점을 짚어보는 것이 핵심입니다. 시간 복잡도와 더 나은 풀이를 함께 찾고, 막힌 부분은 그 자리에서 같이 봅니다. 난이도는 참여자 수준에 맞춰 조정합니다.",
      en: "We each solve the assigned problems beforehand, then compare approaches together. The point is spotting where our solutions diverged. We review complexity, look for better solutions, and work through blockers on the spot. Difficulty adapts to the group.",
    },
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
    category: "기타",
    schedule: { ko: "킥오프에서 확정", en: "Set at kickoff" },
    description: {
      ko: "관심사가 비슷한 사람들이 모여 함께 배우고 이야기합니다. 진행 방식은 참여자와 상의해 정하며, 첫 모임에서 목표와 일정을 함께 맞춥니다. 부담 없이 참여할 수 있도록 운영합니다. 자세한 내용은 킥오프에서 안내합니다.",
      en: "People with shared interests gather to learn and talk. The format is decided with participants; goals and schedule are set at the first meeting. It's run to be low-pressure. Details are covered at kickoff.",
    },
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
    category: "라이프스타일",
    schedule: { ko: "매일 인증 · 주 1회 회고", en: "Daily check-in · weekly retro" },
    description: {
      ko: "혼자서는 이어가기 어려운 습관을 함께 만들어 갑니다. 각자 목표를 정하고 매일 인증하며, 주 1회 모여 지난 한 주를 돌아봅니다. 잘 안 된 주도 그대로 이야기하는 것이 규칙입니다. 부담 없이 오래 가는 것을 목표로 합니다.",
      en: "We build habits that are hard to keep alone. Everyone sets a goal, checks in daily, and we meet weekly to look back. Talking about the weeks that didn't go well is part of the rule. The aim is to last, not to be intense.",
    },
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
    category: "소프트웨어 개발",
    schedule: { ko: "매주 토 10:00 · 10주 과정", en: "Sat 10:00 AM · 10 weeks" },
    description: {
      ko: "직접 만들어 보면서 배우는 방식입니다. 매주 목표를 정하고 각자 구현한 뒤 코드를 서로 리뷰합니다. 정답을 알려주기보다 왜 그렇게 했는지 설명하는 데 시간을 씁니다. 완성보다 꾸준히 이어가는 것을 우선합니다.",
      en: "We learn by building. Each week has a goal; we implement on our own and review each other's code. More time goes to explaining why than to giving answers. Consistency matters more than finishing.",
    },
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
    category: "소프트웨어 개발",
    schedule: { ko: "매주 토 10:00 · 10주 과정", en: "Sat 10:00 AM · 10 weeks" },
    description: {
      ko: "직접 만들어 보면서 배우는 방식입니다. 매주 목표를 정하고 각자 구현한 뒤 코드를 서로 리뷰합니다. 정답을 알려주기보다 왜 그렇게 했는지 설명하는 데 시간을 씁니다. 완성보다 꾸준히 이어가는 것을 우선합니다.",
      en: "We learn by building. Each week has a goal; we implement on our own and review each other's code. More time goes to explaining why than to giving answers. Consistency matters more than finishing.",
    },
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
    category: "기타",
    schedule: { ko: "킥오프에서 확정", en: "Set at kickoff" },
    description: {
      ko: "관심사가 비슷한 사람들이 모여 함께 배우고 이야기합니다. 진행 방식은 참여자와 상의해 정하며, 첫 모임에서 목표와 일정을 함께 맞춥니다. 부담 없이 참여할 수 있도록 운영합니다. 자세한 내용은 킥오프에서 안내합니다.",
      en: "People with shared interests gather to learn and talk. The format is decided with participants; goals and schedule are set at the first meeting. It's run to be low-pressure. Details are covered at kickoff.",
    },
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
    category: "AI · ML",
    schedule: { ko: "매주 목 20:00 · 8주 과정", en: "Thu 8:00 PM · 8 weeks" },
    description: {
      ko: "매주 정해진 논문이나 자료를 각자 읽고 모여서 정리한 내용을 나눕니다. 발표자는 돌아가며 맡고, 나머지는 미리 읽어 온 뒤 질문을 준비합니다. 이론만 훑지 않고 코드나 실제 사례로 확인하는 시간을 함께 가집니다. 배경 지식이 부족해도 따라올 수 있도록 첫 주에 기초를 정리하고 시작합니다.",
      en: "Each week we read the assigned paper or material on our own, then meet to share what we took away. Presenters rotate, and everyone comes with questions prepared. We go beyond theory by checking ideas against code or real cases. The first week covers fundamentals so newcomers can keep up.",
    },
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
    category: "데이터",
    schedule: { ko: "매주 수 20:30 · 6주 과정", en: "Wed 8:30 PM · 6 weeks" },
    description: {
      ko: "실제 데이터셋을 놓고 쿼리와 분석을 직접 해보는 방식으로 진행합니다. 이론 설명은 짧게 하고 대부분의 시간을 손으로 만지는 데 씁니다. 매주 과제가 있고, 각자 결과를 공유하며 다른 접근을 배웁니다. 도구 설치와 환경 설정은 첫 주에 함께 끝냅니다.",
      en: "We work hands-on with real datasets — queries and analysis you run yourself. Theory is kept short; most of the time is spent doing. Weekly assignments are shared so everyone sees other approaches. Setup is done together in week one.",
    },
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
    category: "알고리즘",
    schedule: { ko: "매주 화·목 21:00 · 상시", en: "Tue & Thu 9:00 PM · ongoing" },
    description: {
      ko: "정해진 문제를 각자 풀어 온 뒤 모여서 풀이를 비교합니다. 같은 문제를 서로 다르게 접근한 지점을 짚어보는 것이 핵심입니다. 시간 복잡도와 더 나은 풀이를 함께 찾고, 막힌 부분은 그 자리에서 같이 봅니다. 난이도는 참여자 수준에 맞춰 조정합니다.",
      en: "We each solve the assigned problems beforehand, then compare approaches together. The point is spotting where our solutions diverged. We review complexity, look for better solutions, and work through blockers on the spot. Difficulty adapts to the group.",
    },
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
    category: "기획 · PM",
    schedule: { ko: "격주 목 20:00 · 상시", en: "Every other Thu 8:00 PM · ongoing" },
    description: {
      ko: "실무에서 겪는 문제를 사례로 놓고 이야기합니다. 매주 한 명이 진행 중인 과제나 고민을 가져오면 함께 뜯어봅니다. 정답을 찾기보다 다른 조직은 어떻게 푸는지 비교하는 데 의미를 둡니다. 직무 연차와 무관하게 참여할 수 있습니다.",
      en: "We discuss real problems from our own work. Each week someone brings a live project or question and we unpack it together. The value is comparing how different orgs solve it, not finding one right answer. Open regardless of seniority.",
    },
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
    category: "알고리즘",
    schedule: { ko: "매주 화·목 21:00 · 상시", en: "Tue & Thu 9:00 PM · ongoing" },
    description: {
      ko: "정해진 문제를 각자 풀어 온 뒤 모여서 풀이를 비교합니다. 같은 문제를 서로 다르게 접근한 지점을 짚어보는 것이 핵심입니다. 시간 복잡도와 더 나은 풀이를 함께 찾고, 막힌 부분은 그 자리에서 같이 봅니다. 난이도는 참여자 수준에 맞춰 조정합니다.",
      en: "We each solve the assigned problems beforehand, then compare approaches together. The point is spotting where our solutions diverged. We review complexity, look for better solutions, and work through blockers on the spot. Difficulty adapts to the group.",
    },
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
    category: "AI · ML",
    schedule: { ko: "매주 목 20:00 · 8주 과정", en: "Thu 8:00 PM · 8 weeks" },
    description: {
      ko: "매주 정해진 논문이나 자료를 각자 읽고 모여서 정리한 내용을 나눕니다. 발표자는 돌아가며 맡고, 나머지는 미리 읽어 온 뒤 질문을 준비합니다. 이론만 훑지 않고 코드나 실제 사례로 확인하는 시간을 함께 가집니다. 배경 지식이 부족해도 따라올 수 있도록 첫 주에 기초를 정리하고 시작합니다.",
      en: "Each week we read the assigned paper or material on our own, then meet to share what we took away. Presenters rotate, and everyone comes with questions prepared. We go beyond theory by checking ideas against code or real cases. The first week covers fundamentals so newcomers can keep up.",
    },
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
    category: "어학",
    schedule: { ko: "매주 금 20:00 · 상시", en: "Fri 8:00 PM · ongoing" },
    description: {
      ko: "실제로 말하고 쓰는 시간을 최대한 확보합니다. 문법 설명은 최소로 하고, 주제를 정해 대화하거나 짧은 글을 써 옵니다. 서로의 표현을 고쳐주며 자연스러운 문장을 찾아갑니다. 수준이 달라도 짝을 나눠 진행합니다.",
      en: "We maximize time actually speaking and writing. Grammar explanation is kept minimal; instead we hold themed conversations or bring short pieces of writing. We correct each other toward more natural phrasing. Mixed levels are handled by pairing.",
    },
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
    category: "어학",
    schedule: { ko: "매주 금 20:00 · 상시", en: "Fri 8:00 PM · ongoing" },
    description: {
      ko: "실제로 말하고 쓰는 시간을 최대한 확보합니다. 문법 설명은 최소로 하고, 주제를 정해 대화하거나 짧은 글을 써 옵니다. 서로의 표현을 고쳐주며 자연스러운 문장을 찾아갑니다. 수준이 달라도 짝을 나눠 진행합니다.",
      en: "We maximize time actually speaking and writing. Grammar explanation is kept minimal; instead we hold themed conversations or bring short pieces of writing. We correct each other toward more natural phrasing. Mixed levels are handled by pairing.",
    },
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
    category: "AI · ML",
    schedule: { ko: "매주 목 20:00 · 8주 과정", en: "Thu 8:00 PM · 8 weeks" },
    description: {
      ko: "매주 정해진 논문이나 자료를 각자 읽고 모여서 정리한 내용을 나눕니다. 발표자는 돌아가며 맡고, 나머지는 미리 읽어 온 뒤 질문을 준비합니다. 이론만 훑지 않고 코드나 실제 사례로 확인하는 시간을 함께 가집니다. 배경 지식이 부족해도 따라올 수 있도록 첫 주에 기초를 정리하고 시작합니다.",
      en: "Each week we read the assigned paper or material on our own, then meet to share what we took away. Presenters rotate, and everyone comes with questions prepared. We go beyond theory by checking ideas against code or real cases. The first week covers fundamentals so newcomers can keep up.",
    },
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
    category: "AI · ML",
    schedule: { ko: "매주 목 20:00 · 8주 과정", en: "Thu 8:00 PM · 8 weeks" },
    description: {
      ko: "매주 정해진 논문이나 자료를 각자 읽고 모여서 정리한 내용을 나눕니다. 발표자는 돌아가며 맡고, 나머지는 미리 읽어 온 뒤 질문을 준비합니다. 이론만 훑지 않고 코드나 실제 사례로 확인하는 시간을 함께 가집니다. 배경 지식이 부족해도 따라올 수 있도록 첫 주에 기초를 정리하고 시작합니다.",
      en: "Each week we read the assigned paper or material on our own, then meet to share what we took away. Presenters rotate, and everyone comes with questions prepared. We go beyond theory by checking ideas against code or real cases. The first week covers fundamentals so newcomers can keep up.",
    },
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
    category: "북클럽",
    schedule: { ko: "매주 월 21:00 · 책 1권", en: "Mon 9:00 PM · one book" },
    description: {
      ko: "한 권을 정해 매주 정해진 분량을 읽고 모입니다. 요약보다는 읽으면서 들었던 생각과 질문을 나누는 데 집중합니다. 진도를 못 맞춰도 참석할 수 있으며, 논의는 읽은 만큼만 다룹니다. 책은 참여자 투표로 정합니다.",
      en: "We pick one book and read a set portion each week. Discussion focuses on reactions and questions rather than summaries. You can join even if you fall behind — we only discuss what's been read. The book is chosen by vote.",
    },
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
    category: "AI · ML",
    schedule: { ko: "매주 목 20:00 · 8주 과정", en: "Thu 8:00 PM · 8 weeks" },
    description: {
      ko: "매주 정해진 논문이나 자료를 각자 읽고 모여서 정리한 내용을 나눕니다. 발표자는 돌아가며 맡고, 나머지는 미리 읽어 온 뒤 질문을 준비합니다. 이론만 훑지 않고 코드나 실제 사례로 확인하는 시간을 함께 가집니다. 배경 지식이 부족해도 따라올 수 있도록 첫 주에 기초를 정리하고 시작합니다.",
      en: "Each week we read the assigned paper or material on our own, then meet to share what we took away. Presenters rotate, and everyone comes with questions prepared. We go beyond theory by checking ideas against code or real cases. The first week covers fundamentals so newcomers can keep up.",
    },
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
    category: "알고리즘",
    schedule: { ko: "매주 화·목 21:00 · 상시", en: "Tue & Thu 9:00 PM · ongoing" },
    description: {
      ko: "정해진 문제를 각자 풀어 온 뒤 모여서 풀이를 비교합니다. 같은 문제를 서로 다르게 접근한 지점을 짚어보는 것이 핵심입니다. 시간 복잡도와 더 나은 풀이를 함께 찾고, 막힌 부분은 그 자리에서 같이 봅니다. 난이도는 참여자 수준에 맞춰 조정합니다.",
      en: "We each solve the assigned problems beforehand, then compare approaches together. The point is spotting where our solutions diverged. We review complexity, look for better solutions, and work through blockers on the spot. Difficulty adapts to the group.",
    },
    order: 77,
    year: "2024",
  },
];

// ── announcements (공지사항) ──────────────────────────────────────────
export const announcements: Announcement[] = [
  {
    id: "site-renewal",
    tag: "update",
    pinned: true,
    title: { ko: "StudyClub++ 홈페이지 개편 안내", en: "StudyClub++ website renewal" },
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
    title: { ko: "신규 클럽 오픈 — Daily LeetCode", en: "New club open — Daily LeetCode" },
    body: {
      ko: "매일 리트코드 한 문제를 함께 푸는 Daily LeetCode 클럽이 새로 열렸습니다. 클럽은 매달 상시 추가 모집하니 언제든 합류할 수 있어요.",
      en: "A new Daily LeetCode club — one problem a day, together — is now open. Clubs recruit new members every month, so you can join anytime.",
    },
    date: "2026-06-18",
  },
  {
    id: "offline-meetup-bayarea",
    tag: "event",
    title: { ko: "베이 지역 오프라인 밋업 공지", en: "Bay Area offline meetup" },
    body: {
      ko: "베이 지역 스터디원들을 위한 오프라인 네트워킹 밋업을 준비 중입니다. 일정과 장소는 디스코드 공지 채널에서 확정되는 대로 안내드립니다.",
      en: "We're planning an offline networking meetup for Bay Area members. Date and venue will be shared on the Discord announcements channel once confirmed.",
    },
    date: "2026-06-10",
  },
  {
    id: "captain-recruit",
    tag: "notice",
    title: { ko: "캡틴(운영진) 상시 모집", en: "Captains wanted — always open" },
    body: {
      ko: "스터디 초기 세팅을 돕는 캡틴을 상시 모집합니다. 100% 자원봉사이며, 캡틴은 모든 스터디·이벤트에 무료로 참여할 수 있습니다. 관심 있으면 디스코드로 문의하세요.",
      en: "We're always looking for Captains to help set up studies. It's 100% volunteer, and Captains join every study and event for free. Reach out on Discord if you're interested.",
    },
    date: "2026-05-30",
  },
  {
    id: "beyond-prompt-recap",
    tag: "event",
    title: { ko: "Beyond Prompt Engineering 세션 후기", en: "Beyond Prompt Engineering recap" },
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
    title: { ko: "2026 가을 시즌 킥오프 밋업", en: "2026 Fall Season Kickoff Meetup" },
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

export {
  getStudyCrew,
  attendanceRate,
  isHotStudy,
  type AttendanceStatus,
  type CrewStatus,
  type Crew,
  type StudySession,
  type StudyCrewData,
} from "./crew";
