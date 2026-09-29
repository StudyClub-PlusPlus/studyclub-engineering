import type { StudyDraft } from './helpers';

export const STUDIES_ONGOING: StudyDraft[] = [
  // ── 진행중 ──────────────────────────────────────────────────────────
  {
    id: "claude-code-source-study",
    kind: "study",
    title: {
      ko: "Claude Code 소스코드 스터디",
      en: "Claude Code Source Code Study",
    },
    host: {
      name: { ko: "T. 강", en: "T. Kang" },
      credential: {
        ko: "시니어 SWE · 오픈소스 컨트리뷰터",
        en: "Senior SWE · OSS contributor",
      },
    },
    summary: {
      ko: "화요모임 ~8명, 토요저녁 ~12명이 꾸준히 참석 중.",
      en: "~8 at Tuesday meetings, ~12 at Saturday evenings, going strong.",
    },
    status: "ongoing",
    format: "hybrid",
    category: "소프트웨어 개발",
    schedule: {
      ko: "매주 토 10:00 · 10주 과정",
      en: "Sat 10:00 AM · 10 weeks",
    },
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
    title: {
      ko: "시스템 디자인 인터뷰 스터디",
      en: "System Design Interview Study",
    },
    summary: {
      ko: "시스템 디자인 인터뷰 스터디 진행 중.",
      en: "System design interview study, in progress.",
    },
    status: "ongoing",
    format: "online",
    category: "커리어",
    schedule: {
      ko: "격주 수 20:00 · 4회",
      en: "Every other Wed 8:00 PM · 4 meetings",
    },
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
    title: {
      ko: "DDIA 2판 (Designing Data-Intensive Applications)",
      en: "DDIA 2nd Edition",
    },
    host: {
      name: { ko: "S. 서", en: "S. Seo" },
      credential: {
        ko: "現 시니어 백엔드 · 분산시스템",
        en: "Senior Backend · distributed systems",
      },
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
        author: {
          ko: "익명 · 데이터 엔지니어",
          en: "Anonymous · Data Engineer",
        },
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
      {
        ko: "박OO / 데이터 엔지니어 / Seoul",
        en: "Park** / Data Engineer / Seoul",
      },
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
    schedule: {
      ko: "매일 인증 · 주 1회 회고",
      en: "Daily check-in · weekly retro",
    },
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
];
