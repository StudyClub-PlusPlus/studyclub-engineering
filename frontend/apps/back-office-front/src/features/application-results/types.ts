import type { ApiQuestion } from '@/features/application-form/types';

export type ResultQuestion = Pick<ApiQuestion, 'id' | 'label' | 'type' | 'options' | 'allowOther'>;

export interface ApplicationResult {
  id: number;
  recruitmentId: number;
  discordNickname: string | null;
  email: string | null;
  answers: Record<string, string | string[]>;
}

export interface ApplicationResultsResponse {
  respondentCount: number;
  questions: ResultQuestion[];
  applications: ApplicationResult[];
}
