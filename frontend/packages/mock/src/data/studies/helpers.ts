import type { L10n, Study } from '../../types';

export type StudyDraft = Omit<Study, "study_id">;

/** 매달 기수를 여는 클럽 — 1기(7월) · 2기(8월) · 3기(9월). */
export const MONTHLY_CLUB_GENS = [
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

export function monthlyClubCohorts(
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
