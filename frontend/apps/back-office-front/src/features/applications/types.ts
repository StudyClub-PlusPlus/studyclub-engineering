export type ApplicationQuestion = {
  id: string;
  label: string;
  type: 'TEXT' | 'TEXTAREA' | 'RADIO' | 'CHECKBOX' | 'SELECT';
  options: string[] | null;
  allowOther: boolean | null;
};

export type ApplicationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type ApplicationDecision = Exclude<ApplicationStatus, 'PENDING'>;

export type StudyApplication = {
  id: number;
  recruitmentId: number;
  status: ApplicationStatus;
  applicantName: string;
  discordNickname: string | null;
  email: string | null;
  submittedAt: string;
  previousParticipationCount: number;
  completionRate: number | null;
  availableDays: string[];
  scheduleAgreed: boolean | null;
  answers: Record<string, string | string[]>;
};

/** 변경 예정 API 계약. */
export type ApplicationsResponse = {
  respondentCount: number;
  capacity: number | null;
  /** 정원 초과 승인 정책은 서버가 결정한다. */
  canApprove: boolean;
  approvalBlockedReason: string | null;
  announcementUrl: string | null;
  questions: ApplicationQuestion[];
  /** 선택된 모집 회차의 전체 상태 목록. 페이지네이션 없이 반환한다. */
  applications: StudyApplication[];
};

export type ApplicationDecisionPayload = {
  applicationIds: number[];
  decision: ApplicationDecision;
};
