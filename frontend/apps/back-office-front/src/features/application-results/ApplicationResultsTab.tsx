'use client';

import { Button, Segmented } from '@studyclub/ui';

import { useApplicationResults } from '@/features/application-results/queries';
import { QuestionSummary } from '@/features/application-results/QuestionSummary';
import { RespondentsTable } from '@/features/application-results/RespondentsTable';
import { ApiError } from '@/lib/http';
import { useUrlState } from '@/lib/use-url-state';

const DEFAULTS = { resultsView: 'summary', recruitmentId: '' };
const ALLOWED = { resultsView: ['summary', 'individual'] };
const ERROR_MESSAGES: Record<number, string> = {
  400: '모집 회차를 확인해 주세요.',
  401: '로그인이 필요합니다.',
  403: '이 스터디의 신청 결과를 볼 권한이 없습니다.',
  404: '스터디를 찾을 수 없습니다.',
  422: '이 스터디의 모집 회차가 아닙니다.',
};
const VIEW_OPTIONS = [
  { value: 'summary', label: '질문별' },
  { value: 'individual', label: '응답자별' },
];

export function ApplicationResultsTab({ studyId, onEditForm }: { studyId: number; onEditForm: () => void }) {
  const [filters, setFilters] = useUrlState(DEFAULTS, ALLOWED);
  const recruitmentId = filters.recruitmentId;
  const validRecruitment =
    recruitmentId === '' ||
    (/^[1-9]\d{0,18}$/.test(recruitmentId) && (recruitmentId.length < 19 || recruitmentId <= '9223372036854775807'));
  const query = useApplicationResults(studyId, recruitmentId || undefined, validRecruitment);
  if (!validRecruitment)
    return (
      <div className='py-10 text-center'>
        <p role='alert' className='type-body-sm text-fg-secondary'>
          모집 회차를 확인해 주세요.
        </p>
        <Button variant='secondary' className='mt-3' onClick={() => setFilters({ recruitmentId: '' })}>
          현재 모집 회차 보기
        </Button>
      </div>
    );
  if (query.isPending)
    return (
      <p role='status' className='py-10 text-center type-body-sm text-fg-muted'>
        불러오는 중
      </p>
    );
  const status = query.error instanceof ApiError ? query.error.status : undefined;
  const known = status !== undefined && status in ERROR_MESSAGES;
  if (query.error && (!query.data || known)) {
    const message = ERROR_MESSAGES[status ?? 0] ?? '결과를 불러오지 못했습니다. 다시 시도해 주세요.';
    return (
      <div className='py-10 text-center'>
        <p role='alert' className='type-body-sm text-fg-secondary'>
          {message}
        </p>
        {!known && (
          <Button variant='secondary' className='mt-3' onClick={() => void query.refetch()}>
            다시 시도
          </Button>
        )}
        {(status === 400 || status === 422) && (
          <Button variant='secondary' className='mt-3' onClick={() => setFilters({ recruitmentId: '' })}>
            현재 모집 회차 보기
          </Button>
        )}
      </div>
    );
  }
  const data = query.data;
  if (!data) return null;
  const refreshError = query.error && (
    <div role='alert' className='type-body-sm text-fg-secondary'>
      결과를 새로 불러오지 못했습니다. 이전 결과를 표시합니다.
      <Button variant='secondary' size='sm' onClick={() => void query.refetch()}>
        다시 시도
      </Button>
    </div>
  );
  if (data.questions.length === 0)
    return (
      <div className='rounded-card border border-dashed border-border px-4 py-6 text-center type-body-sm text-fg-muted'>
        {refreshError}
        <p>이 스터디는 신청 폼에 추가 질문이 없습니다.</p>
        {/* 고칠 수 있는지는 서버가 저장 때 판정한다(403·409 면 폼이 읽기 전용이 된다). 상태로 다시 판정하지 않는다. */}
        <Button variant='secondary' className='mt-3' onClick={onEditForm}>
          신청 폼에서 질문 추가
        </Button>
      </div>
    );
  return (
    <div className='min-w-0 space-y-5'>
      {refreshError}
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <p className='type-body-sm text-fg-muted'>
          응답자 <span className='tnum font-semibold text-fg'>{data.respondentCount}</span>명
        </p>
        <Segmented
          options={VIEW_OPTIONS}
          value={filters.resultsView}
          onChange={(resultsView) => setFilters({ resultsView })}
          shape='pill'
        />
      </div>
      {data.applications.length === 0 ? (
        <p className='rounded-card border border-dashed border-border px-4 py-6 text-center type-body-sm text-fg-muted'>
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
