'use client';

import Link from 'next/link';
import { notFound, useParams } from 'next/navigation';

import { Button } from '@studyclub/ui';

import { useStudyDetail } from '@/features/studies/queries';
import { StudyConsole } from '@/features/studies/StudyConsole';
import { ApiError } from '@/lib/http';

/**
 * 스터디 운영 페이지 — 크루·출석·정보를 한 스터디 안에서 처리한다.
 *
 * 주소 키는 `STUDY.ID` 다. slug 는 UUID 라 사람이 읽을 수 없고, 상세 API 도 ID 로만 찾는다.
 */
export default function StudyAdminDetail() {
  const { id } = useParams<{ id: string }>();
  const studyId = /^\d+$/.test(id) ? Number(id) : NaN;
  if (Number.isNaN(studyId)) notFound();

  const { data, error, isPending, refetch, isFetching } = useStudyDetail(studyId);

  if (isPending) return <p className='py-10 text-center type-body-sm text-fg-muted'>불러오는 중…</p>;

  // 권한 상실·삭제는 캐시를 보여 주지 않는다. 일시적인 재조회 실패는 마지막으로 확인된 상세를 유지한다.
  const unavailable = error instanceof ApiError && [401, 403, 404].includes(error.status);
  if (error && (!data || unavailable)) {
    const missing = error instanceof ApiError && error.status === 404;
    return (
      <div className='py-10 text-center'>
        <p className='type-body-sm text-fg-secondary'>{missing ? '스터디를 찾을 수 없습니다.' : error.message}</p>
        <Link href='/studies' className='mt-3 inline-block type-label-lg text-brand hover:underline'>
          스터디 관리로 돌아가기
        </Link>
      </div>
    );
  }

  return (
    <>
      {error && (
        <div role='alert' className='mb-4 flex items-center gap-3 type-body-sm text-error-600'>
          최신 정보를 불러오지 못했습니다. 마지막으로 확인한 정보를 표시합니다.
          <Button
            variant='secondary'
            disabled={isFetching}
            onClick={() => {
              void refetch();
            }}
          >
            다시 조회
          </Button>
        </div>
      )}
      <StudyConsole key={data.id} detail={data} />
    </>
  );
}
