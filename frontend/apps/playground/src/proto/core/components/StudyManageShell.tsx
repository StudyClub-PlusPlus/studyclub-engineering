'use client';

import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { getUser } from '@core/lib/auth';
import { t } from '@core/lib/i18n';
import { MANAGE_ROLE_LABEL, manageAccessOf, type NavigatorGroup } from '@core/lib/meetings';
import { studies, type Study } from '@studyclub/mock';
import { Badge, Button, Modal, cx } from '@studyclub/ui';
import { ArrowLeft } from 'lucide-react';

/**
 * 스터디 관리 — 네비게이터가 맡은 분반을 사용자 사이트에서 굴리는 곳.
 *
 * 일정(회차 추가·수정·삭제)과 출석부 두 탭. 창 위에 창을 띄우는 대신 페이지로 뺐다 —
 * 회차 목록과 출석 격자는 넓은 화면이 필요하다.
 *
 * 범위는 **맡은 분반**이다. 스터디 전체 참여자는 백오피스 출석부에서 본다(캡틴).
 */

type ManageCtx = {
  study: Study;
  group: NavigatorGroup;
  locale: string;
  captain: boolean;
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
  const base = `/proto/core/${locale}/my/joined/${id}/manage`;

  const [ready, setReady] = useState(false);
  const [dirty, setDirty] = useState(false);
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
    if (!dirty) return;
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
  }, [dirty]);

  // 주소 값은 study_id(STUDY.ID) 다. 역할 판정은 내부 키(슬러그)로 한다.
  const study = studies.find((s) => String(s.study_id) === id);
  const access = study ? manageAccessOf(study.id) : undefined;

  if (!ready) return <div className='px-6 py-16 text-center text-sm text-fg-secondary'>불러오는 중…</div>;

  if (!study || !access) {
    return (
      <div className='mx-auto max-w-3xl px-6 py-16 text-center'>
        <p className='font-bold text-fg'>이 스터디를 관리할 수 없습니다.</p>
        <p className='mt-1.5 text-sm text-fg-muted'>네비게이터나 캡틴으로 맡은 스터디만 여기서 관리합니다.</p>
        <Link
          href={`/proto/core/${locale}/my/joined`}
          className='mt-4 inline-block text-sm font-semibold text-brand underline-offset-4 hover:underline'
        >
          내 스터디로
        </Link>
      </div>
    );
  }

  const { role, group } = access;
  const captain = role === 'captain';
  const tabs = [
    { href: `${base}/schedule`, label: '일정' },
    { href: `${base}/attendance`, label: '출석부' },
  ];

  return (
    <Ctx.Provider value={{ study, group, locale, captain, setDirty }}>
      <div className='mx-auto max-w-5xl px-6 pb-16 pt-8'>
        <Link
          href={`/proto/core/${locale}/my/joined`}
          className='inline-flex items-center gap-1.5 text-sm font-medium text-fg-secondary hover:text-fg'
        >
          <ArrowLeft size={15} /> 내 스터디
        </Link>

        <header data-anno='manage:1' className='mt-3 flex flex-wrap items-start justify-between gap-3'>
          <div className='min-w-0'>
            <h1 className='text-2xl font-extrabold tracking-tight'>{t(study.title, locale === 'en' ? 'en' : 'ko')}</h1>
            <p data-anno='manage:1-1' className='mt-1.5 flex flex-wrap items-center gap-2 text-sm text-fg-secondary'>
              <Badge tone={role}>{MANAGE_ROLE_LABEL[role]}</Badge>
              <span>
                <b className='font-semibold text-fg'>{group.name}</b> · 한국 시간(KST) 기준
              </span>
            </p>
          </div>
        </header>

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
                router.push(to);
              }}
            >
              저장하지 않고 나가기
            </Button>
            <Button onClick={() => setLeaveTo(null)}>이 화면에 머물기</Button>
          </>
        }
      >
        <p className='text-sm text-fg-secondary'>저장을 누르지 않으면 고친 출석이 사라집니다. 나가기 전에 저장해 주세요.</p>
      </Modal>
    </Ctx.Provider>
  );
}
