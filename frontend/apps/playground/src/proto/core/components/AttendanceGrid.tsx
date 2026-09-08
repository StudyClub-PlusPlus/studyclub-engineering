'use client';

import {
  BOOK_LABEL,
  BOOK_STYLE,
  MEETING_COLS,
  chunkMeetings,
  meetingDayLabel,
  type MyAttendanceBook,
} from '@core/lib/attendance-book';
import { meetingWallDate, type WallTz } from '@core/lib/joined';
import { type Study } from '@studyclub/mock';
import { cx } from '@studyclub/ui';

/**
 * 내 출석 격자. 한 줄에 최대 10회. 10회 미만이면 그 칸 수로 한 줄을 채운다.
 * 아직 시작하지 않은 회차의 결석은 빈 칸이다. 일자는 주간 줄과 같은 타임존.
 */
export function AttendanceGrid({
  book,
  study,
  wallTz,
  headAnno,
  cellAnno,
}: {
  book: MyAttendanceBook;
  study: Study;
  wallTz: WallTz;
  headAnno?: string;
  cellAnno?: string;
}) {
  if (book.meetings.length === 0) {
    return <p className='py-3 text-center text-sm text-fg-secondary'>아직 회차가 없습니다.</p>;
  }

  const rows = chunkMeetings(book.meetings, MEETING_COLS);
  const cols = book.meetings.length < MEETING_COLS ? book.meetings.length : MEETING_COLS;

  return (
    <div className='flex flex-col gap-3'>
      {rows.map((row) => (
        <div
          key={row[0]?.id}
          className='grid gap-1'
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {row.map((m) => {
            const status = book.cells[m.id];
            const label = status ? BOOK_LABEL[status] : undefined;
            return (
              <div key={m.id} className='min-w-0 text-center'>
                <p data-anno={headAnno} className='tnum text-[10px] font-semibold text-fg-secondary'>
                  {m.no}회
                  <span className='block font-medium text-fg-muted'>
                    {meetingDayLabel(meetingWallDate(study, m, wallTz))}
                  </span>
                </p>
                <span
                  data-anno={cellAnno}
                  title={label ? `${m.no}회차 ${label}` : `${m.no}회차`}
                  className={cx(
                    'mt-0.5 block min-h-[1.625rem] truncate rounded-sm px-0.5 py-1 text-[10px] font-bold',
                    status ? BOOK_STYLE[status] : 'border border-dashed border-border-strong',
                  )}
                >
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
