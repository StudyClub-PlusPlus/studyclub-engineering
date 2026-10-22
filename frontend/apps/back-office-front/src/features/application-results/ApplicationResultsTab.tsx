'use client';

import { Button, Segmented } from '@studyclub/ui';

import { useApplicationResults } from './queries';
import { QuestionSummary } from './QuestionSummary';
import { RespondentsTable } from './RespondentsTable';
import { ApiError } from '@/lib/http';
import { useUrlState } from '@/lib/use-url-state';

const DEFAULTS = { resultsView: 'summary', recruitmentId: '' };
const ALLOWED = { resultsView: ['summary', 'individual'] };
const ERROR_MESSAGES: Record<number, string> = {
  401: '로그인이 필요합니다.',
  403: '이 스터디의 신청 결과를 볼 권한이 없습니다.',
  404: '스터디를 찾을 수 없습니다.',
  422: '이 스터디의 모집 회차가 아닙니다.',
};
const VIEW_OPTIONS = [
  { value: 'summary', label: '질문별' },
  { value: 'individual', label: '응답자별' },
];

export function ApplicationResultsTab({
  studyId,
  canEditForm,
  onEditForm,
}: {
  studyId: number;
  canEditForm: boolean;
  onEditForm: () => void;
}) {
  const [filters, setFilters] = useUrlState(DEFAULTS, ALLOWED);
  const query = useApplicationResults(studyId, filters.recruitmentId || undefined);
  if (query.isPending)
    return (
      <p role='status' className='py-10 text-center text-sm text-fg-muted'>
        불러오는 중
      </p>
    );
  if (query.error) {
    const status = query.error instanceof ApiError ? query.error.status : undefined;
    const message = ERROR_MESSAGES[status ?? 0] ?? '결과를 불러오지 못했습니다. 다시 시도해 주세요.';
    return (
      <div className='py-10 text-center'>
        <p role='alert' className='text-sm text-fg-secondary'>
          {message}
        </p>
        {![401, 403, 404, 422].includes(status ?? 0) && (
          <Button variant='secondary' className='mt-3' onClick={() => void query.refetch()}>
            다시 시도
          </Button>
        )}
        {status === 422 && (
          <Button variant='secondary' className='mt-3' onClick={() => setFilters({ recruitmentId: '' })}>
            현재 모집 회차 보기
          </Button>
        )}
      </div>
    );
  }
  const data = query.data;
  if (data.questions.length === 0)
    return (
      <div className='rounded-card border border-dashed border-border px-4 py-6 text-center text-sm text-fg-muted'>
        <p>이 스터디는 신청 폼에 추가 질문이 없습니다.</p>
        {canEditForm && (
          <Button variant='secondary' className='mt-3' onClick={onEditForm}>
            신청 폼에서 질문 추가
          </Button>
        )}
      </div>
    );
  return (
    <div className='min-w-0 space-y-5'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <p className='text-sm text-fg-muted'>
          응답자 <span className='tnum font-bold text-fg'>{data.respondentCount}</span>명
        </p>
        <Segmented
          options={VIEW_OPTIONS}
          value={filters.resultsView}
          onChange={(resultsView) => setFilters({ resultsView })}
          shape='pill'
        />
      </div>
      {data.applications.length === 0 ? (
        <p className='rounded-card border border-dashed border-border px-4 py-6 text-center text-sm text-fg-muted'>
          아직 들어온 신청이 없습니다.
        </p>
      ) : filters.resultsView === 'summary' ? (
        <div className='space-y-4'>
          {data.questions.map((question, index) => (
            <QuestionSummary key={question.id} question={question} index={index} applications={data.applications} />
          ))}
        </div>
      ) : (
        <RespondentsTable data={data} />
      )}
    </div>
  );
}
