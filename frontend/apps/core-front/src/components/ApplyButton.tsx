'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { Loader2 } from 'lucide-react';
import { createPortal } from 'react-dom';

import { ApplyDialog } from '@/components/ApplyDialog';
import { ApplyDiscordGate } from '@/components/ApplyDiscordGate';
import { useMyApplication } from '@/features/applications/queries';
import { track } from '@/lib/analytics';
import { shouldWaitForMyApplication } from '@/lib/apply-intent-resume';
import { clearSession, getUser } from '@/lib/auth';
import type { Locale, Study } from '@/lib/content';
import { fetchDiscordLinkState, forgetDiscordLinkState } from '@/lib/discord';
import { t } from '@/lib/i18n';
import { addApplication, getApplication } from '@/lib/me';
import { withApplyIntent, withoutApplyIntent } from '@/lib/onboarding';
import { recruitLabel, recruitState } from '@/lib/recruit';

export function ApplyButton({ study, locale }: { study: Study; locale: Locale }) {
  const router = useRouter();
  const pathname = usePathname();
  const [formOpen, setFormOpen] = useState(false);
  const [discordOpen, setDiscordOpen] = useState(false);
  const [alreadyApplied, setAlreadyApplied] = useState(false);
  const [deadlineLabel, setDeadlineLabel] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  /** GET /api/me 로 연동 여부를 묻는 중 — 두 번 눌러 창이 겹치지 않게 막는다 */
  const [checking, setChecking] = useState(false);
  /** 연동 여부를 기다리는 사이 페이지를 떠났으면 창을 열거나 이동하지 않는다 */
  const mounted = useRef(true);
  /** apply=1 복귀 소비는 한 번만 — 의존성이 바뀌어도 폼을 다시 열지 않는다 */
  const consumedApplyIntent = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const state = recruitState(study);
  const applyLabel = deadlineLabel ?? recruitLabel(state, locale);
  const doneLabel = t({ ko: '신청 완료', en: 'Applied' }, locale);

  const isUser = Boolean(getUser());
  // isFetched: apply=1 복귀 때 신청 여부 조회가 끝나기 전에 의도를 소비하면, myApp 갱신으로
  // effect 가 재실행·cancel 되고 버튼이 로딩에 갇힌다 (#376 리뷰).
  const { data: myApp, isFetched: myAppFetched } = useMyApplication(study.study_id, isUser);

  useEffect(() => {
    setReady(true);
    const local = Boolean(getApplication(study.id));
    if (local || myApp?.applied) {
      setAlreadyApplied(true);
      if (myApp?.applied && !local) {
        addApplication({
          studyId: study.id,
          appliedAt: myApp.submittedAt?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
          status: 'pending',
          region: 'KR',
        });
      }
    }
  }, [study.id, myApp]);

  // 로그인·온보딩·디스코드 연결에서 돌아온 신청 의도(apply=1)를 소비한다.
  useEffect(() => {
    if (consumedApplyIntent.current || !ready) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get('apply') !== '1') return;
    // 로그인 사용자는 내 신청 조회가 끝난 뒤에만 소비한다 — 신청 여부를 먼저 판정한다
    if (shouldWaitForMyApplication(isUser, myAppFetched)) return;

    consumedApplyIntent.current = true;
    const clean = withoutApplyIntent(`${url.pathname}${url.search}${url.hash}`);
    router.replace(clean, { scroll: false });

    const user = getUser();
    if (!user?.onboardingCompletedAt) return;
    if (state === 'closed' || Boolean(getApplication(study.id)) || myApp?.applied) return;

    let cancelled = false;
    void (async () => {
      setChecking(true);
      try {
        const linkState = await fetchDiscordLinkState(user.id);
        if (cancelled || !mounted.current) return;
        if (linkState === 'unauthorized') {
          clearSession();
          router.push(`/${locale}/login?next=${encodeURIComponent(withApplyIntent(pathname))}`);
          return;
        }
        if (linkState === 'unlinked') {
          setDiscordOpen(true);
          return;
        }
        setFormOpen(true);
      } finally {
        // cancel·언마운트여도 로딩을 푼다 — consumed 만 남고 checking 이 true 로 남는 경우를 막는다
        if (mounted.current) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, state, study.id, myApp?.applied, myAppFetched, isUser, pathname, locale, router]);

  const isClosed = state === 'closed' || Boolean(deadlineLabel);

  const card = 'inline-flex items-center rounded-pill px-8 py-3 type-label-lg';
  const live =
    'bg-brand text-on-brand shadow-sm transition-[background-color,transform] hover:bg-brand-hover hover:scale-[1.02] focus-visible:outline-none focus-visible:shadow-(--ring)';
  const idle = 'bg-surface-2 text-fg-placeholder';

  async function requestApply() {
    if (alreadyApplied || checking) return;
    track({
      name: 'Study Apply CTA Clicked',
      props: {
        study_id: String(study.study_id),
        study_title_ko: study.title.ko,
        study_category: study.category ?? '',
        study_status: study.status,
        has_external_form: false,
      },
    });
    const nextWithApply = withApplyIntent(pathname);
    const loginPath = `/${locale}/login?next=${encodeURIComponent(nextWithApply)}`;
    const user = getUser();
    if (!user) {
      router.push(loginPath);
      return;
    }
    if (!user.onboardingCompletedAt) {
      router.push(`/${locale}/onboarding?next=${encodeURIComponent(nextWithApply)}`);
      return;
    }
    // 연동 여부는 서버(ACCOUNT.DISCORD_ID)가 정본이다. 모르면(조회 실패 · 필드 없음) 폼을 열고,
    // 제출이 403 으로 막히면 그때 연동 창을 연다(onRequireDiscord).
    setChecking(true);
    const linkState = await fetchDiscordLinkState(user.id);
    if (!mounted.current) return;
    setChecking(false);
    if (linkState === 'unauthorized') {
      clearSession();
      router.push(loginPath);
      return;
    }
    if (linkState === 'unlinked') {
      setDiscordOpen(true);
      return;
    }
    setFormOpen(true);
  }

  function handleLinked() {
    setDiscordOpen(false);
    setFormOpen(true);
  }

  function handleSubmitted() {
    setFormOpen(false);
    setAlreadyApplied(true);
  }

  // 외부 신청 폼(구글 폼 등)이 있으면 그쪽으로 보낸다.
  if (study.recruit_url && !isClosed) {
    return (
      <a
        href={study.recruit_url}
        target='_blank'
        rel='noopener noreferrer'
        className={`${card} ${live}`}
        onClick={() => {
          track({
            name: 'Study Apply CTA Clicked',
            props: {
              study_id: String(study.study_id),
              study_title_ko: study.title.ko,
              study_category: study.category ?? '',
              study_status: study.status,
              has_external_form: true,
            },
          });
          track({
            name: 'Study Apply External Opened',
            props: { study_id: String(study.study_id), study_title_ko: study.title.ko },
          });
        }}
      >
        {applyLabel}
      </a>
    );
  }

  const trigger = isClosed ? (
    <span className={`${card} ${idle}`}>{applyLabel}</span>
  ) : ready && alreadyApplied ? (
    <button type='button' disabled className={`${card} ${idle}`}>
      {doneLabel}
    </button>
  ) : (
    <button
      type='button'
      onClick={requestApply}
      disabled={checking}
      aria-busy={checking}
      className={`${card} ${live} gap-2 disabled:cursor-wait disabled:opacity-80`}
    >
      {checking && <Loader2 size={16} className='animate-spin' aria-hidden />}
      {applyLabel}
    </button>
  );

  if (isClosed) return trigger;

  const dialogs = (
    <>
      <ApplyDiscordGate
        locale={locale}
        open={discordOpen}
        onClose={() => setDiscordOpen(false)}
        onLinked={handleLinked}
      />
      <ApplyDialog
        study={study}
        locale={locale}
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmitted={handleSubmitted}
        onDeadline={(label) => setDeadlineLabel(label)}
        onRequireDiscord={() => {
          const user = getUser();
          if (user) forgetDiscordLinkState(user.id);
          setFormOpen(false);
          setDiscordOpen(true);
        }}
      />
    </>
  );

  return (
    <>
      {trigger}
      {ready ? createPortal(dialogs, document.body) : null}
    </>
  );
}
