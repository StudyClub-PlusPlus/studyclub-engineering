'use client';

import Link from 'next/link';
import { notFound, useParams } from 'next/navigation';

import { studies } from '@studyclub/mock';

import { StudyConsole } from '@/components/StudyConsole';
import { useStudyDetail } from '@/features/studies/queries';
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

  const { data, error, isPending } = useStudyDetail(studyId);

  if (isPending) return <p className='py-10 text-center text-sm text-fg-muted'>불러오는 중…</p>;

  if (error) {
    const missing = error instanceof ApiError && error.status === 404;
    return (
      <div className='py-10 text-center'>
        <p className='text-sm text-fg-secondary'>{missing ? '스터디를 찾을 수 없습니다.' : error.message}</p>
        <Link href='/studies' className='mt-3 inline-block text-sm font-semibold text-brand hover:underline'>
          스터디 관리로 돌아가기
        </Link>
      </div>
    );
  }

  // 출석 탭은 아직 목 데이터다 — 같은 study_id 의 목 스터디가 있을 때만 쓴다
  const mockStudy = studies.find((s) => s.study_id === data.id);

  return <StudyConsole key={data.id} detail={data} mockStudy={mockStudy} />;
}
