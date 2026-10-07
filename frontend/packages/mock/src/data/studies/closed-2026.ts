import type { StudyDraft } from './helpers';

export const STUDIES_CLOSED_2026: StudyDraft[] = [
  // ── 이전(종료) · 2026 ───────────────────────────────────────────────
  {
    id: "business-articles",
    kind: "study",
    title: { ko: "Business Articles", en: "Business Articles" },
    summary: {
      ko: "비즈니스 아티클을 함께 읽는 스터디.",
      en: "Reading business articles together.",
    },
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
    summary: {
      ko: '"AI Engineering" 북클럽.',
      en: '"AI Engineering" book club.',
    },
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
    summary: {
      ko: "데이터 분석을 위한 SQL 스터디.",
      en: "SQL for data analysis.",
    },
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
    summary: {
      ko: "데이터베이스 기초 2트랙.",
      en: "Two-track database fundamentals.",
    },
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
    summary: {
      ko: "AWS Cloud Practitioner 자격 준비.",
      en: "Prep for the AWS Cloud Practitioner cert.",
    },
    status: "closed",
    format: "online",
    category: "소프트웨어 개발",
    schedule: {
      ko: "매주 토 10:00 · 10주 과정",
      en: "Sat 10:00 AM · 10 weeks",
    },
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
    summary: {
      ko: "바이브 코딩 입문 3기.",
      en: "Vibe coding basics, cohort 3.",
    },
    status: "closed",
    format: "online",
    category: "소프트웨어 개발",
    schedule: {
      ko: "매주 토 10:00 · 10주 과정",
      en: "Sat 10:00 AM · 10 weeks",
    },
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
    summary: {
      ko: "리트코드 150선 완주 (2026).",
      en: "Grinding LeetCode 150 (2026).",
    },
    status: "closed",
    format: "online",
    category: "알고리즘",
    schedule: {
      ko: "매주 화·목 21:00 · 상시",
      en: "Tue & Thu 9:00 PM · ongoing",
    },
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
    schedule: {
      ko: "매주 토 10:00 · 10주 과정",
      en: "Sat 10:00 AM · 10 weeks",
    },
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
    title: {
      ko: "스터디 클럽 개선 프로젝트",
      en: "Study Club Improvement Project",
    },
    summary: {
      ko: "스터디 클럽 운영을 개선하는 프로젝트.",
      en: "A project to improve how the study club runs.",
    },
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
    summary: {
      ko: "합격을 부르는 이력서 만들기.",
      en: "Crafting a resume that lands offers.",
    },
    status: "closed",
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
    schedule: {
      ko: "매주 토 10:00 · 10주 과정",
      en: "Sat 10:00 AM · 10 weeks",
    },
    timezone: "PST",
    description: {
      ko: "직접 만들어 보면서 배우는 방식입니다. 매주 목표를 정하고 각자 구현한 뒤 코드를 서로 리뷰합니다. 정답을 알려주기보다 왜 그렇게 했는지 설명하는 데 시간을 씁니다. 완성보다 꾸준히 이어가는 것을 우선합니다.",
      en: "We learn by building. Each week has a goal; we implement on our own and review each other's code. More time goes to explaining why than to giving answers. Consistency matters more than finishing.",
    },
    title: { ko: "보안 스터디", en: "Security Study" },
    host: {
      name: { ko: "P. 문", en: "P. Moon" },
      credential: {
        ko: "現 보안 엔지니어 · 8년차",
        en: "Security Engineer · 8 yrs",
      },
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
    duration: {
      ko: "킥오프 포함 총 10주",
      en: "10 weeks total (incl. kickoff)",
    },
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
        title: { ko: "본 스터디 진행", en: "Main study meetings" },
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
];
