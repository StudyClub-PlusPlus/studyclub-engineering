import { discordHandle } from '@console/lib/discord';
import { Minus } from 'lucide-react';

/**
 * 디스코드 계정 한 칸 — **이어져 있으면 핸들, 아니면 「미연동」.**
 *
 * 한 칸이 두 가지를 말한다: 이을 수 있는 사람인가, 그리고 디스코드에서 어떻게 찾는가.
 * **글자와 모양을 함께 쓴다** — 색만으로 가르면 못 읽는 사람이 생긴다.
 * 미연동이 손댈 거리라 눈에 들어와야 하고, 이어진 줄은 조용해야 한다.
 */
export function DiscordCell({ email }: { email: string }) {
  const handle = discordHandle(email);
  return (
    <td className='whitespace-nowrap'>
      {handle ? (
        <span className='text-fg-secondary'>@{handle}</span>
      ) : (
        <span className='inline-flex items-center gap-1 text-xs font-semibold text-warning-700'>
          <Minus size={14} />
          미연동
        </span>
      )}
    </td>
  );
}
