'use client';

import { toast, type Toast, Button } from '@studyclub/ui';

/**
 * 「다시 시도」가 붙은 오류 토스트. 재발송 요청이 서버에 닿지 못했을 때 쓴다 — **한 건도 나가지 않은 것**이라 같은 요청을 그대로
 * 다시 보내면 된다. 기다리는 사이 사라지지 않게 일반 토스트보다 오래 둔다.
 */
export function showRetryToast(message: string, onRetry: () => void) {
  toast.error((t) => <RetryToast t={t} message={message} onRetry={onRetry} />, { duration: 10_000 });
}

function RetryToast({ t, message, onRetry }: { t: Toast; message: string; onRetry: () => void }) {
  return (
    <span className='flex items-center gap-3'>
      <span>{message}</span>
      <Button
        type='button'
        variant='tertiary'
        size='sm'
        onClick={() => {
          toast.dismiss(t.id);
          onRetry();
        }}
      >
        다시 시도
      </Button>
    </span>
  );
}
