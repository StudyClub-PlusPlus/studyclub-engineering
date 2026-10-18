'use client';

import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import type { Study } from '@studyclub/mock';
import { Button, Modal, cx } from '@studyclub/ui';
import { ArrowLeft, ExternalLink } from 'lucide-react';

import { StudyInfoCard } from '@/components/StudyInfoCard';
import { useStudyDetail, useStudyGroupInfo } from '@/features/studies/queries';
import { getUser } from '@/lib/auth';
import type { Locale } from '@/lib/content';
import { t } from '@/lib/i18n';
import { type NavigatorGroup, type ScheduleRole } from '@/lib/meetings';

type ManageCtx = {
  study: Study;
  group: NavigatorGroup;
  groupId: number;
  locale: string;
  role: ScheduleRole;
  captain: boolean;
  canEdit: boolean;
  setDirty: (dirty: boolean) => void;
};

const BACKOFFICE_BASE = process.env.NEXT_PUBLIC_BACKOFFICE_URL ?? 'http://localhost:4701';

const Ctx = createContext<ManageCtx | null>(null);

export function useManage(): ManageCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useManage 는 StudyManageShell 안에서만 쓴다');
  return v;
}

export function StudyManageShell({ children }: { children: ReactNode }) {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const locale = ((params?.locale as string) ?? 'ko') as Locale;
  const id = typeof params?.id === 'string' ? params.id : '';
  const base = `/${locale}/my/joined/${id}/schedule`;

  const [ready, setReady] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [rulesDirty, setRulesDirty] = useState(false);
  const anyDirty = dirty || rulesDirty;
  const [leaveTo, setLeaveTo] = useState<string | null>(null);

  useEffect(() => {
    if (!getUser()) {
      router.replace(`/${locale}/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    setReady(true);
  }, [locale, pathname, router]);

  useEffect(() => {
    if (!anyDirty) return;
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      const el = (e.target as Element | null)?.closest?.('a[href]');
      if (!(el instanceof HTMLAnchorElement) || el.target === '_blank') return;
      const url = new URL(el.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      e.preventDefault();
      e.stopPropagation();
      setLeaveTo(`${url.pathname}${url.search}`);
    }
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [anyDirty]);

  const { data: study, isPending, isError } = useStudyDetail(Number(id));
  const { data: groupInfo, isPending: groupPending, isError: groupError } = useStudyGroupInfo(Number(id));

  if (!ready || isPending || groupPending) {
    return <div className='px-6 py-16 text-center text-sm text-fg-secondary'>불러오는 중…</div>;
  }

  if (isError || !study || groupError || !groupInfo) {
    return (
      <div className='mx-auto max-w-3xl px-6 py-16 text-center'>
        <p className='font-bold text-fg'>이 스터디의 일정을 볼 수 없습니다.</p>
        <p className='mt-1.5 text-sm text-fg-muted'>참여 중인 스터디만 여기서 일정을 봅니다.</p>
        <Link
          href={`/${locale}/my/joined`}
          className='mt-4 inline-block text-sm font-semibold text-brand underline-offset-4 hover:underline'
        >
          내 스터디룸으로
        </Link>
      </div>
    );
  }

  const groupId = groupInfo.studyGroup.id;
  const group: NavigatorGroup = {
    id: String(groupInfo.studyGroup.id),
    name: groupInfo.studyGroup.name,
    timeZone: groupInfo.studyGroup.timezone,
    startAt: groupInfo.studyGroup.startTime,
  };
  const canEdit = groupInfo.me.canEdit;
  const captain = Boolean(groupInfo.me.captain || groupInfo.me.participantId === null);
  const role: ScheduleRole = captain ? 'captain' : canEdit ? 'navigator' : 'crew';

  const tabs = [
    { href: base, label: '일정' },
    { href: `${base}/attendance`, label: '출석' },
  ];

  return (
    <Ctx.Provider value={{ study, group, groupId, locale, role, captain, canEdit, setDirty }}>
      <div className='mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6'>
        <Link
          href={`/${locale}/my/joined`}
          className='inline-flex items-center gap-1.5 text-sm font-medium text-fg-secondary hover:text-fg'
        >
          <ArrowLeft size={15} /> 내 스터디룸
        </Link>
        <header className='mt-3 flex flex-wrap items-start justify-between gap-3'>
          <h1 className='text-2xl font-extrabold tracking-tight'>{t(study.title, locale === 'en' ? 'en' : 'ko')}</h1>
        </header>
        <div className='mt-5'>
          <StudyInfoCard
            study={study}
            group={group}
            groupId={groupId}
            canEdit={canEdit}
            onDirty={setRulesDirty}
            discordChannelUrl={groupInfo.study.discordChannelUrl}
            driveUrlOverride={groupInfo.study.driveUrl}
            navigatorName={groupInfo.studyGroup.navigatorName}
            initialRules={groupInfo.studyGroup.rules}
            leadingAction={
              captain ? (
                <Button
                  size='sm'
                  variant='secondary'
                  trailingIcon={<ExternalLink size={14} />}
                  onClick={() => window.open(`${BACKOFFICE_BASE}/studies/${study.id}?tab=attendance`, '_blank')}
                >
                  백오피스 출석부
                </Button>
              ) : null
            }
          />
        </div>
        <nav className='mt-6 flex gap-1 border-b border-border'>
          {tabs.map((tb) => {
            const on = pathname === tb.href;
            return (
              <Link
                key={tb.href}
                href={tb.href}
                aria-current={on ? 'page' : undefined}
                className={cx(
                  '-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors',
                  on ? 'border-brand text-fg' : 'border-transparent text-fg-muted hover:text-fg-secondary',
                )}
              >
                {tb.label}
              </Link>
            );
          })}
        </nav>
        <div className='mt-5'>{children}</div>
      </div>
      <Modal
        open={leaveTo !== null}
        onClose={() => setLeaveTo(null)}
        title='저장하지 않은 변경이 있습니다'
        footer={
          <>
            <Button
              variant='secondary'
              onClick={() => {
                const to = leaveTo!;
                setLeaveTo(null);
                setDirty(false);
                setRulesDirty(false);
                router.push(to);
              }}
            >
              저장하지 않고 나가기
            </Button>
            <Button onClick={() => setLeaveTo(null)}>이 화면에 머물기</Button>
          </>
        }
      >
        <p className='text-sm text-fg-secondary'>
          저장을 누르지 않으면 고친 내용이 사라집니다. 나가기 전에 저장해 주세요.
        </p>
      </Modal>
    </Ctx.Provider>
  );
}
