'use client';

import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { StudyBoard } from '@core/components/StudyBoard';
import { getUser } from '@core/lib/auth';
import { t } from '@core/lib/i18n';
import { scheduleAccessOf, type NavigatorGroup, type ScheduleRole } from '@core/lib/meetings';
import { type Study } from '@studyclub/mock';
import { Button, Modal, cx } from '@studyclub/ui';
import { ArrowLeft } from 'lucide-react';

import { useMswStudies } from '@/proto/lib/use-msw-studies';

/**
 * 스터디 일정 — 구글 시트 출석부를 옮긴 곳. 그 스터디 참가자 누구나 들어온다.
 *
 * 일정(규칙 · 회차 · 발표자)과 출석부 두 탭. 창 위에 창을 띄우는 대신 페이지로 뺐다 —
 * 회차 목록과 출석 격자는 넓은 화면이 필요하다.
 *
 * 캡틴·네비게이터는 고치고, 크루는 본다(빈 발표자 칸 신청만 한다).
 * 범위는 **내 분반**이다. 스터디 전체 참여자는 백오피스 출석부에서 본다(캡틴).
 */

type ManageCtx = {
  study: Study;
  group: NavigatorGroup;
  locale: string;
  role: ScheduleRole;
  captain: boolean;
  /** 캡틴·네비게이터만 true. 크루는 조회(+ 발표 신청)만. */
  canEdit: boolean;
  setDirty: (dirty: boolean) => void;
};

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
  const locale = (params?.locale as string) ?? 'ko';
  const id = typeof params?.id === 'string' ? params.id : '';
  const base = `/proto/core/${locale}/my/joined/${id}/schedule`;

  const [ready, setReady] = useState(false);
  const [dirty, setDirty] = useState(false);
  /** 탭 위 규칙 카드의 저장하지 않은 글 — 탭의 고침과 따로 센다. */
  const [rulesDirty, setRulesDirty] = useState(false);
  const anyDirty = dirty || rulesDirty;
  const [leaveTo, setLeaveTo] = useState<string | null>(null);

  useEffect(() => {
    const user = getUser();
    if (!user) {
      router.replace(`/proto/core/${locale}/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    setReady(true);
  }, [locale, pathname, router]);

  // 출석부에 저장하지 않은 칸이 있으면, 탭·뒤로가기 링크를 누를 때 한 번 묻는다.
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

  const studies = useMswStudies();
  // 주소 값은 study_id(STUDY.ID) 다. 역할 판정은 내부 키(`id`)로 한다.
  const study = studies.find((s) => String(s.study_id) === id);
  // TODO(api): 참가자가 아닌 사람은 서버가 403 을 준다. 프로토는 찾은 스터디면 크루로 들인다.
  const access = study ? scheduleAccessOf(study) : undefined;

  if (!ready) return <div className='px-6 py-16 text-center text-sm text-fg-secondary'>불러오는 중…</div>;

  if (!study || !access) {
    return (
      <div className='mx-auto max-w-3xl px-6 py-16 text-center'>
        <p className='font-bold text-fg'>이 스터디의 일정을 볼 수 없습니다.</p>
        <p className='mt-1.5 text-sm text-fg-muted'>참여 중인 스터디만 여기서 일정을 봅니다.</p>
        <Link
          href={`/proto/core/${locale}/my/joined`}
          className='mt-4 inline-block text-sm font-semibold text-brand underline-offset-4 hover:underline'
        >
          내 스터디로
        </Link>
      </div>
    );
  }

  const { role, group, canEdit } = access;
  const captain = role === 'captain';
  const tabs = [
    { href: base, label: '일정' },
    { href: `${base}/attendance`, label: '출석부' },
  ];

  return (
    <Ctx.Provider value={{ study, group, locale, role, captain, canEdit, setDirty }}>
      {/* 일정 표(일자·시각·제목·발표자 두 칸)가 가로 스크롤 없이 들어가는 폭 */}
      <div className='mx-auto max-w-6xl px-6 pb-16 pt-8'>
        <Link
          href={`/proto/core/${locale}/my/joined`}
          className='inline-flex items-center gap-1.5 text-sm font-medium text-fg-secondary hover:text-fg'
        >
          <ArrowLeft size={15} /> 내 스터디
        </Link>

        <header data-anno='manage:1' className='mt-3 flex flex-wrap items-start justify-between gap-3'>
          <div className='min-w-0'>
            <h1 className='text-2xl font-extrabold tracking-tight'>{t(study.title, locale === 'en' ? 'en' : 'ko')}</h1>
          </div>
        </header>

        <div className='mt-5'>
          <StudyBoard study={study} group={group} role={role} canEdit={canEdit} onDirtyChange={setRulesDirty} />
        </div>

        <nav data-anno='manage:2' className='mt-6 flex gap-1 border-b border-border'>
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
