'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { ApplicationFormTab } from '@console/components/ApplicationFormTab';
import { AttendanceTab } from '@console/components/AttendanceTab';
import { CrewTab } from '@console/components/CrewTab';
import { ResultsTab } from '@console/components/ResultsTab';
import { StudyCreateDialog } from '@console/components/StudyCreateDialog';
import { StudyInfoTab } from '@console/components/StudyInfoTab';
import type { StudyClass } from '@console/lib/classes';
import { tx } from '@console/lib/l10n';
import { applyRule, ruleFromMeetings } from '@console/lib/schedule';
import {
  attendanceRate,
  getStudyCrew,
  publishState,
  recruitState,
  toISODate,
  todayISO,
  type AttendanceStatus,
  type Crew,
  type Study,
} from '@studyclub/mock';
import { Badge, Button, Modal } from '@studyclub/ui';
import { ArrowLeft, Plus } from 'lucide-react';

import { useAnnotate } from '@/proto/annotate';

/**
 * 스터디 운영 콘솔.
 *
 * 한 스터디를 놓고 캡틴이 하는 일은 다섯이라 탭도 다섯이다:
 * **정보**(무엇을 알리는가) · **신청 폼**(어떻게 물어보는가) · **신청 결과**(뭐라고 답했는가) ·
 * **신청자**(누가 들어오고 어느 반인가) · **출석**(누가 나오는가).
 *
 * 상태는 이 컴포넌트가 들고 있다 — 반 배정이 출석부 명단을 바꾸므로 탭마다 따로 두면 어긋난다.
 * TODO(api): 반 편성·출석 체크는 화면 상태로만 처리. 저장 API 연결 필요.
 */

