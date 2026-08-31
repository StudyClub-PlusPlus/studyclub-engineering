'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { studies as allStudies, type Study } from '@studyclub/mock';
import { CalendarClock } from 'lucide-react';

import { categoryGradient, categoryMeta } from '@/components/StudyThumb';
import {
  STATUS_LABEL,
  STATUS_STYLE,
  checkIn,
  getMyAttendance,
  myRate,
  resolveStatus,
  sessionWindow,
  sessionsOf,
  takeLeave,
  todaySession,
  type MyStatus,
} from '@/lib/attendance';
import { getUser } from '@/lib/auth';
import type { Locale } from '@/lib/content';
import { t } from '@/lib/i18n';
import { getApplications } from '@/lib/me';

/**
 * 내 스터디.
 *
 * 회원이 매주 하는 일은 **오늘 출석을 찍는 것** 하나라서, 그 버튼이 페이지 첫 화면에 있어야 한다.
 * 지난 출석은 따져볼 때만 보므로 탭 뒤에 둔다.
 *
 * 출석 상태는 누른 시각이 정한다 — 시작 15분 이내면 출석, 그 뒤는 지각, 회차가 끝나도록 누르지
 * 않으면 결석. 휴가는 미리 알리는 부재라 언제든 고를 수 있다.
 */

type Tab = 'today' | 'attendance';

function fmtTime(d: Date) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function MyStudiesPage() {
  const params = useParams();
  const router = useRouter();
  const locale = ((params?.locale as string) ?? 'ko') as Locale;

  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>('today');
  const [mineIds, setMineIds] = useState<string[]>([]);
  /** 출석을 누르면 올려서 다시 읽는다(저장소가 localStorage 라 렌더 트리거가 없다). */
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!getUser()) {
      router.replace(`/${locale}/login?next=/${locale}/my/studies`);
      return;
    }
    setMineIds(
      getApplications()
        .filter((a) => a.status === 'accepted')
        .map((a) => a.studyId),
    );
    setReady(true);
  }, [locale, router]);

  /** 승인되어 참여 중인 스터디만. 신청 대기·종료된 스터디는 출석할 일이 없다. */
  const mine = useMemo<Study[]>(() => {
    const byId = new Map(allStudies.map((s) => [s.id, s]));
    return mineIds.map((id) => byId.get(id)).filter((s): s is Study => s !== undefined && s.status !== 'closed');
  }, [mineIds]);

  if (!ready) {
    return <div className='px-6 py-16 text-center text-sm text-fg-secondary'>불러오는 중…</div>;
  }

  return (
    <div className='mx-auto max-w-3xl px-6 pb-16 pt-8'>
      <h1 className='text-2xl font-extrabold tracking-tight'>내 스터디</h1>

      <nav className='mt-5 inline-flex rounded-pill bg-surface-2 p-1'>
        {(
          [
            { key: 'today', label: '오늘 출석' },
            { key: 'attendance', label: '출석 현황' },
          ] as const
        ).map((tb) => (
          <button
            key={tb.key}
            type='button'
            onClick={() => setTab(tb.key)}
            className={`rounded-pill px-4 py-1.5 text-sm font-bold transition-colors ${
              tab === tb.key ? 'bg-bg text-fg shadow-sm' : 'text-fg-secondary hover:text-fg'
            }`}
          >
            {tb.label}
          </button>
        ))}
      </nav>

      {mine.length === 0 ? (
        <p className='mt-8 rounded-card border border-dashed border-border px-6 py-10 text-center text-sm text-fg-secondary'>
          참여 중인 스터디가 없습니다.{' '}
          <Link href={`/${locale}/studies`} className='font-semibold text-brand underline-offset-4 hover:underline'>
            스터디 둘러보기
          </Link>
        </p>
      ) : tab === 'today' ? (
        <ul className='mt-5 flex flex-col gap-3'>
          {mine.map((s) => (
            <TodayCard key={`${s.id}-${tick}`} study={s} locale={locale} onChange={() => setTick((n) => n + 1)} />
          ))}
        </ul>
      ) : (
        <div className='mt-5 flex flex-col gap-5'>
          {mine.map((s) => (
            <AttendanceCard key={`${s.id}-${tick}`} study={s} locale={locale} />
          ))}
        </div>
      )}
    </div>
  );
}

