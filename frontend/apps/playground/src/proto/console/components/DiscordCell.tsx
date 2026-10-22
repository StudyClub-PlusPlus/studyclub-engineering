import { discordLinked } from '@console/lib/discord';
import { Check, Minus } from 'lucide-react';

/**
 * 디스코드 연동 여부 한 칸.
 *
 * **글자와 모양을 함께 쓴다** — 색이나 아이콘만으로 가르면 못 읽는 사람이 생긴다.
 * 미연동이 손댈 거리라 눈에 들어와야 하고, 연동은 조용해야 한다.
 */
export function DiscordCell({ email }: { email: string }) {
  const on = discordLinked(email);
  return (
    <td className='whitespace-nowrap'>
      <span className={`inline-flex items-center gap-1 text-xs ${on ? 'text-fg-muted' : 'font-semibold text-warning-700'}`}>
        {on ? <Check size={14} /> : <Minus size={14} />}
        {on ? '연동' : '미연동'}
      </span>
    </td>
  );
}
