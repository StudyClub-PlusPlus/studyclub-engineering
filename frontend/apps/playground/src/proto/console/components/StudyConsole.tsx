'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';


import { AttendanceTab } from '@console/components/AttendanceTab';
import { CrewTab } from '@console/components/CrewTab';
import { StudyInfoTab } from '@console/components/StudyInfoTab';
import { tx } from '@console/lib/l10n';
import {
  attendanceRate,
  getStudyCrew,
  publishState,
  recruitState,
  toISODate,
  type AttendanceStatus,
  type Crew,
  type CrewStatus,
  type Study,
} from '@studyclub/mock';
import { Badge } from '@studyclub/ui';
import { ArrowLeft } from 'lucide-react';

/**
 * 스터디 운영 콘솔.
 *
 * 한 스터디를 놓고 운영자가 하는 일은 셋뿐이라 탭도 셋이다:
 * **신청자**(누가 들어오는가) · **출석**(누가 나오는가) · **정보**(무엇을 알리는가).
 *
 * 상태는 이 컴포넌트가 들고 있다 — 크루 승인이 출석부 명단을 바꾸므로 탭마다 따로 두면 어긋난다.
 * TODO(api): 승인·출석 체크는 화면 상태로만 처리. 저장 API 연결 필요.
 */

const TABS = [
  { key: 'crew', label: '신청자' },
  { key: 'attendance', label: '출석' },
  { key: 'info', label: '정보' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export function StudyConsole({ study }: { study: Study }) {
  const initial = useMemo(() => getStudyCrew(study), [study]);
  const [crew, setCrew] = useState<Crew[]>(initial.crew);
  const [attendance, setAttendance] = useState(initial.attendance);
  const [tab, setTab] = useState<TabKey>('crew');

  const active = crew.filter((c) => c.status === 'active');
  const pending = crew.filter((c) => c.status === 'pending');
  const open = recruitState(study) === 'apply';
  const deadline = toISODate(study.recruitment?.deadline);
  const scheduled = publishState(study) === 'scheduled';

  // 스터디 전체 출석률 — 크루별 출석률의 평균이 아니라 **전체 체크 건수 기준**.
  // 평균을 쓰면 한 번만 나온 사람과 열 번 나온 사람이 같은 무게가 된다.
  // 지각은 참석으로 센다(개인 출석률과 같은 기준).
  const overall = useMemo(() => {
    let present = 0;
    let total = 0;
    for (const c of active) {
      for (const v of Object.values(attendance[c.id] ?? {})) {
        total += 1;
        if (v !== 'absent') present += 1;
      }
    }
    return total === 0 ? undefined : Math.round((present / total) * 100);
  }, [active, attendance]);

  function setStatus(crewId: string, status: CrewStatus) {
    setCrew((list) => list.map((c) => (c.id === crewId ? { ...c, status } : c)));
  }

  function toggleAttendance(crewId: string, sessionId: string) {
    setAttendance((a) => {
      const row = { ...(a[crewId] ?? {}) };
      // 미체크 → 출석 → 지각 → 결석 → 미체크. 잘못 누른 것을 되돌릴 수 있어야 한다.
      const next: AttendanceStatus | undefined =
        row[sessionId] === undefined
          ? 'present'
          : row[sessionId] === 'present'
            ? 'late'
            : row[sessionId] === 'late'
              ? 'absent'
              : undefined;
      if (next === undefined) delete row[sessionId];
      else row[sessionId] = next;
      return { ...a, [crewId]: row };
    });
  }

  return (
    <div>
      <Link
        data-anno='1'
        href='/proto/console/studies'
        className='inline-flex items-center gap-1.5 text-sm font-medium text-fg-secondary transition-colors hover:text-fg'
      >
        <ArrowLeft size={15} /> 스터디 관리
      </Link>

      <header data-anno='2' className='mt-3 flex flex-wrap items-start justify-between gap-4'>
        <div className='min-w-0'>
          <h1 data-anno='2-1' className='text-2xl font-extrabold tracking-tight'>
            {tx(study.title)}
          </h1>
          <p className='mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-fg-secondary'>
            <span>{study.category ?? '—'}</span>
            {scheduled && (
              <>
                <span className='text-fg-muted'>·</span>
                <span className='font-semibold text-warning-700'>{toISODate(study.publish_at)} 공개</span>
              </>
            )}
          </p>
        </div>
        <div data-anno='2-2' className='flex shrink-0 items-center gap-2'>
          <Badge tone={open ? 'recruiting' : 'closed'} dot className='px-2.5 py-1 font-semibold'>
            {open ? '모집중' : '마감'}
          </Badge>
          <span className='tnum text-xs text-fg-muted'>{deadline ? `~${deadline}` : open ? '상시' : ''}</span>
        </div>
      </header>

      {/* 운영자가 매일 확인하는 숫자 — 탭을 옮겨 다니지 않아도 보이게 위에 둔다 */}
      <div data-anno='3' className='mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4'>
        <Stat
          anno='3-1'
          label='진행 일정'
          value={study.schedule ? tx(study.schedule) : '미정 · 신청자 조율'}
          small
          sub={`${initial.sessions.length}회차`}
        />
        <Stat anno='3-2' label='참석자' value={`${active.length}/${initial.capacity}`} />
        <Stat
          anno='3-3'
          label='승인 대기'
          value={`${pending.length}`}
          tone={pending.length > 0 ? 'warn' : undefined}
        />
        <Stat anno='3-4' label='출석률' value={overall === undefined ? '—' : `${overall}%`} />
      </div>

      <nav data-anno='4' className='mt-6 flex gap-1 border-b border-border'>
        {TABS.map((tb) => (
          <button
            key={tb.key}
            type='button'
            onClick={() => setTab(tb.key)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
              tab === tb.key ? 'border-brand text-fg' : 'border-transparent text-fg-muted hover:text-fg-secondary'
            }`}
          >
            {tb.label}
            {tb.key === 'crew' && pending.length > 0 && (
              <span className='ml-1.5 rounded-full bg-warning-100 px-1.5 py-0.5 text-[11px] font-bold text-warning-700'>
                {pending.length}
              </span>
            )}
          </button>
        ))}
      </nav>

      <div data-anno='5' className='mt-5'>
        {tab === 'crew' && <CrewTab crew={crew} capacity={initial.capacity} onStatus={setStatus} />}
        {tab === 'attendance' && (
          <AttendanceTab
            study={study}
            crew={active}
            sessions={initial.sessions}
            attendance={attendance}
            onToggle={toggleAttendance}
          />
        )}
        {tab === 'info' && <StudyInfoTab study={study} />}
      </div>
    </div>
  );
}

function Stat({
  anno,
  label,
  value,
  tone,
  /** 일정처럼 글자로 된 값 — 숫자와 같은 크기로 두면 줄이 넘쳐 카드 높이가 어긋난다 */
  small,
  sub,
}: {
  /** 번호 주석 배지 앵커. 프로토 전용 — 실제 서비스 동작에는 영향이 없다. */
  anno?: string;
  label: string;
  value: string;
  tone?: 'warn';
  small?: boolean;
  sub?: string;
}) {
  return (
    <div data-anno={anno} className='card px-4 py-3'>
      <p className='text-xs font-medium text-fg-muted'>{label}</p>
      <p
        className={`mt-0.5 font-extrabold ${small ? 'truncate text-[15px] leading-7' : 'tnum text-xl'} ${
          tone === 'warn' ? 'text-warning-700' : 'text-fg'
        }`}
        title={small ? value : undefined}
      >
        {value}
      </p>
      {sub && <p className='tnum -mt-0.5 text-[11px] font-medium text-fg-muted'>{sub}</p>}
    </div>
  );
}

export { attendanceRate };
