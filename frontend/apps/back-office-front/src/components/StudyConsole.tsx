'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { Badge, Button, Modal } from '@studyclub/ui';
import { ArrowLeft } from 'lucide-react';

import { StudyInfoTab } from '@/components/StudyInfoTab';
import { ApplicationFormTab } from '@/features/application-form/ApplicationFormTab';
import { ApplicationResultsTab } from '@/features/application-results/ApplicationResultsTab';
import { ApplicationsTab } from '@/features/applications/ApplicationsTab';
import { useApplications } from '@/features/applications/queries';
import { ScheduleTab } from '@/features/schedule/ScheduleTab';
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

const categoryLabel = (code: string) => CATEGORY_OPTIONS.find((c) => c.value === code)?.label ?? code;

export function StudyConsole({ detail }: { detail: ApiStudyDetail }) {
  const [{ tab }, setUrl] = useUrlState(TAB_DEFAULTS, TAB_ALLOWED);
  const [savingForm, setSavingForm] = useState(false);
  const router = useRouter();
  // 일정 탭의 저장 전 고침(일정 표 · 규칙). 탭 · 반 · 링크를 누르면 나가기 전에 한 번 묻는다
  const [scheduleDirty, setScheduleDirty] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const pendingLeave = useRef<(() => void) | null>(null);
  /** 뒤로가기를 붙잡으려고 쌓아 둔 같은 주소의 기록 칸이 지금 맨 위에 있는가. */
  const guardEntry = useRef(false);
  /** 새로고침 · 창 닫기 · 페이지 밖 이동 때 브라우저가 물을까. 「나가기」를 고르면 바로 끈다 — 두 번 묻지 않게. */
  const unloadGuard = useRef(false);
  useEffect(() => {
    unloadGuard.current = scheduleDirty;
  }, [scheduleDirty]);
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
    if (!scheduleDirty) {
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
    setScheduleDirty(false);
    go?.();
  }

  // 옆 메뉴 · 목록 링크도 같은 확인을 거친다. 새 창 · 수정키 클릭은 그대로 둔다
  useEffect(() => {
    if (!scheduleDirty) return;
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
  }, [scheduleDirty, router]);

  // 브라우저 뒤로가기도 같은 확인을 거친다. 저장 전 고침이 생기면 같은 주소의 기록 칸을 하나 더 쌓아 두고,
  // 뒤로가기가 그 칸을 지우면(화면은 그대로) 묻는다. Next 라우터가 읽는 history.state 를 그대로 복사해야
  // 라우터가 낯선 기록으로 보고 새로고침하지 않는다.
  useEffect(() => {
    if (!scheduleDirty || leaving) return;
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
  }, [scheduleDirty, leaving]);

  // 저장하거나 고침을 버려 깨끗해졌으면 쌓아 둔 기록 칸을 걷는다 — 남겨 두면 뒤로가기를 두 번 눌러야 나간다
  useEffect(() => {
    if (scheduleDirty || !guardEntry.current) return;
    guardEntry.current = false;
    window.history.back();
  }, [scheduleDirty]);

  const applicationQuery = useApplications(detail.id, tab === 'crew');
  const applications = applicationQuery.isError ? undefined : applicationQuery.data?.applications;
  const pendingCount = applications?.filter((application) => application.status === 'PENDING').length;
  const open = detail.recruitStatus === 'RECRUITING';
  const deadline = detail.recruitDeadlineAt
    ? new Date(detail.recruitDeadlineAt).toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
    : null;
  const unpublished = detail.status === 'DRAFT';

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
        <Stat label='진행 일정' value={detail.schedule || '미정 · 신청자 조율'} small />
        {/* TODO(api): 참석자·출석률 — 출석 명부 API 가 분반(studyGroupId)을 받는데 상세 응답에 분반이 없다 */}
        <Stat label='참석자' value='—' sub={detail.capacity == null ? '정원 제한 없음' : `정원 ${detail.capacity}명`} />
        <Stat
          label='승인 대기'
          value={pendingCount == null ? '—' : `${pendingCount}`}
          tone={pendingCount ? 'warn' : undefined}
        />
        <Stat label='출석률' value='—' />
      </div>

      <nav className='mt-6 flex gap-1 border-b border-border'>
        {TABS.map((tb) => (
          <button
            key={tb.key}
            type='button'
            disabled={savingForm}
            onClick={() => {
              if (tb.key !== tab) guard(() => setUrl({ tab: tb.key }, { reset: true }));
            }}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
              tab === tb.key ? 'border-brand text-fg' : 'border-transparent text-fg-muted hover:text-fg-secondary'
            }`}
          >
            {tb.label}
            {tb.key === 'crew' && pendingCount != null && pendingCount > 0 && (
              <span className='ml-1.5 rounded-full bg-warning-100 px-1.5 py-0.5 text-xs font-bold text-warning-700'>
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </nav>

      <div className='mt-5'>
        {tab === 'results' && (
          <ApplicationResultsTab
            studyId={detail.id}
            onEditForm={() => setUrl({ tab: 'form' }, { reset: true })}
          />
        )}
        {tab === 'attendance' && (
          <div className='card px-6 py-10 text-center text-sm text-fg-muted'>출석 관리는 준비 중입니다.</div>
        )}
        {tab === 'crew' && <ApplicationsTab studyId={detail.id} />}
        {tab === 'schedule' && <ScheduleTab detail={detail} onDirtyChange={setScheduleDirty} guard={guard} />}
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
        <p className='text-sm text-fg-secondary'>저장을 누르지 않으면 고친 일정·규칙이 사라집니다.</p>
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
