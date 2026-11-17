'use client';

import { IconButton } from '@studyclub/ui';
import { Eye, EyeOff } from 'lucide-react';

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
      <IconButton
        variant='tertiary'
        size='xs'
        onClick={handleToggle}
        loading={reveal.isPending}
        aria-label={`${displayName} 디스코드 아이디 ${shown ? '가리기' : '보기'}`}
        title={reveal.isPending ? '확인 중…' : shown ? '가리기' : '디스코드 아이디 보기'}
        icon={shown ? <EyeOff /> : <Eye />}
      />
      {/* 처리 중 안내는 버튼 밖 role=status 로 — design-system §9-1 은 버튼 안 스피너 · 글자를 쓰지 않는다 */}
      <span className='sr-only' role='status'>
        {reveal.isPending ? '확인 중…' : ''}
      </span>
    </div>
  );
}
