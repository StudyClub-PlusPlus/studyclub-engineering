import { monthlyClubCohorts, type StudyDraft } from './helpers';

export const STUDIES_RECRUITING: StudyDraft[] = [
  // ── 예정(모집중) ────────────────────────────────────────────────────
  {
    id: "ai-paper-study",
    kind: "study",
    title: { ko: "AI 논문 스터디", en: "AI Paper Study" },
    host: {
      name: { ko: "H. 김", en: "H. Kim" },
      credential: {
        ko: "現 AI 리서처 · 논문 리뷰어",
        en: "AI Researcher · paper reviewer",
      },
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
      deadline: "2026-12-31",
      cadence: "one-time",
      form_url: "https://forms.gle/Zynn7eGdjQZQLUEx9",
    },
    order: 1,
    year: "2026",
  },
  {
    id: "pytorch-ai-coding",
    kind: "study",
    title: {
      ko: "PyTorch AI 실전 코딩 스터디",
      en: "PyTorch AI Hands-on Coding",
    },
    host: {
      name: { ko: "J. 신", en: "J. Shin" },
      credential: { ko: "現 빅테크 MLE · 10년차", en: "Big-tech MLE · 10 yrs" },
    },
    summary: {
      ko: "Deep Learning·Attention·GPT 개념을 PyTorch로 구현 (10/15 시작).",
      en: "Implement deep learning, attention, and GPT concepts in PyTorch (starts 10/15).",
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
      deadline: "2026-10-10",
      cadence: "one-time",
      form_url: "https://forms.gle/CLEr7JzvjwxkdTGP8",
      kickoff: "10/15 시작",
    },
    order: 2,
    year: "2026",
  },
  {
    id: "python-pandas-ml-coding",
    kind: "study",
    title: {
      ko: "Python(Pandas) & ML(Numpy) 실전 코딩",
      en: "Python (Pandas) & ML (Numpy) Coding",
    },
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
      deadline: "2026-10-15",
      cadence: "one-time",
      form_url: "https://forms.gle/Xj2u6v3npRSrzSV19",
    },
    order: 3,
    year: "2026",
  },
  {
    id: "early-bird",
    kind: "club",
    title: { ko: "얼리버드 4기 (10월)", en: "Early Bird 4 (Oct)" },
    host: {
      name: { ko: "M. 박", en: "M. Park" },
      credential: {
        ko: "얼리버드 클럽장 · 3년째 운영",
        en: "Early Bird host · 3rd year",
      },
    },
    summary: {
      ko: "아침에 일찍 일어나 공부·자기개발 (매월 추가모집).",
      en: "Wake up early to study and grow yourself (new members monthly).",
    },
    status: "recruiting",
    format: "online",
    category: "라이프스타일",
    schedule: {
      ko: "매일 인증 · 주 1회 회고",
      en: "Daily check-in · weekly retro",
    },
    timezone: "KST",
    description: {
      ko: "혼자서는 이어가기 어려운 습관을 함께 만들어 갑니다. 각자 목표를 정하고 매일 인증하며, 주 1회 모여 지난 한 주를 돌아봅니다. 잘 안 된 주도 그대로 이야기하는 것이 규칙입니다. 부담 없이 오래 가는 것을 목표로 합니다.",
      en: "We build habits that are hard to keep alone. Everyone sets a goal, checks in daily, and we meet weekly to look back. Talking about the weeks that didn't go well is part of the rule. The aim is to last, not to be intense.",
    },
    recruit_url: "https://forms.gle/Ub9YHsQjuhyw7o166",
    recruitment: {
      status: "monthly",
      deadline: "2026-12-31",
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
    title: { ko: "WeeklyX 4기 (10월)", en: "WeeklyX 4 (Oct)" },
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
    schedule: {
      ko: "매일 인증 · 주 1회 회고",
      en: "Daily check-in · weekly retro",
    },
    timezone: "both",
    description: {
      ko: "혼자서는 이어가기 어려운 습관을 함께 만들어 갑니다. 각자 목표를 정하고 매일 인증하며, 주 1회 모여 지난 한 주를 돌아봅니다. 잘 안 된 주도 그대로 이야기하는 것이 규칙입니다. 부담 없이 오래 가는 것을 목표로 합니다.",
      en: "We build habits that are hard to keep alone. Everyone sets a goal, checks in daily, and we meet weekly to look back. Talking about the weeks that didn't go well is part of the rule. The aim is to last, not to be intense.",
    },
    recruit_url: "https://forms.gle/4RpAXWfWCVNVmRAU8",
    recruitment: {
      status: "monthly",
      deadline: "2026-12-31",
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
      credential: {
        ko: "시니어 SWE · 글쓰기 멘토",
        en: "Senior SWE · writing mentor",
      },
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
      deadline: "2026-12-31",
      cadence: "one-time",
      form_url: "https://forms.gle/SMQeimGZKMQ2Zbeq8",
    },
    order: 6,
    year: "2026",
  },
  {
    id: "system-design-interview",
    kind: "study",
    title: {
      ko: "System Design Interview Study",
      en: "System Design Interview Study",
    },
    host: {
      name: { ko: "K. 한", en: "K. Han" },
      credential: {
        ko: "現 빅테크 스태프 엔지니어",
        en: "Big-tech Staff Engineer",
      },
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
      deadline: "2026-12-31",
      cadence: "one-time",
      form_url: "https://forms.gle/QD54d719pDyGcuLF8",
    },
    order: 7,
    year: "2026",
  },
  {
    id: "daily-leetcode",
    kind: "club",
    title: { ko: "Daily LeetCode 4기 (10월)", en: "Daily LeetCode 4 (Oct)" },
    host: {
      name: { ko: "R. 오", en: "R. Oh" },
      credential: {
        ko: "알고리즘 코치 · ICPC 출신",
        en: "Algorithm coach · ex-ICPC",
      },
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
      deadline: "2026-12-31",
      cadence: "monthly",
      form_url: "https://forms.gle/7tqPWZXf8m4eSz2t5",
      note: { ko: "매달 추가 모집합니다", en: "New members recruited monthly" },
    },
    order: 8,
    year: "2026",
  },

  // ── 월별 클럽 기수 (7·8·9월). 모집중 카드는 위에 그대로 두고, 기수는 참여 이력·출석부용.
  ...monthlyClubCohorts(
    "early-bird",
    { ko: "얼리버드", en: "Early Bird" },
    {
      kind: "club",
      host: {
        name: { ko: "M. 박", en: "M. Park" },
        credential: {
          ko: "얼리버드 클럽장 · 3년째 운영",
          en: "Early Bird host · 3rd year",
        },
      },
      summary: {
        ko: "아침에 일찍 일어나 공부·자기개발.",
        en: "Wake up early to study and grow yourself.",
      },
      format: "online",
      category: "라이프스타일",
      schedule: {
        ko: "매일 인증 · 주 1회 회고",
        en: "Daily check-in · weekly retro",
      },
      description: {
        ko: "혼자서는 이어가기 어려운 습관을 함께 만들어 갑니다. 각자 목표를 정하고 매일 인증하며, 주 1회 모여 지난 한 주를 돌아봅니다.",
        en: "We build habits that are hard to keep alone. Everyone sets a goal, checks in daily, and we meet weekly to look back.",
      },
      recruit_url: "https://forms.gle/Ub9YHsQjuhyw7o166",
    },
  ),
  ...monthlyClubCohorts(
    "weeklyx",
    { ko: "WeeklyX", en: "WeeklyX" },
    {
      kind: "club",
      host: {
        name: { ko: "Y. 정", en: "Y. Jung" },
        credential: { ko: "WeeklyX 클럽장", en: "WeeklyX host" },
      },
      summary: {
        ko: "일주일 X시간, 꾸준히 공부하기.",
        en: "Study X hours a week, consistently.",
      },
      format: "online",
      category: "라이프스타일",
      schedule: {
        ko: "매일 인증 · 주 1회 회고",
        en: "Daily check-in · weekly retro",
      },
      description: {
        ko: "혼자서는 이어가기 어려운 습관을 함께 만들어 갑니다. 각자 목표를 정하고 매일 인증하며, 주 1회 모여 지난 한 주를 돌아봅니다.",
        en: "We build habits that are hard to keep alone. Everyone sets a goal, checks in daily, and we meet weekly to look back.",
      },
      recruit_url: "https://forms.gle/4RpAXWfWCVNVmRAU8",
    },
  ),
  ...monthlyClubCohorts(
    "daily-leetcode",
    { ko: "Daily LeetCode", en: "Daily LeetCode" },
    {
      kind: "club",
      host: {
        name: { ko: "R. 오", en: "R. Oh" },
        credential: {
          ko: "알고리즘 코치 · ICPC 출신",
          en: "Algorithm coach · ex-ICPC",
        },
      },
      summary: {
        ko: "리트코드 1일 1문제 챌린지.",
        en: "One LeetCode problem a day challenge.",
      },
      format: "online",
      category: "AI · ML",
      schedule: { ko: "매주 목 20:00 · 4주 과정", en: "Thu 8:00 PM · 4 weeks" },
      description: {
        ko: "매일 리트코드 한 문제를 풀고 주 1회 모여 풀이를 나눕니다.",
        en: "Solve one LeetCode problem a day and meet weekly to share solutions.",
      },
      recruit_url: "https://forms.gle/7tqPWZXf8m4eSz2t5",
    },
  ),
];
