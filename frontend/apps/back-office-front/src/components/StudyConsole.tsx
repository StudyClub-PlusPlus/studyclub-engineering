'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Badge, Button, Modal } from '@studyclub/ui';
import { useIsMutating } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';

import { StudyInfoTab } from '@/components/StudyInfoTab';
import { ApplicationFormTab } from '@/features/application-form/ApplicationFormTab';
import { ApplicationResultsTab } from '@/features/application-results/ApplicationResultsTab';
import { AttendanceTab } from '@/features/attendance/AttendanceTab';
import { DiscardGroupChangesDialog } from '@/features/participants/DiscardGroupChangesDialog';
import { ParticipantsTab } from '@/features/participants/ParticipantsTab';
import { participantKeys, useParticipants } from '@/features/participants/queries';
import { ScheduleTab } from '@/features/schedule/ScheduleTab';
import { DISPLAY_ZONES } from '@/features/schedule/time';
import { CATEGORY_OPTIONS, STATUS_LABEL, type ApiStudyDetail } from '@/features/studies/types';
import { useUrlState } from '@/lib/use-url-state';

const TABS = [
  { key: 'info', label: '정보' },
  { key: 'form', label: '신청 폼' },
  { key: 'results', label: '신청 결과' },
  { key: 'crew', label: '신청자' },
  { key: 'schedule', label: '일정' },
  { key: 'attendance', label: '출석' },
] as const;

const TAB_DEFAULTS = { tab: 'info' };
const TAB_ALLOWED = { tab: TABS.map(({ key }) => key) };

type TabKey = (typeof TABS)[number]['key'];

/** 나가기 전 확인 창의 문구 — 고친 것이 있는 탭마다. */
const LEAVE_COPY: Partial<Record<TabKey, string>> = {
  schedule: '저장을 누르지 않으면 고친 일정·규칙이 사라집니다.',
  attendance: '저장을 누르지 않으면 고친 출석이 사라집니다. 나가기 전에 저장해 주세요.',
};

const categoryLabel = (code: string) => CATEGORY_OPTIONS.find((c) => c.value === code)?.label ?? code;

