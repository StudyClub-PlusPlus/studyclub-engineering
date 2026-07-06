// Study(스터디) 도메인 모델.
import type { L10n } from "./common";

export type StudyStatus = "recruiting" | "ongoing" | "closed";
export type StudyFormat = "online" | "offline" | "hybrid";
export type StudyKind = "study" | "club";

export type RecruitmentStatus = "open" | "monthly" | "always" | "closed";
export type Recruitment = {
  status: RecruitmentStatus;
  cadence?: "one-time" | "monthly" | "weekly" | "rolling";
  form_url?: string;
  deadline?: string;
  kickoff?: string;
  capacity?: number;
  note?: L10n;
};
export type StudyWeek = { label: L10n; title: L10n };
export type StudyReview = { text: L10n; author?: L10n };
export type StudyStats = {
  participants: number;
  completion_rate?: number;
  demographics?: { label: L10n; count: number }[];
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
  kind?: StudyKind;
  category?: string;
  goal?: L10n;
  topics?: L10n[];
  how_it_works?: L10n[];
  audience?: L10n;
  duration?: L10n;
  weeks?: StudyWeek[];
  recruitment?: Recruitment;
  reviews?: StudyReview[];
  stats?: StudyStats;
  past_participants?: L10n[];
};

export const STUDY_KIND_LABEL: Record<StudyKind, L10n> = {
  study: { ko: "스터디", en: "Study" },
  club: { ko: "클럽 (주기)", en: "Club (recurring)" },
};

export const RECRUITMENT_STATUS_LABEL: Record<RecruitmentStatus, L10n> = {
  open: { ko: "모집 중", en: "Open" },
  monthly: { ko: "매달 모집", en: "Monthly" },
  always: { ko: "상시 모집", en: "Always open" },
  closed: { ko: "모집 마감", en: "Closed" },
};

export const STUDY_STATUS_LABEL: Record<StudyStatus, L10n> = {
  recruiting: { ko: "모집 중", en: "Recruiting" },
  ongoing: { ko: "진행 중", en: "Ongoing" },
  closed: { ko: "종료", en: "Closed" },
};

export const STUDY_FORMAT_LABEL: Record<StudyFormat, L10n> = {
  online: { ko: "온라인", en: "Online" },
  offline: { ko: "오프라인", en: "Offline" },
  hybrid: { ko: "하이브리드", en: "Hybrid" },
};

export function isRecruiting(study: Study): boolean {
  return study.status === "recruiting";
}

/** 남은 자리 (seats 없으면 null). */
export function seatsLeft(study: Study): number | null {
  if (!study.seats) return null;
  return Math.max(0, study.seats.total - study.seats.taken);
}

export function isFull(study: Study): boolean {
  return seatsLeft(study) === 0;
}

/** 정렬용 비교자: order 우선, 없으면 title.ko. */
export function byStudyOrder(a: Study, b: Study): number {
  return (a.order ?? 999) - (b.order ?? 999) || a.title.ko.localeCompare(b.title.ko);
}
