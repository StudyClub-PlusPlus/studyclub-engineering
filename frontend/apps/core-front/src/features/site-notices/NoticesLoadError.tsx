'use client';

import { useRouter } from 'next/navigation';

import { Button } from '@studyclub/ui';

/** 공지 목록·상세 조회가 실패했을 때의 안내와 「다시 시도」. 공지는 서버가 그리므로 같은 화면을 서버에서 다시 그리게 한다. */
export function NoticesLoadError({ message, retry }: { message: string; retry: string }) {
  const router = useRouter();
  return (
    <>
      <p className='text-sm text-(--color-fg-muted)'>{message}</p>
      <Button variant='secondary' size='sm' className='mt-4' onClick={() => router.refresh()}>
        {retry}
      </Button>
    </>
  );
}
