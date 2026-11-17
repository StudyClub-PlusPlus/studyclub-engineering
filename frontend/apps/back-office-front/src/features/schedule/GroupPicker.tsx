import type { ScheduleGroup } from '@/features/schedule/meetings';

/**
 * 반 칩 한 줄 — 일정 탭과 출석 탭이 고른 반을 같이 쓴다. 반이 하나면 두지 않는다.
 * 고른 반을 다시 누르면 아무 일도 없다. 옮기기 전 확인(저장하지 않은 고침)은 부르는 쪽 `onPick` 이 한다.
 */
export function GroupPicker({
  groups,
  groupId,
  onPick,
}: {
  groups: ScheduleGroup[];
  groupId: string;
  onPick: (id: string) => void;
}) {
  if (groups.length < 2) return null;
  return (
    <nav aria-label='반' className='mb-4 flex flex-wrap gap-1.5'>
      {groups.map((g) => (
        <button
          key={g.id}
          type='button'
          aria-pressed={g.id === groupId}
          onClick={() => g.id !== groupId && onPick(g.id)}
          className={`rounded-pill border px-3 py-1.5 type-label-lg transition-colors ${
            g.id === groupId
              ? 'border-brand bg-brand text-white'
              : 'border-border-strong bg-bg text-fg-secondary hover:bg-surface-2'
          }`}
        >
          {g.title}
        </button>
      ))}
    </nav>
  );
}
