import type { ApplicationQuestionType } from '@studyclub/mock';

export const QUESTION_TYPES: ApplicationQuestionType[] = ['text', 'textarea', 'radio', 'checkbox', 'select'];

export const TYPE_LABEL: Record<ApplicationQuestionType, string> = {
  text: '단답형',
  textarea: '장문형',
  radio: '객관식',
  checkbox: '체크박스',
  select: '드롭다운',
};

export function needsOptions(type: ApplicationQuestionType) {
  return type === 'radio' || type === 'checkbox' || type === 'select';
}

export function allowsOther(type: ApplicationQuestionType) {
  return type === 'radio' || type === 'checkbox';
}
