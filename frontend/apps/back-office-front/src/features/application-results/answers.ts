import type { ApplicationResult, ResultQuestion } from './types';

export function answerValues(value: string | string[] | undefined): string[] {
  return (Array.isArray(value) ? value : value == null ? [] : [value]).filter((answer) => answer.trim() !== '');
}

export function answerText(value: string | string[] | undefined): string {
  return answerValues(value).join(', ') || '—';
}
export function summarizeAnswers(question: ResultQuestion, applications: ApplicationResult[]) {
  const answers = applications
    .map((application) => answerValues(application.answers[question.id]))
    .filter((values) => values.length > 0);
  const choice = ['RADIO', 'CHECKBOX', 'SELECT'].includes(question.type);
  const options = question.options ?? [];
  const tallies = options.map((option) => ({
    option,
    count: answers.filter((values) => values.includes(option)).length,
  }));
  return {
    count: answers.length,
    choice,
    tallies,
    maximum: Math.max(1, ...tallies.map(({ count }) => count)),
    texts: choice ? answers.flat().filter((answer) => !options.includes(answer)) : answers.flat(),
  };
}
