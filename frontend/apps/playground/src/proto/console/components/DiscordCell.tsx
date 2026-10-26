'use client';

import { useState } from 'react';

import { discordHandle } from '@console/lib/discord';
import { Eye, EyeOff } from 'lucide-react';

/**
 * 디스코드 계정 한 칸 — **「연동」 아니면 「미연동」.**
 *
 * 미연동이 손댈 거리라 눈에 들어와야 하고, 이어진 줄은 조용해야 한다 — **글자가 이미 다르므로**
 * 표식을 덧붙이지 않는다. 색만으로 가르는 것이 아니다: 「미연동」이라고 적혀 있다.
 *
 * 이어진 줄에는 눈 아이콘이 서고, **누른 줄만** 아이디를 펼친다. 같은 버튼으로 다시 가린다.
 * 늘 펼쳐 두지 않는 이유는 이메일과 같다 ([POL-0007]) — 화면을 띄운 채 자리를 비우거나 화면을
 * 공유할 때 수십 명의 계정이 한꺼번에 드러난다. 펼친 것은 그 줄에만 남는다.
 */
export function DiscordCell({ email }: { email: string }) {
  const handle = discordHandle(email);
  const [shown, setShown] = useState(false);

  if (!handle) {
    return (
      <td className='whitespace-nowrap'>
        <span className='text-xs font-semibold text-warning-700'>미연동</span>
      </td>
    );
  }

  return (
    <td className='whitespace-nowrap'>
      <span className='inline-flex items-center gap-1.5'>
        <span className='text-xs text-fg-secondary'>{shown ? handle : '연동'}</span>
        <button
          type='button'
          onClick={() => setShown((v) => !v)}
          aria-label={shown ? '디스코드 아이디 가리기' : '디스코드 아이디 보기'}
          title={shown ? '가리기' : '디스코드 아이디 보기'}
          className='grid h-6 w-6 shrink-0 place-items-center rounded-control text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg'
        >
          {shown ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </span>
    </td>
  );
}
