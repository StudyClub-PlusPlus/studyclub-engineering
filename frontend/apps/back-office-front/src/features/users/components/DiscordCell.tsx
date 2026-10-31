'use client';

import { useRevealDiscord } from '@/features/users/queries';

/** 목록에는 연동 여부만 온다. 원본은 「보기」로 받아 이 줄만 펼친다. */
export function DiscordCell({
  accountId,
  displayName,
  linked,
  revealedHandle,
  onReveal,
}: {
  accountId: number;
  displayName: string;
  linked: boolean;
  revealedHandle: string | undefined;
  onReveal: (accountId: number, handle: string) => void;
}) {
  const reveal = useRevealDiscord(accountId);

  if (!linked) return <span className='text-fg-muted'>미연동</span>;

  function handleReveal() {
    if (reveal.isBusy()) return;
    reveal.mutate(undefined, {
      onSuccess: ({ discordHandle }) => onReveal(accountId, discordHandle),
      onSettled: () => reveal.reset(),
    });
  }

  return (
    <div className='flex items-center gap-2'>
      <span className='max-w-[16ch] truncate text-fg' title={revealedHandle ? `@${revealedHandle}` : undefined}>
        {revealedHandle === undefined ? '연동' : `@${revealedHandle}`}
      </span>
      {revealedHandle === undefined && (
        <button
          type='button'
          onClick={handleReveal}
          disabled={reveal.isPending}
          aria-busy={reveal.isPending}
          aria-label={`${displayName} 디스코드 아이디 보기`}
          className='shrink-0 type-label-lg text-brand hover:underline disabled:cursor-not-allowed disabled:no-underline disabled:opacity-60'
        >
          {reveal.isPending ? '확인 중…' : '보기'}
        </button>
      )}
    </div>
  );
}
