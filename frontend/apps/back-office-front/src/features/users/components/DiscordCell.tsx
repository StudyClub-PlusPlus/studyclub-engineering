'use client';

import { Eye, EyeOff, Loader2 } from 'lucide-react';

import { useRevealDiscord } from '@/features/users/queries';

/** 목록에는 연동 여부만 온다. 눈 아이콘으로 열고 가리며, 다시 열 때마다 원본을 요청한다. */
export function DiscordCell({
  accountId,
  displayName,
  linked,
  revealedHandle,
  onReveal,
  onHide,
}: {
  accountId: number;
  displayName: string;
  linked: boolean;
  revealedHandle: string | undefined;
  onReveal: (accountId: number, handle: string) => void;
  onHide: (accountId: number) => void;
}) {
  const reveal = useRevealDiscord(accountId);
  const shown = revealedHandle !== undefined;

  if (!linked) return <span className='text-fg-muted'>미연동</span>;

  function handleToggle() {
    if (reveal.isBusy()) return;
    if (shown) {
      onHide(accountId);
      return;
    }
    reveal.mutate(undefined, {
      onSuccess: ({ discordHandle }) => onReveal(accountId, discordHandle),
      onSettled: () => reveal.reset(),
    });
  }

  return (
    <div className='flex items-center gap-1.5'>
      <span className='max-w-[16ch] truncate text-fg' title={revealedHandle ? `@${revealedHandle}` : undefined}>
        {revealedHandle === undefined ? '연동' : `@${revealedHandle}`}
      </span>
      <button
        type='button'
        onClick={handleToggle}
        disabled={reveal.isPending}
        aria-busy={reveal.isPending}
        aria-label={`${displayName} 디스코드 아이디 ${shown ? '가리기' : '보기'}`}
        title={reveal.isPending ? '확인 중…' : shown ? '가리기' : '디스코드 아이디 보기'}
        className='grid h-6 w-6 shrink-0 place-items-center rounded-control text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-60'
      >
        {reveal.isPending ? (
          <Loader2 size={14} className='animate-spin' aria-hidden='true' />
        ) : shown ? (
          <EyeOff size={14} aria-hidden='true' />
        ) : (
          <Eye size={14} aria-hidden='true' />
        )}
        {reveal.isPending && (
          <span className='sr-only' role='status'>
            확인 중…
          </span>
        )}
      </button>
    </div>
  );
}