/** 오늘 회차 — 출석/휴가를 여기서 바로 누른다. */
function TodayCard({ study, locale, onChange }: { study: Study; locale: Locale; onChange: () => void }) {
  const [stored, setStored] = useState<Record<string, MyStatus>>({});
  useEffect(() => setStored(getMyAttendance(study.id)), [study.id]);

  const { icon: Icon, label } = categoryMeta(study.category);
  const session = todaySession(study);
  const status = session ? resolveStatus(study, session, stored) : undefined;
  const win = session ? sessionWindow(study, session) : null;

  function act(next: 'in' | 'leave') {
    if (!session) return;
    if (next === 'in') checkIn(study, session);
    else takeLeave(study, session);
    setStored(getMyAttendance(study.id));
    onChange();
  }

  return (
    <li className='card flex items-center gap-4 px-5 py-4'>
      <span
        className='grid h-11 w-11 shrink-0 place-items-center rounded-card text-white'
        style={{ background: categoryGradient(study.category) }}
        aria-hidden='true'
      >
        <Icon size={18} strokeWidth={1.75} />
      </span>

      <div className='min-w-0 flex-1'>
        <Link
          href={`/${locale}/studies/${study.id}`}
          className='block truncate font-bold text-fg underline-offset-4 hover:underline'
        >
          {t(study.title, locale)}
        </Link>
        <p className='mt-0.5 flex items-center gap-1.5 truncate text-[13px] text-fg-secondary'>
          <span className='shrink-0 text-fg-muted'>{label}</span>
          <span className='text-fg-muted'>·</span>
          <CalendarClock size={12} strokeWidth={1.75} className='shrink-0' />
          {session && win ? (
            <span className='tnum truncate'>
              오늘 {session.no}회차 {fmtTime(win.start)}~{fmtTime(win.end)}
            </span>
          ) : (
            <span className='truncate'>오늘 회차 없음</span>
          )}
        </p>
      </div>

      {session &&
        (status ? (
          <span className={`shrink-0 rounded-pill px-3 py-1.5 text-xs font-bold ${STATUS_STYLE[status]}`}>
            {STATUS_LABEL[status]}
          </span>
        ) : (
          <span className='flex shrink-0 gap-1.5'>
            <button
              type='button'
              onClick={() => act('in')}
              className='rounded-pill bg-brand px-4 py-2 text-[13px] font-bold text-on-brand transition-colors hover:bg-brand-hover'
            >
              출석
            </button>
            <button
              type='button'
              onClick={() => act('leave')}
              className='rounded-pill border border-border-strong px-4 py-2 text-[13px] font-bold text-fg-secondary transition-colors hover:bg-surface-2'
            >
              휴가
            </button>
          </span>
        ))}
    </li>
  );
}

/** 내 출석만 보는 표 — 운영자 출석부와 같은 모양(칸 = 회차). */
function AttendanceCard({ study, locale }: { study: Study; locale: Locale }) {
  const [stored, setStored] = useState<Record<string, MyStatus>>({});
  useEffect(() => setStored(getMyAttendance(study.id)), [study.id]);

  const sessions = sessionsOf(study);
  const rate = myRate(study, stored);

  return (
    <section className='card px-5 py-4'>
      <div className='flex items-baseline justify-between gap-3'>
        <Link
          href={`/${locale}/studies/${study.id}`}
          className='min-w-0 truncate font-bold text-fg underline-offset-4 hover:underline'
        >
          {t(study.title, locale)}
        </Link>
        <span className='tnum shrink-0 text-sm font-bold text-fg'>
          {rate === undefined ? <span className='text-fg-muted'>—</span> : `${rate}%`}
        </span>
      </div>

      <div className='no-scrollbar mt-3 overflow-x-auto'>
        <table className='w-full border-separate border-spacing-1 text-sm'>
          <thead>
            <tr>
              {sessions.map((se) => (
                <th
                  key={se.id}
                  className='tnum w-[3.4rem] px-0 pb-1 text-center text-[11px] font-semibold text-fg-secondary'
                >
                  {se.no}회<span className='block text-[10px] font-medium text-fg-muted'>{se.date.slice(5)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {sessions.map((se) => {
                const status = resolveStatus(study, se, stored);
                return (
                  <td key={se.id} className='p-0'>
                    <span
                      title={`${se.no}회차 ${se.date}`}
                      className={`grid h-8 w-full place-items-center rounded-sm text-[11px] font-bold ${
                        status ? STATUS_STYLE[status] : 'border border-dashed border-border-strong text-fg-muted'
                      }`}
                    >
                      {status ? STATUS_LABEL[status] : ''}
                    </span>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
