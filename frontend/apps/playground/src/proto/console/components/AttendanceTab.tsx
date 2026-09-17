'use client';

import { classLabel, classPeriod, type StudyClass } from '@console/lib/classes';
import { tzAbbr, wallToInstant } from '@console/lib/schedule';
import { attendanceRate, type AttendanceStatus, type Crew, type Study, type StudyMeeting } from '@studyclub/mock';
import { Button } from '@studyclub/ui';
import { CalendarPlus, Plus } from 'lucide-react';

/**
 * 출석 탭 — 크루 × 회차 격자.
 *
 * 지금까지 구글시트로 하던 일이라 **시트와 같은 모양**을 유지한다. 화면은 이 격자 하나뿐 —
 * 회차별 화면을 따로 두면 같은 일을 두 곳에서 하게 되고, 한 사람이 몇 번 빠졌는지 보려면
 * 회차를 하나씩 열어야 한다.
 *
 * 출석률은 버튼 없이 **체크하는 즉시** 다시 계산된다. 집계를 따로 돌려야 한다면 시트와 다를 게 없다.
 * 분모는 **체크된 회차만** — 아직 열리지 않은 회차 때문에 출석률이 낮아 보이면 안 된다.
 */

const CELL_STYLE: Record<AttendanceStatus, string> = {
  present: 'border-transparent bg-success-100 text-success-700',
  late: 'border-transparent bg-warning-100 text-warning-700',
  absent: 'border-transparent bg-error-50 text-error-700',
  excused: 'border-transparent bg-surface-2 text-fg-secondary',
};

const CELL_LABEL: Record<AttendanceStatus, string> = {
  present: '출석',
  late: '지각',
  absent: '결석',
  excused: '휴가',
};

function Cell({ status, onClick }: { status: AttendanceStatus | undefined; onClick: () => void }) {
  return (
    <button
      type='button'
      onClick={onClick}
      title='눌러서 출석 → 지각 → 결석 → 휴가 → 미체크'
      className={`h-8 w-full rounded-sm border text-[11px] font-bold transition-colors ${
        status ? CELL_STYLE[status] : 'border-dashed border-border-strong bg-surface text-fg-muted hover:bg-surface-2'
      }`}
    >
      {status ? CELL_LABEL[status] : ''}
    </button>
  );
}

