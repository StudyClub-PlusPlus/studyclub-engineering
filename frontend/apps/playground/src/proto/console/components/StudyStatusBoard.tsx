import Link from 'next/link';

import { BOARD_PREVIEW, DEADLINE_SOON_DAYS, daysUntil, type BoardStudy } from '@console/lib/dashboard';

/**
 * 현황 보드.
 *
 * 셋을 **탭 없이 한 화면에** 둔다. 탭으로 가르면 운영자는 오늘 볼 것이 어느 탭에 있는지를
 * 먼저 기억해야 하고, 안 누른 탭의 일은 없는 일이 된다.
 *
 * **지금 굴러가는 것 · 앞으로 들어올 것 · 곧 있을 것** 셋뿐이다. 공개 예정·일정 미정 같은 상태는
 * 스터디 목록이 이미 말하므로 대시보드가 같은 목록을 두 번 그리지 않는다.
 *
 * 칸 높이는 건수와 무관하게 고정한다 — 데이터가 들어오면서 아래 지표가 밀려 내려가면
 * 읽던 자리를 잃는다.
 */

const BASE = '/proto/console';

/** 헤더 48 + 행 44×5. 건수가 0이든 4든 같은 높이를 유지한다. */
const QUADRANT_MIN_H = 268;

export type BoardEvent = { id: string; title: string; date: string };

export function StudyStatusBoard({
  ongoing,
  recruiting,
  events,
}: {
  ongoing: BoardStudy[];
  recruiting: BoardStudy[];
  events: BoardEvent[];
}) {
  return (
    <section data-anno='3' className='card mt-6 grid grid-cols-1 overflow-hidden lg:grid-cols-3'>
      <Quadrant
        anno='3-1'
        title='진행중 스터디'
        count={ongoing.length}
        href={`${BASE}/studies`}
        items={ongoing}
        rowHref={(s) => `${BASE}/studies/${s.id}`}
        empty='진행중 스터디가 없습니다'
        className='border-b border-border lg:border-b-0 lg:border-r'
        // 이름만 둔다. 출석률·회차를 여기 적으면 기준을 설명할 자리가 없어 숫자만 남는다.
        row={() => null}
      />
      <Quadrant
        anno='3-2'
        title='모집중 스터디'
        count={recruiting.length}
        href={`${BASE}/studies`}
        items={recruiting}
        rowHref={(s) => `${BASE}/studies/${s.id}`}
        empty='모집중 스터디가 없습니다'
        className='border-b border-border lg:border-b-0 lg:border-r'
        row={(s) => <DeadlineCell deadline={s.deadline} />}
      />
      <Quadrant
        anno='3-3'
        title='예정 행사'
        count={events.length}
        href={`${BASE}/events`}
        items={events}
        rowHref={() => `${BASE}/events`}
        empty='예정된 행사가 없습니다'
        row={(e) => <DateCell date={e.date} />}
      />
    </section>
  );
}

function Quadrant<T extends { id: string; title: string }>({
  anno,
  title,
  icon,
  count,
  note,
  href,
  items,
  empty,
  row,
  rowHref,
  className = '',
}: {
  anno?: string;
  title: string;
  icon?: React.ReactNode;
  count: number;
  note?: string;
  href: string;
  items: T[];
  empty: string;
  row: (item: T) => React.ReactNode;
  rowHref: (item: T) => string;
  className?: string;
}) {
  const shown = items.slice(0, BOARD_PREVIEW);
  const rest = items.length - shown.length;

  return (
    <div data-anno={anno} className={`flex flex-col px-5 py-4 ${className}`} style={{ minHeight: QUADRANT_MIN_H }}>
      <div className='flex h-6 items-baseline gap-2'>
        <h3 className='flex items-center gap-1.5 text-[15px] font-bold'>
          {icon}
          {title}
        </h3>
        <span className='tnum text-[13px] font-bold text-fg-secondary'>{count}</span>
        {note && <span className='text-xs text-fg-muted'>{note}</span>}
        <Link href={href} className='ml-auto text-xs font-medium text-brand'>
          전체 보기
        </Link>
      </div>

      {items.length === 0 ? (
        <p className='flex flex-1 items-center justify-center text-sm text-fg-muted'>{empty}</p>
      ) : (
        <ul className='mt-2'>
          {shown.map((s) => (
            <li key={s.id}>
              <Link
                href={rowHref(s)}
                title={s.title}
                className='flex h-11 items-center gap-3 rounded-control px-1 transition-colors hover:bg-surface-2'
              >
                <span className='min-w-0 flex-1 truncate text-sm font-semibold'>{s.title}</span>
                {row(s)}
              </Link>
            </li>
          ))}
          {rest > 0 && (
            <li data-anno='3-4'>
              <Link
                href={href}
                className='flex h-11 items-center justify-center text-xs text-fg-muted hover:text-fg-secondary'
              >
                외 {rest}개 스터디
              </Link>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

/** 모집 마감 칸. 날짜만으로는 급한지 알 수 없어 남은 일수를 같이 적는다. */
function DeadlineCell({ deadline }: { deadline?: string }) {
  if (deadline === undefined) return <span className='w-[110px] shrink-0 text-right text-sm text-fg-muted'>상시</span>;
  const d = daysUntil(deadline);
  const tone = d < 0 || d === 0 ? 'text-error-700' : d <= DEADLINE_SOON_DAYS ? 'text-warning-700' : 'text-fg-secondary';
  const label = d < 0 ? '마감 경과' : d === 0 ? '오늘 마감' : `D-${d}`;
  return (
    <span className={`tnum w-[110px] shrink-0 whitespace-nowrap text-right text-sm font-medium ${tone}`}>
      ~{deadline.slice(5)} ({label})
    </span>
  );
}

/** 날짜 + 남은 일수. 날짜만으로는 이번 주인지 다음 달인지 읽는 사람이 세어야 한다. */
function DateCell({ date }: { date: string }) {
  const d = daysUntil(date);
  return (
    <span className='tnum w-[110px] shrink-0 whitespace-nowrap text-right text-sm text-fg-secondary'>
      {date.slice(5)} {d > 0 ? `(D-${d})` : d === 0 ? '(오늘)' : ''}
    </span>
  );
}
