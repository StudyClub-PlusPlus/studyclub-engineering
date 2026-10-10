'use client';

import { useRevealEmail } from '@/features/users/queries';

/**
 * 이메일 칸 — 가린 값과 「보기」. 누르면 원본을 한 명만 받아 이 줄만 바꿔 보인다.
 *
 * 원본은 이 컴포넌트도, mutation 캐시도 들고 있지 않는다. 받으면 곧바로 `onReveal` 로 페이지 state 에 올리고
 * `reset()` 으로 mutation 상태를 비운다 — 목록을 다시 받을 때 한꺼번에 비우려면 한 곳에 있어야 한다.
 * 처리 중에는 버튼을 막는다(중복 클릭 = 감사 기록이 두 번 쌓인다). 처리 중 여부는 계정별 mutation 키로 읽어
 * 줄이 다시 그려져도 이어진다.
 */
export function EmailCell({
  accountId,
  displayName,
  maskedEmail,
  revealedEmail,
  onReveal,
}: {
  accountId: number;
  /** 이름 칸과 같은 표기 — 버튼의 접근성 이름에 쓴다. */
  displayName: string;
  maskedEmail: string;
  revealedEmail: string | undefined;
  onReveal: (accountId: number, email: string) => void;
}) {
  const reveal = useRevealEmail(accountId);

  function handleReveal() {
    if (reveal.isBusy()) return;
    reveal.mutate(undefined, {
      // 받은 원본은 페이지 state 로 넘긴다. 줄이 이미 사라졌으면 넘길 곳도 없으니 호출 단계 콜백으로 충분하다
      onSuccess: ({ email }) => onReveal(accountId, email),
      // 성공·실패 모두 — 원본이 mutation 상태에 남지 않게 한다. 실패 안내는 훅이 띄운다
      onSettled: () => reveal.reset(),
    });
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
          aria-label={`${displayName} 이메일 보기`}
          className='shrink-0 text-xs font-semibold text-brand hover:underline disabled:cursor-not-allowed disabled:no-underline disabled:opacity-60'
        >
          {reveal.isPending ? '확인 중…' : '보기'}
        </button>
      )}
    </div>
  );
}