export function StudyConsole({ detail }: { detail: ApiStudyDetail }) {
  const [{ tab }, setUrl] = useUrlState(TAB_DEFAULTS, TAB_ALLOWED);
  const setTab = useCallback((key: TabKey) => setUrl({ tab: key }, { reset: true }), [setUrl]);
  const [pendingTab, setPendingTab] = useState<TabKey | null>(null);
  const [savingForm, setSavingForm] = useState(false);
  const [dirtyParticipants, setDirtyParticipants] = useState(false);
  const savingParticipants = useIsMutating({ mutationKey: participantKeys.assignments(detail.id) }) > 0;
  const router = useRouter();
  // 보고 있는 탭(일정 · 출석)의 저장 전 고침. 탭 · 반 · 링크를 누르면 나가기 전에 한 번 묻는다
  const [dirty, setDirty] = useState(false);
  // 고른 반 — 일정 탭과 출석 탭이 같이 쓴다. 비면 첫 반
  const [groupId, setGroupId] = useState('');
  // 출석부 회차 머리의 시간대 — 반을 바꿔도 남는다. 처음엔 KST
  const [zone, setZone] = useState<string>(DISPLAY_ZONES[0].iana);
  /** 출석 탭의 「회차 추가하러 가기」로 넘어왔으면 일정 탭에서 회차 추가 창을 바로 연다. */
  const [addOnOpen, setAddOnOpen] = useState(false);
  const startedAdding = useCallback(() => setAddOnOpen(false), []);
  const [leaving, setLeaving] = useState(false);
  const pendingLeave = useRef<(() => void) | null>(null);
  /** 뒤로가기를 붙잡으려고 쌓아 둔 같은 주소의 기록 칸이 지금 맨 위에 있는가. */
  const guardEntry = useRef(false);
  /** 새로고침 · 창 닫기 · 페이지 밖 이동 때 브라우저가 물을까. 「나가기」를 고르면 바로 끈다 — 두 번 묻지 않게. */
  const unloadGuard = useRef(false);
  useEffect(() => {
    unloadGuard.current = dirty;
  }, [dirty]);
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!unloadGuard.current) return;
      e.preventDefault();
      e.returnValue = '';
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  /** 저장하지 않은 고침이 있으면 확인 창을 띄우고, 없으면 바로 간다. */
  function guard(go: () => void) {
    if (!dirty) {
      go();
      return;
    }
    pendingLeave.current = go;
    setLeaving(true);
  }

  function confirmLeave() {
    const go = pendingLeave.current;
    pendingLeave.current = null;
    unloadGuard.current = false;
    setLeaving(false);
    setDirty(false);
    go?.();
  }

  // 옆 메뉴 · 목록 링크도 같은 확인을 거친다. 새 창 · 수정키 클릭은 그대로 둔다
  useEffect(() => {
    if (!dirty) return;
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      const el = (e.target as Element | null)?.closest?.('a[href]');
      if (!(el instanceof HTMLAnchorElement) || el.target === '_blank' || el.hasAttribute('download')) return;
      const href = el.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
      const url = new URL(href, window.location.href);
      if (url.origin === window.location.origin && url.pathname === window.location.pathname) return;
      e.preventDefault();
      e.stopPropagation();
      pendingLeave.current = () => {
        // 뒤로가기용 기록 칸이 남아 있으면 그 칸을 새 주소로 갈아 끼운다 — 나간 뒤 뒤로가기 한 번에 이 화면으로 온다
        const replace = guardEntry.current;
        guardEntry.current = false;
        if (url.origin !== window.location.origin) {
          if (replace) window.location.replace(url.href);
          else window.location.assign(url.href);
          return;
        }
        const path = `${url.pathname}${url.search}${url.hash}`;
        if (replace) router.replace(path);
        else router.push(path);
      };
      setLeaving(true);
    }
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [dirty, router]);

  // 브라우저 뒤로가기도 같은 확인을 거친다. 저장 전 고침이 생기면 같은 주소의 기록 칸을 하나 더 쌓아 두고,
  // 뒤로가기가 그 칸을 지우면(화면은 그대로) 묻는다. Next 라우터가 읽는 history.state 를 그대로 복사해야
  // 라우터가 낯선 기록으로 보고 새로고침하지 않는다.
  useEffect(() => {
    if (!dirty || leaving) return;
    if (!guardEntry.current) {
      window.history.pushState(window.history.state, '', window.location.href);
      guardEntry.current = true;
    }
    function onPopState() {
      guardEntry.current = false;
      pendingLeave.current = () => window.history.back();
      setLeaving(true);
    }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [dirty, leaving]);

  // 저장하거나 고침을 버려 깨끗해졌으면 쌓아 둔 기록 칸을 걷는다 — 남겨 두면 뒤로가기를 두 번 눌러야 나간다
  useEffect(() => {
    if (dirty || !guardEntry.current) return;
    guardEntry.current = false;
    window.history.back();
  }, [dirty]);

  const participantQuery = useParticipants(detail.id, tab === 'crew');
  const participantCount = participantQuery.data?.participantCount;
  const open = detail.recruitStatus === 'RECRUITING';
  const deadline = detail.recruitDeadlineAt
    ? new Date(detail.recruitDeadlineAt).toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
    : null;
  const unpublished = detail.status === 'DRAFT';

  return (
    <div>
      <DiscardGroupChangesDialog
        open={pendingTab !== null}
        busy={savingParticipants}
        onClose={() => setPendingTab(null)}
        onConfirm={() => {
          if (savingParticipants) return;
          if (pendingTab) setTab(pendingTab);
          setPendingTab(null);
          setDirtyParticipants(false);
        }}
      />
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
                <span className='font-semibold text-warning-700'>비공개: 사용자 사이트에 안 보임</span>
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
      <div className='mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3'>
        <Stat label='진행 일정' value={detail.schedule || '미정 · 신청자 조율'} small />
        <Stat
          label='참석자'
          value={participantCount == null ? '-' : String(participantCount)}
          sub={detail.capacity == null ? '정원 제한 없음' : `정원 ${detail.capacity}명`}
        />
        <Stat label='출석률' value='-' />
      </div>

      <nav className='mt-6 flex gap-1 border-b border-border'>
        {TABS.map((tb) => (
          <button
            key={tb.key}
            type='button'
            disabled={savingForm || savingParticipants}
            onClick={() => {
              if (tb.key === tab) return;
              // 신청자 탭(반 편성)과 일정 탭은 저장 전 고침을 따로 묻는다 — 한 번에 한 탭만 열려 있다
              if (dirtyParticipants) setPendingTab(tb.key);
              else guard(() => setTab(tb.key));
            }}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
              tab === tb.key ? 'border-brand text-fg' : 'border-transparent text-fg-muted hover:text-fg-secondary'
            }`}
          >
            {tb.label}
          </button>
        ))}
      </nav>

      <div className='mt-5'>
        {tab === 'results' && <ApplicationResultsTab studyId={detail.id} onEditForm={() => setTab('form')} />}
        {tab === 'attendance' && (
          <AttendanceTab
            detail={detail}
            groupId={groupId}
            onGroup={setGroupId}
            onDirtyChange={setDirty}
            guard={guard}
            zone={zone}
            onZone={setZone}
            onGoCrew={() => guard(() => setTab('crew'))}
            onAddMeeting={() => {
              // 고친 출석이 남아 있으면 먼저 묻는다 — 창은 일정 탭에 바로 들어갈 때만 연다
              if (!dirty) setAddOnOpen(true);
              guard(() => setTab('schedule'));
            }}
          />
        )}
        {tab === 'crew' && <ParticipantsTab studyId={detail.id} onDirtyChange={setDirtyParticipants} />}
        {tab === 'schedule' && (
          <ScheduleTab
            detail={detail}
            groupId={groupId}
            onGroup={setGroupId}
            onDirtyChange={setDirty}
            guard={guard}
            startAdding={addOnOpen}
            onStartedAdding={startedAdding}
          />
        )}
        {tab === 'form' && <ApplicationFormTab study={detail} onSavingChange={setSavingForm} />}
        {tab === 'info' && <StudyInfoTab detail={detail} onSavingChange={setSavingForm} />}
      </div>

      <Modal
        open={leaving}
        onClose={() => setLeaving(false)}
        title='저장하지 않은 변경이 있습니다'
        footer={
          <>
            <Button variant='secondary' onClick={confirmLeave}>
              저장하지 않고 나가기
            </Button>
            <Button onClick={() => setLeaving(false)}>이 화면에 머물기</Button>
          </>
        }
      >
        <p className='text-sm text-fg-secondary'>{LEAVE_COPY[tab as TabKey] ?? LEAVE_COPY.schedule}</p>
      </Modal>
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
        className={`mt-0.5 font-extrabold ${small ? 'truncate text-sm leading-7' : 'tnum text-xl'} ${
          tone === 'warn' ? 'text-warning-700' : 'text-fg'
        }`}
        title={small ? value : undefined}
      >
        {value}
      </p>
      {sub && <p className='tnum -mt-0.5 text-xs font-medium text-fg-muted'>{sub}</p>}
    </div>
  );
}
