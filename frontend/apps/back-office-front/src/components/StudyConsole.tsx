'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import {
  attendanceRate,
  attendancePoint,
  getStudyCrew,
  type AttendanceStatus,
  type Study,
  type StudyCrewData,
} from '@studyclub/mock';
import { Badge } from '@studyclub/ui';
import { ArrowLeft } from 'lucide-react';

import { AttendanceTab } from '@/components/AttendanceTab';
import { StudyInfoTab } from '@/components/StudyInfoTab';
import { ApplicationFormTab } from '@/features/application-form/ApplicationFormTab';
import { ApplicationsTab } from '@/features/applications/ApplicationsTab';
import { useApplications } from '@/features/applications/queries';
import { CATEGORY_OPTIONS, STATUS_LABEL, type ApiStudyDetail } from '@/features/studies/types';

const TABS = [
  { key: 'info', label: '정보' },
  { key: 'form', label: '신청 폼' },
  { key: 'crew', label: '신청자' },
  { key: 'attendance', label: '출석' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

const EMPTY_CREW: StudyCrewData = { crew: [], meetings: [], attendance: {}, capacity: 0 };

const categoryLabel = (code: string) => CATEGORY_OPTIONS.find((c) => c.value === code)?.label ?? code;

export function StudyConsole({ detail, mockStudy }: { detail: ApiStudyDetail; mockStudy?: Study }) {
  const initial = useMemo(() => (mockStudy ? getStudyCrew(mockStudy) : EMPTY_CREW), [mockStudy]);
  const crew = initial.crew;
  const [attendance, setAttendance] = useState(initial.attendance);
  const [tab, setTab] = useState<TabKey>('info');
  const [savingForm, setSavingForm] = useState(false);

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('tab');
    if (!TABS.some(({ key }) => key === requested)) return;
    setTab(requested as TabKey);
  }, []);

  const active = crew;
  const applicationQuery = useApplications(detail.id, tab === 'crew');
  const applications = applicationQuery.isError ? undefined : applicationQuery.data?.applications;
  const pendingCount = applications?.filter((application) => application.status === 'PENDING').length;
  const open = detail.recruitStatus === 'RECRUITING';
  const deadline = detail.recruitDeadlineAt
    ? new Date(detail.recruitDeadlineAt).toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
    : null;
  const unpublished = detail.status === 'DRAFT';

  // 스터디 전체 출석률 — 크루별 출석률의 평균이 아니라 **전체 대상 회차 기준**.
  // 평균을 쓰면 한 번만 나온 사람과 열 번 나온 사람이 같은 무게가 된다.
  // 분자: present + late × W. 개인 출석률과 같은 기준이다.
  const overall = useMemo(() => {
    let score = 0;
    let total = 0;
    for (const c of active) {
      for (const v of Object.values(attendance[c.id] ?? {})) {
        if (v === 'excused') continue;
        total += 1;
        score += attendancePoint(v);
      }
    }
    return total === 0 ? undefined : Math.round((score / total) * 100);
  }, [active, attendance]);

  // TODO(api): POST /api/studies/{id}/attendances — 출석 체크 저장
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
        href='/studies'
        className='inline-flex items-center gap-1.5 text-sm font-medium text-fg-secondary transition-colors hover:text-fg'
      >
        <ArrowLeft size={15} /> 스터디 관리
      </Link>

      <header className='mt-3 flex flex-wrap items-start justify-between gap-4'>
        <div className='min-w-0'>
          <h1 className='text-2xl font-extrabold tracking-tight'>{detail.title}</h1>
          <p className='mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-fg-secondary'>
            <span>{categoryLabel(detail.category)}</span>
            <span className='text-fg-muted'>·</span>
            <span>{detail.studyKind === 'CLUB' ? '클럽' : '스터디'}</span>
            {unpublished && (
              <>
                <span className='text-fg-muted'>·</span>
                <span className='font-semibold text-warning-700'>비공개 — 사용자 사이트에 안 보임</span>
              </>
            )}
          </p>
        </div>
        <div className='flex shrink-0 items-center gap-2'>
          <Badge tone={open ? 'recruiting' : 'closed'} dot className='px-2.5 py-1 font-semibold'>
            {detail.status === 'OPEN' ? (open ? '모집중' : '모집 마감') : STATUS_LABEL[detail.status]}
          </Badge>
          {deadline && <span className='tnum text-xs text-fg-muted'>~{deadline}</span>}
        </div>
      </header>

      {/* 운영자가 매일 확인하는 숫자 — 탭을 옮겨 다니지 않아도 보이게 위에 둔다 */}
      <div className='mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4'>
        <Stat
          label='진행 일정'
          value={detail.schedule || '미정 · 신청자 조율'}
          small
          sub={mockStudy ? `${initial.meetings.length}회차` : undefined}
        />
        <Stat
          label='참석자'
          value={mockStudy ? `${active.length}/${initial.capacity}` : '—'}
          sub={detail.capacity == null ? '정원 제한 없음' : `정원 ${detail.capacity}명`}
        />
        <Stat
          label='승인 대기'
          value={pendingCount == null ? '—' : `${pendingCount}`}
          tone={pendingCount ? 'warn' : undefined}
        />
        <Stat label='출석률' value={overall === undefined ? '—' : `${overall}%`} />
      </div>

      <nav className='mt-6 flex gap-1 border-b border-border'>
        {TABS.map((tb) => (
          <button
            key={tb.key}
            type='button'
            disabled={savingForm}
            onClick={() => setTab(tb.key)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
              tab === tb.key ? 'border-brand text-fg' : 'border-transparent text-fg-muted hover:text-fg-secondary'
            }`}
          >
            {tb.label}
            {tb.key === 'crew' && pendingCount != null && pendingCount > 0 && (
              <span className='ml-1.5 rounded-full bg-warning-100 px-1.5 py-0.5 text-[11px] font-bold text-warning-700'>
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </nav>

      <div className='mt-5'>
        {tab === 'attendance' && !mockStudy && (
          <div className='card px-6 py-10 text-center text-sm text-fg-muted'>출석 관리는 준비 중입니다.</div>
        )}
        {tab === 'crew' && <ApplicationsTab studyId={detail.id} />}
        {tab === 'attendance' && mockStudy && (
          <AttendanceTab
            study={mockStudy}
            crew={active}
            meetings={initial.meetings}
            attendance={attendance}
            onToggle={toggleAttendance}
          />
        )}
        {tab === 'form' && <ApplicationFormTab study={detail} onSavingChange={setSavingForm} />}
        {tab === 'info' && <StudyInfoTab detail={detail} />}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
  /** 일정처럼 글자로 된 값 — 숫자와 같은 크기로 두면 줄이 넘쳐 카드 높이가 어긋난다 */
  small,
  sub,
}: {
  label: string;
  value: string;
  tone?: 'warn';
  small?: boolean;
  sub?: string;
}) {
  return (
    <div className='card px-4 py-3'>
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
