'use client';

import Link from 'next/link';
import { useState } from 'react';

import { Badge } from '@studyclub/ui';
import { useIsMutating } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';

import { StudyInfoTab } from '@/components/StudyInfoTab';
import { ApplicationFormTab } from '@/features/application-form/ApplicationFormTab';
import { DiscardGroupChangesDialog } from '@/features/participants/DiscardGroupChangesDialog';
import { ParticipantsTab } from '@/features/participants/ParticipantsTab';
import { participantKeys, useParticipants } from '@/features/participants/queries';
import { CATEGORY_OPTIONS, STATUS_LABEL, type ApiStudyDetail } from '@/features/studies/types';
import { useUrlState } from '@/lib/use-url-state';

const TABS = [
  { key: 'info', label: '정보' },
  { key: 'form', label: '신청 폼' },
  { key: 'crew', label: '신청자' },
  { key: 'attendance', label: '출석' },
] as const;

const TAB_DEFAULTS = { tab: 'info' };
const TAB_ALLOWED = { tab: TABS.map(({ key }) => key) };

type TabKey = (typeof TABS)[number]['key'];

const categoryLabel = (code: string) => CATEGORY_OPTIONS.find((c) => c.value === code)?.label ?? code;

export function StudyConsole({ detail }: { detail: ApiStudyDetail }) {
  const [{ tab }, setUrl] = useUrlState(TAB_DEFAULTS, TAB_ALLOWED);
  const [pendingTab, setPendingTab] = useState<TabKey | null>(null);
  const [savingForm, setSavingForm] = useState(false);
  const [dirtyParticipants, setDirtyParticipants] = useState(false);
  const savingParticipants = useIsMutating({ mutationKey: participantKeys.assignments(detail.id) }) > 0;

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
          if (pendingTab) setUrl({ tab: pendingTab });
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
              if (tb.key !== tab && dirtyParticipants) setPendingTab(tb.key);
              else setUrl({ tab: tb.key });
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
        {tab === 'attendance' && (
          <div className='card px-6 py-10 text-center text-sm text-fg-muted'>출석 관리는 준비 중입니다.</div>
        )}
        {tab === 'crew' && <ParticipantsTab studyId={detail.id} onDirtyChange={setDirtyParticipants} />}
        {tab === 'form' && <ApplicationFormTab study={detail} onSavingChange={setSavingForm} />}
        {tab === 'info' && <StudyInfoTab detail={detail} onSavingChange={setSavingForm} />}
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
