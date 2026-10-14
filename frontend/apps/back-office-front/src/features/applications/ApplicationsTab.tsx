'use client';

import Link from 'next/link';
import { Fragment, useState } from 'react';

import { Button, Checkbox, EmptyState, Segmented } from '@studyclub/ui';

import { useApplications, useDecideApplications } from './queries';
import type { ApplicationDecision, ApplicationStatus, ApplicationsResponse } from './types';
import { TableCard } from '@/components/ui';
import { ApiError } from '@/lib/http';

const STATUS_LABEL: Record<ApplicationStatus, string> = { PENDING: '대기', APPROVED: '승인', REJECTED: '거절' };
const STATUSES: ApplicationStatus[] = ['PENDING', 'APPROVED', 'REJECTED'];
const DAYS: Record<string, string> = { mon: '월', tue: '화', wed: '수', thu: '목', fri: '금', sat: '토', sun: '일' };
const dateFormat = new Intl.DateTimeFormat('ko-KR', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Seoul',
});

function answerText(answer: string | string[] | undefined) {
  return (
    (Array.isArray(answer) ? answer : answer == null ? [] : [answer])
      .filter((value) => value.trim() !== '')
      .join(', ') || '응답 없음'
  );
}

export function ApplicationsTab({ studyId }: { studyId: number }) {
  const query = useApplications(studyId);
  if (query.isPending)
    return (
      <p role='status' className='py-10 text-center text-sm text-fg-muted'>
        불러오는 중
      </p>
    );
  if (query.error) {
    const status = query.error instanceof ApiError ? query.error.status : undefined;
    return (
      <div className='py-10 text-center'>
        <p role='alert' className='text-sm text-fg-secondary'>
          {status === 403
            ? '담당하는 스터디가 아니에요.'
            : status === 404
              ? '스터디를 찾을 수 없습니다.'
              : status === 401
                ? '로그인이 필요합니다.'
                : '신청자를 불러오지 못했습니다. 다시 시도해 주세요.'}
        </p>
        {status === 403 ? (
          <Link href='/studies' className='mt-3 inline-block text-sm font-semibold text-brand hover:underline'>
            스터디 관리로 돌아가기
          </Link>
        ) : (
          status !== 404 &&
          status !== 401 && (
            <Button type='button' variant='secondary' className='mt-3' onClick={() => void query.refetch()}>
              다시 시도
            </Button>
          )
        )}
      </div>
    );
  }
  return <ApplicationReview key={studyId} studyId={studyId} data={query.data} refreshing={query.isFetching} />;
}

