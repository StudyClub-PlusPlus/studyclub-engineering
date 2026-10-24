import { summarizeAnswers } from './answers';
import type { ApplicationResult, ResultQuestion } from './types';
import { TYPE_LABEL } from '@/features/application-form/question';

export function QuestionSummary({
  question,
  index,
  applications,
}: {
  question: ResultQuestion;
  index: number;
  applications: ApplicationResult[];
}) {
  const { count: answeredCount, choice, tallies, maximum, texts } = summarizeAnswers(question, applications);
  const type = question.type.toLowerCase() as keyof typeof TYPE_LABEL;
  return (
    <section className='card min-w-0 p-5' aria-label={`${index + 1}. ${question.label || '(제목 없음)'}`}>
      <div className='mb-4 flex flex-wrap items-start justify-between gap-2'>
        <h3 className='min-w-0 break-words font-semibold'>
          {index + 1}. {question.label || '(제목 없음)'}
        </h3>
        <span className='text-sm text-fg-muted'>
          {TYPE_LABEL[type] ?? '질문'} · {answeredCount}명 응답
        </span>
      </div>
      {answeredCount === 0 ? (
        <p className='text-sm text-fg-muted'>아직 답이 없습니다.</p>
      ) : (
        <>
          {choice && (
            <ul className='space-y-2'>
              {tallies.map(({ option, count }) => (
                <li key={option} className='flex items-center gap-3'>
                  <span className='w-32 shrink-0 truncate text-sm text-fg-secondary' title={option}>
                    {option}
                  </span>
                  <span aria-hidden='true' className='h-2.5 min-w-0 flex-1 overflow-hidden rounded-pill bg-surface-2'>
                    <span
                      className='block h-full rounded-pill bg-brand'
                      style={{ width: `${(count / maximum) * 100}%` }}
                    />
                  </span>
                  <span className='tnum shrink-0 text-sm font-semibold'>{count}명</span>
                </li>
              ))}
            </ul>
          )}
          {texts.length > 0 && (
            <div className={choice ? 'mt-4' : undefined}>
              {choice && (
                <h4 className='mb-2 text-sm font-semibold'>
                  {question.allowOther ? '기타 · 현재 보기에 없는 답변' : '현재 보기에 없는 답변'}
                </h4>
              )}
              <ol className='list-decimal space-y-2 pl-5 text-sm text-fg-secondary'>
                {texts.map((answer, answerIndex) => (
                  <li key={answerIndex} className='whitespace-pre-wrap break-words'>
                    {answer}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </>
      )}
    </section>
  );
}
