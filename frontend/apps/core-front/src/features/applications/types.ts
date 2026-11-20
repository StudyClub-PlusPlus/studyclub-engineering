export type ApiMyApplication = {
  applied: boolean;
  applicationId: number | null;
  submittedAt: string | null;
};

export type SubmitApplicationPayload = {
  discordNickname: string;
  availableDays: string[];
  scheduleAgreed?: boolean;
  answers: Record<string, string | string[]>;
};

