export type Locale = "ko" | "en";
export type L10n = { ko: string; en: string };

export type StudyStatus = "recruiting" | "ongoing" | "closed";
export type StudyFormat = "online" | "offline" | "hybrid";
export type StudyKind = "study" | "club";
export type StudyTimezone = "KST" | "PST" | "both";

export type StudyCategory =
  | "AI · ML"
  | "알고리즘"
  | "데이터"
  | "소프트웨어 개발"
  | "커리어"
  | "북클럽"
  | "어학"
  | "라이프스타일"
  | "기획 · PM"
  | "비즈니스"
  | "기타";

export type RecruitmentStatus = "open" | "monthly" | "always" | "closed";
export type Recruitment = {
  status: RecruitmentStatus;
  cadence?: "one-time" | "monthly" | "weekly" | "rolling";
  form_url?: string;
  start?: string;
  deadline?: string;
  kickoff?: string;
  capacity?: number;
  note?: L10n;
};

export type ApplicationQuestionType =
  | "text"
  | "textarea"
  | "radio"
  | "checkbox"
  | "select";

export type ApplicationQuestion = {
  id: string;
  label: string;
  type: ApplicationQuestionType;
  required: boolean;
  options?: string[];
  allowOther?: boolean;
  placeholder?: string;
  description?: string;
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
  study_id: number;
  title: L10n;
  summary: L10n;
  description?: L10n;
  status: StudyStatus;
  format: StudyFormat;
  schedule?: L10n;
  timezone?: StudyTimezone;
  lead?: string;
  seats?: { total: number; taken: number };
  discord_url?: string;
  driveUrl?: string;
  startAt?: string;
  recruit_url?: string;
  order?: number;
  year?: string;
  date?: string;
  publish_at?: string;
  published?: boolean;
  program?: { id: string; title: L10n; kind: StudyKind };
  channelDeleted?: boolean;
  image?: string;
  host?: { name: L10n; credential?: L10n; avatar?: string };
  kind?: StudyKind;
  category?: string;
  goal?: L10n;
  topics?: L10n[];
  how_it_works?: L10n[];
  audience?: L10n;
  duration?: L10n;
  weeks?: StudyWeek[];
  recruitment?: Recruitment;
  applicationForm?: ApplicationQuestion[];
  applicationFormTitle?: string;
  applicationFormDescription?: string;
  reviews?: StudyReview[];
  stats?: StudyStats;
  past_participants?: L10n[];
};

export type StudyProgram = NonNullable<Study["program"]> & { cohorts: number };

export type RecruitState = "apply" | "closed";
export type PublishState = "draft" | "live";
export type LifecycleState = "DRAFT" | "OPEN" | "ONGOING" | "ENDED" | "CLOSED";