export function AttendanceTab({
  crew,
  meetings,
  attendance,
  classes,
  classId,
  onClass,
  onToggle,
  onGoCrew,
}: {
  study: Study;
  crew: Crew[];
  meetings: StudyMeeting[];
  attendance: Record<string, Record<string, AttendanceStatus>>;
  classes: StudyClass[];
  classId: string;
  onClass: (id: string) => void;
  onToggle: (crewId: string, meetingId: string) => void;
  onGoCrew: () => void;
}) {
  const cls = classes.find((c) => c.id === classId);
  const rule = cls?.rule;
  // 회차가 없다는 건 아직 반이 없거나 그 반의 일정이 비었다는 뜻이다. 그 사실과 갈 곳을 같이 말한다 —
  // 「아직 회차가 없습니다」만 두면 운영자는 여기서 무엇을 눌러야 하는지 알 수 없다.
  if (!cls || meetings.length === 0 || !rule) {
    return (
      <div data-anno='attendance:5' className='card px-6 py-10 text-center'>
        <p className='text-sm font-semibold text-fg'>아직 반이 없습니다.</p>
        <p className='mt-1.5 text-sm text-fg-muted'>
          크루 탭에서 가능한 시간을 보고 반을 만들면 그 반의 출석부가 만들어집니다.
        </p>
        <Button size='sm' className='mt-4' leadingIcon={<CalendarPlus size={15} />} onClick={onGoCrew}>
          반 만들기
        </Button>
      </div>
    );
  }

  return (
    <div>
      {/* 반이 하나면 고를 것이 없다. 탭줄을 늘 띄우면 없는 선택을 있는 것처럼 보이게 한다 */}
      {classes.length > 1 && (
        <nav data-anno='attendance:0' className='mb-4 flex flex-wrap gap-1.5'>
          {classes.map((c) => (
            <button
              key={c.id}
              type='button'
              onClick={() => onClass(c.id)}
              className={`rounded-pill border px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                c.id === classId
                  ? 'border-brand bg-brand text-white'
                  : 'border-border-strong bg-bg text-fg-secondary hover:bg-surface-2'
              }`}
            >
              {classLabel(c)}
            </button>
          ))}
        </nav>
      )}

      <div className='flex flex-wrap items-center justify-between gap-3'>
        <h2 data-anno='attendance:1' className='text-[15px] font-bold'>
          출석부
          {/* 회차 날짜는 스터디가 도는 시간대의 벽시계다. 기준을 적지 않으면 미국 스터디의 날짜를
              한국 날짜로 읽게 된다 — 목 21:00 KST 는 미국에서 수요일이다 */}
          <span className='ml-2 text-[13px] font-medium text-fg-muted'>
            {classLabel(cls)} · 크루 {crew.length} · 회차 {meetings.length} ·{' '}
            {tzAbbr(rule.tz, wallToInstant(meetings[0]!.date, rule.time, rule.tz))} 기준
          </span>
        </h2>
        <Button
          data-anno='attendance:2'
          size='sm'
          variant='secondary'
          leadingIcon={<Plus size={15} />}
          disabled
          title='미구현'
        >
          회차 추가
        </Button>
      </div>

      <div data-anno='attendance:3' className='card mt-3 overflow-x-auto'>
        <table className='w-full border-separate border-spacing-0 text-sm'>
          <thead>
            <tr>
              <th
                data-anno='attendance:3-1'
                className='sticky left-0 z-[1] bg-surface px-4 py-3 text-left text-xs font-semibold text-fg-muted'
              >
                크루
              </th>
              {meetings.map((s) => (
                <th
                  key={s.id}
                  data-anno='attendance:3-2'
                  className='tnum w-[3.6rem] px-1 py-2 text-center text-[11px] font-semibold text-fg-secondary'
                >
                  {s.no}회<span className='block text-[10px] font-medium text-fg-muted'>{s.date.slice(5)}</span>
                </th>
              ))}
              <th data-anno='attendance:3-4' className='px-3 py-2 text-right text-xs font-semibold text-fg-muted'>
                출석률
              </th>
            </tr>
          </thead>
          <tbody>
            {crew.map((c) => {
              const row = attendance[c.id];
              const rate = attendanceRate(row);
              return (
                <tr key={c.id}>
                  <td className='sticky left-0 z-[1] whitespace-nowrap border-t border-border bg-surface px-4 py-1.5 font-semibold'>
                    {c.name}
                  </td>
                  {meetings.map((s) => (
                    <td key={s.id} data-anno='attendance:3-3' className='border-t border-border px-1 py-1.5'>
                      <Cell status={row?.[s.id]} onClick={() => onToggle(c.id, s.id)} />
                    </td>
                  ))}
                  <td className='tnum border-t border-border px-3 py-1.5 text-right font-bold'>
                    {rate === undefined ? (
                      <span className='text-fg-muted'>—</span>
                    ) : (
                      <span className={rate >= 80 ? 'text-success-700' : rate >= 60 ? 'text-fg' : 'text-error-700'}>
                        {rate}%
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p data-anno='attendance:6' className='mt-2 text-xs text-fg-secondary'>
        진행 기간 {classPeriod(cls) || '미정'}
      </p>
      <p data-anno='attendance:4' className='mt-1 text-xs text-fg-muted'>
        칸을 누르면 출석 → 지각 → 결석 → 휴가 → 미체크 순으로 바뀝니다. 출석률은 출석 1, 지각 0.5로 셉니다.
      </p>
    </div>
  );
}