function ApplicationReview({
  studyId,
  data,
  refreshing,
}: {
  studyId: number;
  data: ApplicationsResponse;
  refreshing: boolean;
}) {
  const mutation = useDecideApplications(studyId);
  const [status, setStatus] = useState<ApplicationStatus>('PENDING');
  const [expanded, setExpanded] = useState<number | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [notice, setNotice] = useState('');
  const [copyError, setCopyError] = useState('');
  const { applications, questions } = data;
  const rows = applications.filter((application) => application.status === status);
  const selectedIds = rows
    .filter((application) => selected.includes(application.id) && application.status === 'PENDING')
    .map((application) => application.id);
  const counts = Object.fromEntries(
    STATUSES.map((value) => [value, applications.filter((application) => application.status === value).length]),
  ) as Record<ApplicationStatus, number>;
  const isFull = data.capacity != null && counts.APPROVED >= data.capacity;
  const accessDenied = mutation.error instanceof ApiError && mutation.error.status === 403;
  const isProcessing = mutation.isPending || refreshing;

  function decide(applicationIds: number[], decision: ApplicationDecision) {
    if (isProcessing || applicationIds.length === 0 || (decision === 'APPROVED' && !data.canApprove)) return;
    setNotice('');
    mutation.mutate(
      { applicationIds, decision },
      {
        onSuccess: () => {
          setSelected([]);
          setNotice(`${applicationIds.length}명의 신청을 ${STATUS_LABEL[decision]}했습니다.`);
        },
      },
    );
  }

  async function copyAnnouncement() {
    if (!data.announcementUrl) return;
    setCopyError('');
    try {
      await navigator.clipboard.writeText(data.announcementUrl);
      setNotice('공고 링크를 복사했습니다.');
    } catch {
      setCopyError('공고 링크를 복사하지 못했습니다. 다시 시도해 주세요.');
    }
  }

  if (accessDenied)
    return (
      <div className='py-10 text-center'>
        <p role='alert'>담당하는 스터디가 아니에요.</p>
        <Link href='/studies' className='mt-3 inline-block text-sm font-semibold text-brand'>
          스터디 관리로 돌아가기
        </Link>
      </div>
    );

  return (
    <section className='space-y-4' aria-label='신청자 심사'>
      <div>
        <h2 className='text-[15px] font-bold'>신청자</h2>
        <p className='mt-1 text-sm text-fg-secondary'>
          정원 {data.capacity == null ? '제한 없음' : `${data.capacity}명`} · 신청 {applications.length}명 · 승인{' '}
          {counts.APPROVED}명 · 대기 {counts.PENDING}명
        </p>
      </div>
      {isFull && <p className='rounded-control bg-warning-100 px-4 py-3 text-sm text-warning-700'>정원이 찼어요.</p>}
      {!data.canApprove && data.approvalBlockedReason && (
        <p className='text-sm text-fg-secondary'>{data.approvalBlockedReason}</p>
      )}
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <Segmented
          size='sm'
          value={status}
          options={STATUSES.map((value) => ({
            value,
            label: `${STATUS_LABEL[value]} ${counts[value]}`,
            disabled: mutation.isPending,
          }))}
          onChange={(value) => {
            setStatus(value);
            setSelected([]);
            setExpanded(null);
          }}
        />
        {status === 'PENDING' && (
          <div className='flex items-center gap-2'>
            <span className='text-xs text-fg-muted'>{selectedIds.length}명 선택</span>
            <Button
              type='button'
              size='sm'
              variant='secondary'
              disabled={isProcessing || selectedIds.length === 0 || !data.canApprove}
              onClick={() => void decide(selectedIds, 'APPROVED')}
            >
              일괄 승인
            </Button>
            <Button
              type='button'
              size='sm'
              variant='destructive'
              disabled={isProcessing || selectedIds.length === 0}
              onClick={() => void decide(selectedIds, 'REJECTED')}
            >
              일괄 거절
            </Button>
          </div>
        )}
      </div>
      {notice && (
        <p role='status' className='text-sm text-fg-secondary'>
          {notice}
        </p>
      )}
      {copyError && (
        <p role='alert' className='text-sm text-error-600'>
          {copyError}
        </p>
      )}
      {mutation.error && (
        <p role='alert' className='text-sm text-error-600'>
          {mutation.error instanceof ApiError && mutation.error.status === 409
            ? '신청 상태 또는 정원이 변경되었습니다. 최신 목록을 확인하고 다시 시도해 주세요.'
            : '처리 결과를 확인하지 못했습니다. 최신 신청 상태를 확인해 주세요.'}
        </p>
      )}
      {rows.length === 0 ? (
        <EmptyState
          title={
            applications.length === 0 ? '아직 신청한 사람이 없어요.' : `${STATUS_LABEL[status]} 중인 신청이 없습니다.`
          }
          description={applications.length === 0 && data.announcementUrl ? '공고를 공유해 보세요.' : undefined}
          action={
            applications.length === 0 && data.announcementUrl ? (
              <Button type='button' variant='secondary' onClick={() => void copyAnnouncement()}>
                공고 링크 복사
              </Button>
            ) : undefined
          }
        />
      ) : (
        <TableCard>
          <thead>
            <tr>
              {status === 'PENDING' && (
                <th>
                  <Checkbox
                    label=''
                    aria-label='대기 신청 전체 선택'
                    checked={selectedIds.length === rows.length}
                    disabled={isProcessing}
                    onChange={(event) => setSelected(event.target.checked ? rows.map((row) => row.id) : [])}
                  />
                </th>
              )}
              <th>이름</th>
              <th className='whitespace-nowrap'>이전 참여</th>
              <th className='whitespace-nowrap'>완주율</th>
              <th className='whitespace-nowrap'>신청일 (한국 시간)</th>
              <th>신청서</th>
              {status === 'PENDING' && <th>심사</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((application) => {
              const isExpanded = expanded === application.id;
              const firstQuestion = questions[0];
              return (
                <Fragment key={application.id}>
                  <tr>
                    {status === 'PENDING' && (
                      <td>
                        <Checkbox
                          label=''
                          aria-label={`${application.applicantName} 선택`}
                          checked={selectedIds.includes(application.id)}
                          disabled={isProcessing}
                          onChange={(event) =>
                            setSelected(
                              event.target.checked
                                ? [...selectedIds, application.id]
                                : selectedIds.filter((id) => id !== application.id),
                            )
                          }
                        />
                      </td>
                    )}
                    <td>
                      <p className='whitespace-nowrap font-semibold'>{application.applicantName}</p>
                      <p className='text-xs text-fg-muted'>{application.discordNickname || '—'}</p>
                      <p className='text-xs text-fg-muted'>{application.email ?? '—'}</p>
                    </td>
                    <td className='whitespace-nowrap'>
                      {application.previousParticipationCount === 0
                        ? '첫 참여'
                        : `${application.previousParticipationCount}회`}
                    </td>
                    <td className='tnum'>
                      {application.completionRate == null ? '—' : `${application.completionRate}%`}
                    </td>
                    <td className='tnum whitespace-nowrap'>{dateFormat.format(new Date(application.submittedAt))}</td>
                    <td>
                      <Button
                        type='button'
                        size='sm'
                        variant='ghost'
                        aria-label={`${application.applicantName} 신청서 ${isExpanded ? '접기' : '펼치기'}`}
                        aria-expanded={isExpanded}
                        aria-controls={`application-${application.id}`}
                        onClick={() => setExpanded(isExpanded ? null : application.id)}
                      >
                        {isExpanded ? '접기' : '펼치기'}
                      </Button>
                    </td>
                    {status === 'PENDING' && (
                      <td>
                        <div className='flex gap-2'>
                          <Button
                            type='button'
                            size='sm'
                            disabled={isProcessing || !data.canApprove}
                            aria-label={`${application.applicantName} 승인`}
                            onClick={() => void decide([application.id], 'APPROVED')}
                          >
                            승인
                          </Button>
                          <Button
                            type='button'
                            size='sm'
                            variant='destructive'
                            disabled={isProcessing}
                            aria-label={`${application.applicantName} 거절`}
                            onClick={() => void decide([application.id], 'REJECTED')}
                          >
                            거절
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                  <tr id={`application-${application.id}`}>
                    <td colSpan={status === 'PENDING' ? 7 : 5}>
                      {isExpanded ? (
                        <dl className='space-y-4 p-2 text-sm'>
                          <div>
                            <dt className='font-semibold'>참여 가능 요일</dt>
                            <dd className='mt-1 text-fg-secondary'>
                              {application.availableDays.map((day) => DAYS[day] ?? day).join(', ') || '응답 없음'}
                            </dd>
                          </div>
                          <div>
                            <dt className='font-semibold'>일정 참여 확인</dt>
                            <dd className='mt-1 text-fg-secondary'>
                              {application.scheduleAgreed == null
                                ? '해당 없음'
                                : application.scheduleAgreed
                                  ? '확인함'
                                  : '확인하지 않음'}
                            </dd>
                          </div>
                          {questions.map((question) => (
                            <div key={question.id}>
                              <dt className='font-semibold'>{question.label}</dt>
                              <dd className='mt-1 whitespace-pre-wrap break-words text-fg-secondary'>
                                {answerText(application.answers[question.id])}
                              </dd>
                            </div>
                          ))}
                          {questions.length === 0 && (
                            <div className='text-fg-muted'>이 스터디는 신청 폼에 추가 질문이 없습니다.</div>
                          )}
                        </dl>
                      ) : (
                        <p className='max-w-3xl truncate text-sm text-fg-secondary'>
                          {firstQuestion
                            ? `${firstQuestion.label} — ${answerText(application.answers[firstQuestion.id])}`
                            : '이 스터디는 신청 폼에 추가 질문이 없습니다.'}
                        </p>
                      )}
                    </td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </TableCard>
      )}
    </section>
  );
}
