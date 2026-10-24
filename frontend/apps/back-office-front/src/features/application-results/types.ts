import type { ApiQuestion } from '@/features/application-form/types';

// GET …/applications 응답에서 이 탭이 쓰는 칸만 둔다. 백오피스 신청 승인 화면은 기획상 빠졌다.
export type ResultQuestion = Pick<ApiQuestion, 'id' | 'label' | 'type' | 'options' | 'allowOther'>;

export type ApplicationResult = {
  id: number;
  recruitmentId: number;
  discordNickname: string | null;
  email: string | null;
  answers: Record<string, string | string[]>;
};

export type ApplicationResultsResponse = {
  respondentCount: number;
  questions: ResultQuestion[];
  applications: ApplicationResult[];
};
