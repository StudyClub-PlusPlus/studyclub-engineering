'use client';

import { IconButton } from '@studyclub/ui';
import { Eye, EyeOff } from 'lucide-react';

import { useRevealEmail } from '@/features/users/queries';

/**
 * 이메일 칸 — 눈 아이콘으로 열고 가린다. 다시 열 때마다 원본을 새로 요청한다.
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
  onHide,
}: {
  accountId: number;
  /** 이름 칸과 같은 표기 — 버튼의 접근성 이름에 쓴다. */
  displayName: string;
  maskedEmail: string;
  revealedEmail: string | undefined;
  onReveal: (accountId: number, email: string) => void;
  onHide: (accountId: number) => void;
}) {
  const reveal = useRevealEmail(accountId);
  const shown = revealedEmail !== undefined;

  function handleToggle() {
    if (reveal.isBusy()) return;
    if (shown) {
      onHide(accountId);
      return;
    }
    reveal.mutate(undefined, {
      // 받은 원본은 페이지 state 로 넘긴다. 줄이 이미 사라졌으면 넘길 곳도 없으니 호출 단계 콜백으로 충분하다
      onSuccess: ({ email }) => onReveal(accountId, email),
      // 성공·실패 모두 — 원본이 mutation 상태에 남지 않게 한다. 실패 안내는 훅이 띄운다
      onSettled: () => reveal.reset(),
    });
  }

  return (
    <div className='flex items-center gap-1.5'>
      <span className='truncate' title={revealedEmail}>
        {revealedEmail ?? maskedEmail}
      </span>
      <IconButton
        variant='tertiary'
        size='xs'
        onClick={handleToggle}
        loading={reveal.isPending}
        aria-label={`${displayName} 이메일 ${shown ? '가리기' : '보기'}`}
        title={reveal.isPending ? '확인 중…' : shown ? '가리기' : '전체 주소 보기'}
        icon={shown ? <EyeOff /> : <Eye />}
      />
      {/* 처리 중 안내는 버튼 밖 role=status 로 — design-system §9-1 은 버튼 안 스피너 · 글자를 쓰지 않는다 */}
      <span className='sr-only' role='status'>
        {reveal.isPending ? '확인 중…' : ''}
      </span>
    </div>
  );
}
