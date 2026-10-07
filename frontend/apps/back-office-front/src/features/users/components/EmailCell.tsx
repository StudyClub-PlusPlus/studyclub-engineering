'use client';

import { toast } from '@studyclub/ui';

import { useRevealEmail } from '@/features/users/queries';

/**
 * 이메일 칸 — 가린 값과 「보기」. 누르면 원본을 한 명만 받아 이 줄만 바꿔 보인다.
 *
 * 원본은 이 컴포넌트가 들고 있지 않는다. 받으면 `onReveal` 로 페이지 state 에 올린다 —
 * 목록을 다시 받을 때 한꺼번에 비우려면 한 곳에 있어야 한다.
 * 처리 중에는 버튼을 막는다(중복 클릭 = 감사 기록이 두 번 쌓인다). 줄마다 mutation 을 따로 가져 그 줄만 막힌다.
 */
export function EmailCell({
  accountId,
  maskedEmail,
  revealedEmail,
  onReveal,
}: {
  accountId: number;
  maskedEmail: string;
  revealedEmail: string | undefined;
  onReveal: (accountId: number, email: string) => void;
}) {
  const reveal = useRevealEmail();

  async function handleReveal() {
    try {
      const { email } = await reveal.mutateAsync(accountId);
      onReveal(accountId, email);
    } catch (err) {
      // 가린 값을 그대로 둔다
      toast.error(err instanceof Error ? err.message : '이메일을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
    }
  }

  return (
    <div className='flex items-center gap-2'>
      <span className='truncate'>{revealedEmail ?? maskedEmail}</span>
      {revealedEmail === undefined && (
        <button
          type='button'
          onClick={handleReveal}
          disabled={reveal.isPending}
          aria-busy={reveal.isPending}
          className='shrink-0 text-xs font-semibold text-brand hover:underline disabled:cursor-not-allowed disabled:no-underline disabled:opacity-60'
        >
          {reveal.isPending ? '확인 중…' : '보기'}
        </button>
      )}
    </div>
  );
}
