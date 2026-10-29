'use client';

import { useRouter } from 'next/navigation';

import { Button } from '@studyclub/ui';

/** 공지 목록 조회가 실패했을 때의 「다시 시도」. 목록은 서버가 그리므로 같은 쪽을 서버에서 다시 그리게 한다. */
export function NoticesRetryButton({ label }: { label: string }) {
  const router = useRouter();
  return (
    <Button variant='secondary' size='sm' className='mt-4' onClick={() => router.refresh()}>
      {label}
    </Button>
  );
}
