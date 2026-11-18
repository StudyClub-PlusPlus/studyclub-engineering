export type ApiMyApplication = {
  applied: boolean;
  applicationId: number | null;
  submittedAt: string | null;
  withdrawn: boolean;
};

export type SubmitApplicationPayload = {
  discordNickname: string;
  availableDays: string[];
  scheduleAgreed?: boolean;
  answers: Record<string, string | string[]>;
};

