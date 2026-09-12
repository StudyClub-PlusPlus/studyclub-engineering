'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { ApplicationFormTab } from '@console/components/ApplicationFormTab';
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
  todayISO,
  type AttendanceStatus,
  type Crew,
  type CrewStatus,
  type Study,
} from '@studyclub/mock';
import { Badge } from '@studyclub/ui';
import { ArrowLeft } from 'lucide-react';

import { useAnnotate } from '@/proto/annotate';

/**
 * 스터디 운영 콘솔.
 *
 * 한 스터디를 놓고 캡틴(=운영자)이 하는 일은 넷이라 탭도 넷이다:
 * **신청자**(누가 들어오는가) · **출석**(누가 나오는가) · **신청 폼**(어떻게 물어보는가) · **정보**(무엇을 알리는가).
 *
 * 상태는 이 컴포넌트가 들고 있다 — 크루 승인이 출석부 명단을 바꾸므로 탭마다 따로 두면 어긋난다.
 * TODO(api): 승인·출석 체크는 화면 상태로만 처리. 저장 API 연결 필요.
 */

const TABS = [
  { key: 'info', label: '정보' },
  { key: 'form', label: '신청 폼' },
  { key: 'crew', label: '신청자' },
  { key: 'attendance', label: '출석' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export function StudyConsole({ study }: { study: Study }) {
  const initial = useMemo(() => getStudyCrew(study), [study]);
  const [crew, setCrew] = useState<Crew[]>(initial.crew);
  const [attendance, setAttendance] = useState(initial.attendance);
  const [tab, setTab] = useState<TabKey>('info');

  // 스토리 칩을 고르면 그 Story 의 요소가 **보이는 탭**으로 옮겨 준다.
  // 「참석자 목록」을 골랐는데 정보 탭이 떠 있으면 명단 번호가 화면에 없어 대조할 수가 없다.
  const { spec, on } = useAnnotate();
  const storyTab: Partial<Record<string, TabKey>> = { attendee: 'crew', crew: 'crew', edit: 'info', form: 'form' };
  const wanted = spec?.scope ? storyTab[spec.scope] : undefined;
  useEffect(() => {
    if (on && wanted) setTab(wanted);
  }, [on, wanted]);

  const active = crew.filter((c) => c.status === 'active');
  const pending = crew.filter((c) => c.status === 'pending');
  const open = recruitState(study) === 'apply';
  const deadline = toISODate(study.recruitment?.deadline);
  // 마감까지 남은 날. 마감일이 없으면(상시 모집) undefined.
  const dday =
    deadline === undefined
      ? undefined
      : Math.round((Date.parse(`${deadline}T00:00:00Z`) - Date.parse(`${todayISO()}T00:00:00Z`)) / 86_400_000);
  const scheduled = publishState(study) === 'scheduled';

  function setStatus(crewId: string, status: CrewStatus) {
    setCrew((list) => list.map((c) => (c.id === crewId ? { ...c, status } : c)));
  }

  function toggleAttendance(crewId: string, meetingId: string) {
    setAttendance((a) => {
      const row = { ...(a[crewId] ?? {}) };
      // 미체크 → 출석 → 지각 → 결석 → 휴가 → 미체크. 잘못 누른 것을 되돌릴 수 있어야 한다.
      const next: AttendanceStatus | undefined =
        row[meetingId] === undefined
          ? 'present'
          : row[meetingId] === 'present'
            ? 'late'
            : row[meetingId] === 'late'
              ? 'absent'
              : row[meetingId] === 'absent'
                ? 'excused'
                : undefined;
      if (next === undefined) delete row[meetingId];
      else row[meetingId] = next;
      return { ...a, [crewId]: row };
    });
  }

  return (
    <div>
      <Link
        href='/proto/console/studies'
        className='inline-flex items-center gap-1.5 text-sm font-medium text-fg-secondary transition-colors hover:text-fg'
      >
        <ArrowLeft size={15} /> 스터디 관리
      </Link>

      {/*
        헤더는 **상태**만 말한다. 날짜 값은 정보 탭이 갖는다.
        같은 값을 두 곳에 두면 어느 쪽이 정본인지 매번 헷갈리고, 고칠 때 한 곳만 고치게 된다.
        헤더가 답할 질문은 둘뿐이다 — 지금 신청을 받는가, 사이트에 보이는가.
      */}
      <header data-anno='attendee:1' className='mt-3 flex flex-wrap items-start justify-between gap-4'>
        <h1 data-anno='attendee:1-1' className='min-w-0 text-2xl font-extrabold tracking-tight'>
          {tx(study.title)}
        </h1>
        <div data-anno='attendee:1-2' className='flex shrink-0 items-center gap-2'>
          <Badge tone={open ? 'recruiting' : 'closed'} dot className='px-2.5 py-1 font-semibold'>
            {/* 마감까지 남은 날은 상태의 일부다 — 날짜를 보려고 탭을 옮기게 하지 않는다 */}
            {open ? (dday === undefined ? '상시 모집' : dday === 0 ? '오늘 마감' : `모집중 · D-${dday}`) : '모집 마감'}
          </Badge>
          {scheduled && (
            <Badge tone='closingsoon' className='px-2.5 py-1 font-semibold'>
              공개 예정
            </Badge>
          )}
        </div>
      </header>

      {/*
        지표 카드를 두지 않는다. 넷 다 탭이 이미 말한다 —
        진행 일정은 정보 탭, 참석자와 승인 대기는 신청자 탭(과 탭 배지), 출석률은 출석 탭.
        같은 숫자를 위에도 두면 어느 쪽이 정본인지 헷갈리고, 기준이 갈리면 서로 안 맞는다.
      */}
      <nav data-anno='attendee:2 crew:1' className='mt-6 flex gap-1 border-b border-border'>
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

      <div className='mt-5'>
        {tab === 'crew' && <CrewTab crew={crew} capacity={initial.capacity} onStatus={setStatus} />}
        {tab === 'attendance' && (
          <AttendanceTab
            study={study}
            crew={active}
            meetings={initial.meetings}
            attendance={attendance}
            onToggle={toggleAttendance}
          />
        )}
        {tab === 'form' && <ApplicationFormTab study={study} />}
        {tab === 'info' && <StudyInfoTab study={study} />}
      </div>
    </div>
  );
}

export { attendanceRate };
