import type { ApplicationQuestionType } from '@studyclub/mock';

export type ApiQuestion = {
  id: string;
  label: string;
  type: Uppercase<ApplicationQuestionType>;
  required: boolean;
  description?: string | null;
  placeholder?: string | null;
  options?: string[] | null;
  allowOther?: boolean | null;
};

export type ApplicationFormResponse = {
  studyId: number;
  title: string;
  description: string | null;
  questions: ApiQuestion[];
};
