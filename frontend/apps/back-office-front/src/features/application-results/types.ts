import type { ApiQuestion } from '@/features/application-form/types';
import type { ApplicationsResponse, StudyApplication } from '@/features/applications/types';

// 신청자 탭(ApplicationsResponse)과 같은 응답이다. 따로 정의하지 않고 필요한 칸만 고른다.
export type ResultQuestion = Pick<ApiQuestion, 'id' | 'label' | 'type' | 'options' | 'allowOther'>;

export type ApplicationResult = Pick<StudyApplication, 'id' | 'recruitmentId' | 'discordNickname' | 'email' | 'answers'>;

export type ApplicationResultsResponse = Pick<ApplicationsResponse, 'respondentCount'> & {
  questions: ResultQuestion[];
  applications: ApplicationResult[];
};
