'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { getUser } from '@core/lib/auth';
import { clearDrafts, LOGIN_SCENARIOS, ONBOARDING_SCENARIOS, SUCCESS_KEY } from '@core/lib/onboarding';
import { CheckCircle2, RotateCcw, X } from 'lucide-react';

const LABELS = {
  ko: {
    default: '기본 화면',
    empty: '필수값 누락',
    nickname: '닉네임 형식 오류',
    duplicate: '닉네임 중복',
    server: '서버 오류',
    expired: '세션 만료',
    loading: '제출 중',
    new: '신규 가입',
    returning: '온보딩 미완료',
    existing: '기존 회원',
    cancelled: '인증 취소',
    error: '로그인 실패',
  },
  en: {
    default: 'Default',
    empty: 'Missing fields',
    nickname: 'Invalid nickname',
    duplicate: 'Nickname taken',
    server: 'Server error',
    expired: 'Session expired',
    loading: 'Submitting',
    new: 'New member',
    returning: 'Unfinished signup',
    existing: 'Existing member',
    cancelled: 'Sign-in cancelled',
    error: 'Sign-in failed',
  },
};

/** Review controls belong to the playground chrome, not the service's signup form. */
export function RegistrationPreviewToolbar() {
  const path = usePathname();
  const search = useSearchParams();
  const router = useRouter();
  if (!/\/(login|onboarding)$/.test(path)) return null;
  const locale = path.includes('/core/en/') ? 'en' : 'ko';
  const ko = locale === 'ko';
  const onboarding = path.endsWith('/onboarding');
  const scenarios = onboarding ? ONBOARDING_SCENARIOS : LOGIN_SCENARIOS;
  const current = scenarios.find((value) => value === search.get('scenario')) ?? scenarios[0];
  function navigate(scenario: string, reset = false) {
    if (reset) clearDrafts();
    const params = new URLSearchParams(search.toString());
    params.set('scenario', scenario);
    if (reset) params.set('reset', String(Date.now()));
    router.replace(`${path}?${params}`, { scroll: false });
  }

  return (
    <aside
      aria-label={ko ? '가입 화면 검토 도구' : 'Signup preview controls'}
      className='border-b border-border bg-surface-1'
    >
      <div className='mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-5 py-2.5 text-xs sm:px-6'>
        <span className='font-semibold text-fg-muted'>{ko ? '가입 화면 미리보기' : 'Signup preview'}</span>
        <div className='flex gap-3'>
          <Link
            href={`/proto/core/${locale}/login?scenario=new`}
            className={!onboarding ? 'font-semibold text-brand' : 'text-fg-muted'}
          >
            {ko ? '로그인' : 'Login'}
          </Link>
          <Link
            href={`/proto/core/${locale}/onboarding?scenario=default`}
            className={onboarding ? 'font-semibold text-brand' : 'text-fg-muted'}
          >
            {ko ? '온보딩' : 'Onboarding'}
          </Link>
        </div>
        <div className='flex flex-wrap items-center gap-2 sm:ml-auto'>
          <label htmlFor='registration-scenario' className='text-fg-muted'>
            {ko ? '화면 상태' : 'Scenario'}
          </label>
          <select
            id='registration-scenario'
            value={current}
            onChange={(event) => navigate(event.target.value)}
            className='min-h-9 rounded-control border border-border-strong bg-bg px-2 text-xs focus-visible:outline-none focus-visible:shadow-(--ring)'
          >
            {scenarios.map((value) => (
              <option key={value} value={value}>
                {LABELS[locale][value]}
              </option>
            ))}
          </select>
          <button
            type='button'
            onClick={() => navigate(current, true)}
            className='inline-flex min-h-9 items-center gap-1 rounded-control px-2 text-fg-muted hover:bg-surface-2 focus-visible:outline-none focus-visible:shadow-(--ring)'
          >
            <RotateCcw size={13} />
            {ko ? '초기화' : 'Reset'}
          </button>
        </div>
      </div>
    </aside>
  );
}

export function RegistrationFeedback() {
  const path = usePathname();
  const router = useRouter();
  const [notice, setNotice] = useState<{ nickname: string; locale: string } | null>(null);
  useEffect(() => {
    if (/\/(login|onboarding)$/.test(path)) {
      setNotice(null);
      return;
    }
    const locale = path.includes('/core/en') ? 'en' : 'ko';
    if (/^\/proto\/core\/(ko|en)\/my(?:\/|$)/.test(path) && getUser()?.onboardingCompletedAt === null) {
      router.replace(`/proto/core/${locale}/onboarding?next=${encodeURIComponent(path)}`);
    }
    try {
      const value = sessionStorage.getItem(SUCCESS_KEY);
      if (value) {
        const parsed = JSON.parse(value);
        if (typeof parsed?.nickname === 'string') setNotice(parsed);
        sessionStorage.removeItem(SUCCESS_KEY);
      }
    } catch {
      /* Completion navigation works without storage. */
    }
  }, [path, router]);
  if (!notice) return null;
  const ko = notice.locale === 'ko';
  return (
    <div
      role='status'
      className='fixed bottom-20 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center gap-3 rounded-card border border-border bg-bg p-4 shadow-lg'
    >
      <CheckCircle2 size={21} className='shrink-0 text-success-700' aria-hidden='true' />
      <p className='flex-1 text-sm font-medium'>
        {ko ? `${notice.nickname}님, 가입이 완료됐어요!` : `Welcome, ${notice.nickname}! Your sign-up is complete.`}
      </p>
      <button
        type='button'
        onClick={() => setNotice(null)}
        aria-label={ko ? '안내 닫기' : 'Dismiss notification'}
        className='rounded-control p-2 text-fg-muted hover:bg-surface-1'
      >
        <X size={16} />
      </button>
    </div>
  );
}
