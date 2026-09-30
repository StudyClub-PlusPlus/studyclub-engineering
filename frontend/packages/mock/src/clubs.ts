import type { L10n, Study } from "./index";

/**
 * 클럽형(`kind: "club"`) 스터디 시드 — 화면에서 뺀 데이터를 보관만 한다.
 *
 * 사이트·콘솔 화면은 study 종류만 보여 주기로 해서 `index.ts` 의 `STUDIES_SEED` 에서 분리했다.
 * 여기 데이터는 `studies` 에 들어가지 않고, 패키지 밖으로 export 하지도 않는다.
 * 클럽을 다시 노출하게 되면 `STUDIES_SEED` 에 합친다.
 */
type StudyDraft = Omit<Study, "study_id">;

/** 매달 기수를 여는 클럽 — 1기(7월) · 2기(8월) · 3기(9월). */
const MONTHLY_CLUB_GENS = [
  {
    g: 1,
    month: 7,
    monthEn: "Jul",
    status: "closed" as const,
    date: "2026-07-01",
    deadline: "2026-06-28",
  },
  {
    g: 2,
    month: 8,
    monthEn: "Aug",
    status: "closed" as const,
    date: "2026-08-01",
    deadline: "2026-07-28",
  },
  {
    g: 3,
    month: 9,
    monthEn: "Sep",
    status: "ongoing" as const,
    date: "2026-09-01",
    deadline: "2026-08-28",
  },
] as const;

function monthlyClubCohorts(
  id: string,
  title: L10n,
  shared: Omit<Study, "id" | "study_id" | "title" | "status" | "date" | "year">,
): StudyDraft[] {
  return MONTHLY_CLUB_GENS.map((c) => ({
    ...shared,
    id: `${id}-g${c.g}`,
    title: {
      ko: `${title.ko} ${c.g}기 (${c.month}월)`,
      en: `${title.en} ${c.g} (${c.monthEn})`,
    },
    status: c.status,
    date: c.date,
    year: "2026",
    recruitment: {
      ...(shared.recruitment ?? {}),
      status: c.status === "closed" ? "closed" : "monthly",
      cadence: "monthly" as const,
      deadline: c.deadline,
    },
  }));
}

export const CLUB_STUDIES_SEED: StudyDraft[] = [
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
      deadline: "2026-09-30",
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
      deadline: "2026-09-30",
      cadence: "monthly",
      form_url: "https://forms.gle/4RpAXWfWCVNVmRAU8",
      note: { ko: "매달 추가 모집합니다", en: "New members recruited monthly" },
    },
    order: 5,
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
      deadline: "2026-09-30",
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