const TABS = [
  { key: 'info', label: '정보' },
  { key: 'form', label: '신청 폼' },
  { key: 'results', label: '신청 결과' },
  { key: 'crew', label: '신청자' },
  { key: 'attendance', label: '출석' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

type LeaveIntent = { kind: 'tab'; tab: TabKey } | { kind: 'href'; href: string };

export function StudyConsole({ study }: { study: Study }) {
  const router = useRouter();
  const initial = useMemo(() => getStudyCrew(study), [study]);
  const [crew] = useState<Crew[]>(initial.crew);
  const [attendance, setAttendance] = useState(initial.attendance);
  // 회차는 진행 일정 규칙이 만든다. 규칙이 바뀌면 오늘 이후 회차만 다시 깔린다 — 찍은 출석은 남는다.
  // 반 (ERD STUDY_CLASS). 회차·출석은 반에 붙는다 — 반이 다르면 모이는 날이 다르다.
  // 프로토는 이미 회차가 있는 스터디를 열므로, 그 회차가 선 반 하나를 기본으로 둔다.
  const [classes, setClasses] = useState<StudyClass[]>(() => [
    { id: 'c1', rule: ruleFromMeetings(study, initial.meetings) },
  ]);
  const [classId, setClassId] = useState('c1');
  const [meetings, setMeetings] = useState<Record<string, typeof initial.meetings>>({ c1: initial.meetings });
  // 크루가 어느 반에 속하는가. 반 이동은 이 값을 바꾼다.
  const [assign, setAssign] = useState<Record<string, string>>(() =>
    Object.fromEntries(initial.crew.filter((c) => c.status === 'active').map((c) => [c.id, 'c1'])),
  );
  // 이 스터디를 맡은 크루. 역할은 스터디마다 따로 서므로 전역 역할 값과 섞지 않는다.
  // TODO(api): STUDY_PARTICIPANT 에 담당 표시가 필요하다. 지금은 화면 상태로만 둔다.
  const [navigators, setNavigators] = useState<string[]>([]);
  const [tab, setTab] = useState<TabKey>('info');
  const [attendanceDirty, setAttendanceDirty] = useState(false);
  const [leave, setLeave] = useState<LeaveIntent | null>(null);
  const [nextOpen, setNextOpen] = useState(false);

  // 스토리 칩을 고르면 그 Story 의 요소가 **보이는 탭**으로 옮겨 준다.
  // 「참석자 목록」을 골랐는데 정보 탭이 떠 있으면 명단 번호가 화면에 없어 대조할 수가 없다.
  const { spec, on } = useAnnotate();
  const storyTab: Partial<Record<string, TabKey>> = {
    attendee: 'crew',
    crew: 'crew',
    class: 'crew',
    attendance: 'attendance',
    edit: 'info',
    form: 'form',
    results: 'results',
  };
  const wanted = spec?.scope ? storyTab[spec.scope] : undefined;
  useEffect(() => {
    if (on && wanted) setTab(wanted);
  }, [on, wanted]);

  const active = crew.filter((c) => c.status === 'active');
  const open = recruitState(study) === 'apply';
  const deadline = toISODate(study.recruitment?.deadline);
  // 마감까지 남은 날. 마감일은 필수라 늘 있다 — 값이 비어 있는 옛 데이터만 undefined.
  const dday =
    deadline === undefined
      ? undefined
      : Math.round((Date.parse(`${deadline}T00:00:00Z`) - Date.parse(`${todayISO()}T00:00:00Z`)) / 86_400_000);
  // 아직 켜지 않은 스터디는 사이트에 없다 — 헤더에서 그 사실을 알린다.
  const draft = publishState(study) === 'draft';

  /** 반을 만들거나 고친다. 일정이 바뀌면 **오늘 이후 회차만** 다시 깔린다 — 찍은 출석은 남는다. */
  function saveClass(cls: StudyClass) {
    setClasses((list) =>
      list.some((c) => c.id === cls.id) ? list.map((c) => (c.id === cls.id ? cls : c)) : [...list, cls],
    );
    setMeetings((prev) => ({ ...prev, [cls.id]: applyRule(cls.id, prev[cls.id] ?? [], cls.rule, todayISO()) }));
    setClassId(cls.id);
  }

  function removeClass(id: string) {
    setClasses((list) => {
      const next = list.filter((c) => c.id !== id);
      setClassId((cur) => (cur === id ? (next[0]?.id ?? '') : cur));
      return next;
    });
    setMeetings((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  /** 칸을 눌러 고친 값을 한 번에 반영한다. 한 칸마다 따로 보내지 않는다. */
  async function saveAttendance(next: Record<string, Record<string, AttendanceStatus>>) {
    // TODO(api): POST /api/studies/{id}/attendances — 바뀐 칸만 updates[] 로 한 번에 보낸다.
    await new Promise((r) => setTimeout(r, 400));
    setAttendance(next);
  }

  function requestTab(next: TabKey) {
    if (next === tab) return;
    if (tab === 'attendance' && attendanceDirty) {
      setLeave({ kind: 'tab', tab: next });
      return;
    }
    setTab(next);
  }

  function confirmLeave() {
    if (!leave) return;
    const intent = leave;
    setLeave(null);
    setAttendanceDirty(false);
    if (intent.kind === 'tab') {
      setTab(intent.tab);
      return;
    }
    if (/^https?:\/\//.test(intent.href)) {
      window.location.assign(intent.href);
      return;
    }
    router.push(intent.href);
  }

  useEffect(() => {
    if (tab !== 'attendance' || !attendanceDirty) return;

    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      const el = (e.target as Element | null)?.closest?.('a[href]');
      if (!(el instanceof HTMLAnchorElement)) return;
      const href = el.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
      if (el.target === '_blank' || el.hasAttribute('download')) return;

      const url = new URL(href, window.location.href);
      if (
        url.origin === window.location.origin &&
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      ) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      setLeave({
        kind: 'href',
        href: url.origin === window.location.origin ? `${url.pathname}${url.search}${url.hash}` : url.href,
      });
    }

    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [tab, attendanceDirty]);

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
          {/* 기수를 잇는 것은 클럽뿐이다 — 스터디는 기수가 1개라 새 공고는 새 프로그램이다 */}
          {study.program?.kind === 'club' && (
            <Button size='sm' variant='secondary' leadingIcon={<Plus size={14} />} onClick={() => setNextOpen(true)}>
              다음 기수 만들기
            </Button>
          )}
          <Badge tone={open ? 'recruiting' : 'closed'} dot className='px-2.5 py-1 font-semibold'>
            {/* 마감까지 남은 날은 상태의 일부다 — 날짜를 보려고 탭을 옮기게 하지 않는다 */}
            {open ? (dday === undefined ? '모집중' : dday === 0 ? '오늘 마감' : `모집중 · D-${dday}`) : '모집 마감'}
          </Badge>
          {draft && (
            <Badge tone='closingsoon' className='px-2.5 py-1 font-semibold'>
              미공개
            </Badge>
          )}
        </div>
      </header>

      {/*
        지표 카드를 두지 않는다. 넷 다 탭이 이미 말한다 —
        진행 일정은 반, 참석자는 크루 탭, 출석률은 출석 탭.
        같은 숫자를 위에도 두면 어느 쪽이 정본인지 헷갈리고, 기준이 갈리면 서로 안 맞는다.
      */}
      <nav data-anno='attendee:2 crew:1 results:1' className='mt-6 flex gap-1 border-b border-border'>
        {TABS.map((tb) => (
          <button
            key={tb.key}
            type='button'
            onClick={() => requestTab(tb.key)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
              tab === tb.key ? 'border-brand text-fg' : 'border-transparent text-fg-muted hover:text-fg-secondary'
            }`}
          >
            {tb.label}
            {tb.key === 'attendance' && attendanceDirty && (
              <span data-anno='attendance:8' className='ml-1.5 text-[11px] font-bold text-brand'>
                저장 전
              </span>
            )}
          </button>
        ))}
      </nav>

      <div className='mt-5'>
        {tab === 'crew' && (
          <CrewTab
            crew={crew}
            capacity={initial.capacity}
            classes={classes}
            assign={assign}
            onAddClass={saveClass}
            onRemoveClass={removeClass}
            onAssign={(crewId, id) => setAssign((a) => ({ ...a, [crewId]: id }))}
            navigators={navigators}
            onToggleNavigator={(crewId) =>
              setNavigators((ns) => (ns.includes(crewId) ? ns.filter((n) => n !== crewId) : [...ns, crewId]))
            }
          />
        )}
        {tab === 'attendance' && (
          <AttendanceTab
            study={study}
            crew={active.filter((c) => assign[c.id] === classId)}
            classes={classes}
            classId={classId}
            onClass={setClassId}
            meetings={meetings[classId] ?? []}
            attendance={attendance}
            onSave={saveAttendance}
            onDirtyChange={setAttendanceDirty}
            onGoCrew={() => requestTab('crew')}
          />
        )}
        {tab === 'form' && <ApplicationFormTab study={study} />}
        {tab === 'results' && <ResultsTab study={study} crew={crew} />}
        {tab === 'info' && <StudyInfoTab study={study} />}
      </div>

      <StudyCreateDialog open={nextOpen} onClose={() => setNextOpen(false)} nextOf={study} />

      <Modal
        open={leave !== null}
        onClose={() => setLeave(null)}
        title='저장하지 않은 변경이 있습니다'
        footer={
          <>
            <Button variant='secondary' onClick={confirmLeave}>
              저장하지 않고 나가기
            </Button>
            <Button onClick={() => setLeave(null)}>이 화면에 머물기</Button>
          </>
        }
      >
        <p data-anno='attendance:9' className='text-sm text-fg-secondary'>
          저장을 누르지 않으면 고친 출석이 사라집니다. 나가기 전에 저장해 주세요.
        </p>
      </Modal>
    </div>
  );
}

export { attendanceRate };
