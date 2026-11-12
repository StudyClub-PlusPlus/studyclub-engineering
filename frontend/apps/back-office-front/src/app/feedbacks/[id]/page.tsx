'use client';

// 문의·오류 신고 상세 — 내용 · 첨부 · 제출 환경을 보고, 상태를 바꾸고, 회신하고, 캡틴 전용 메모를 남긴다.
// 서버 상태는 features/feedbacks/queries.ts. 이 페이지는 주소의 번호를 읽어 상세를 불러오고 상태별 화면만 고른다.
import { useParams } from 'next/navigation';

import { Button } from '@studyclub/ui';

import { BackToList, FeedbackDetail } from '@/features/feedbacks/components/FeedbackDetail';
import { COPY } from '@/features/feedbacks/labels';
import { useFeedback } from '@/features/feedbacks/queries';
import { ApiError } from '@/lib/http';

export default function FeedbackDetailPage() {
  const { id } = useParams<{ id: string }>();
  // 숫자가 아닌 번호는 서버에 묻지 않는다 — 있을 수 없는 건이다
  const feedbackId = /^\d+$/.test(id) ? Number(id) : NaN;
  const valid = !Number.isNaN(feedbackId);
  const { data, error, isPending, refetch } = useFeedback(feedbackId, { enabled: valid });

  if (!valid || (error instanceof ApiError && error.status === 404)) {
    return <DetailNotice>{COPY.notFound}</DetailNotice>;
  }

  if (error) {
    return (
      <DetailNotice
        action={
          <Button size='sm' variant='secondary' onClick={() => refetch()}>
            다시 시도
          </Button>
        }
      >
        {COPY.listError}
      </DetailNotice>
    );
  }

  if (isPending) {
    return (
      <div className='flex flex-col gap-4'>
        <BackToList />
        <div data-testid='feedback-detail-skeleton' className='h-60 animate-pulse rounded-card bg-surface-2' />
      </div>
    );
  }

  // 다른 건으로 옮겨 가면 입력칸(회신·메모)을 새로 시작한다
  return <FeedbackDetail key={data.id} detail={data} />;
}

function DetailNotice({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className='flex flex-col gap-4'>
      <BackToList />
      <div className='flex flex-col items-center gap-3 py-20 text-center'>
        <p className='text-sm text-fg-secondary'>{children}</p>
        {action}
      </div>
    </div>
  );
}
