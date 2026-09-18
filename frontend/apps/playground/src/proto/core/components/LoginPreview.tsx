'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { getUser, setUser } from '@core/lib/auth';
import type { Locale } from '@core/lib/content';
import { clearDrafts, LOGIN_SCENARIOS, returnPath, type LoginScenario } from '@core/lib/onboarding';
import { Button } from '@studyclub/ui';
import { AlertCircle } from 'lucide-react';

import { SPEC } from '@/app/(proto)/proto/core/[locale]/login/spec';
import { ScreenSpecRegistrar } from '@/proto/annotate';

export function LoginPreview() {
  const { locale: param } = useParams();
  const locale: Locale = param === 'en' ? 'en' : 'ko';
  const search = useSearchParams();
  const scenario = LOGIN_SCENARIOS.find((value) => value === search.get('scenario')) ?? 'new';
  return (
    <LoginForm
      key={`${scenario}:${search.get('reset') ?? ''}:${locale}`}
      locale={locale}
      scenario={scenario}
      next={returnPath(search.get('next'), locale)}
      forcedPreview={search.has('scenario')}
    />
  );
}

function LoginForm({
  locale,
  scenario,
  next,
  forcedPreview,
}: {
  locale: Locale;
  scenario: LoginScenario;
  next: string;
  forcedPreview: boolean;
}) {
  const ko = locale === 'ko';
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(
    scenario === 'cancelled'
      ? ko
        ? '로그인이 취소됐어요. 다시 시도해 주세요.'
        : 'Sign-in was cancelled. Please try again.'
      : scenario === 'error'
        ? ko
          ? '로그인하지 못했어요. 잠시 후 다시 시도해 주세요.'
          : 'We couldn’t sign you in. Please try again.'
        : null,
  );
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const busy = useRef(false);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  useEffect(() => {
    if (!forcedPreview && getUser()?.onboardingCompletedAt) router.replace(next);
  }, [forcedPreview, next, router]);

  function startLogin() {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    setError(null);
    // Simulate a Google response. Playground never opens real OAuth.
    timer.current = setTimeout(() => {
      if (scenario !== 'returning') clearDrafts();
      const existing = scenario === 'existing';
      setUser({
        id: -1001,
        email: 'crew@example.com',
        nickname: existing ? 'Journey' : null,
        picture: null,
        role: 'MEMBER',
        timeZone: existing ? 'Asia/Seoul' : null,
        onboardingCompletedAt: existing ? '2026-09-01T00:00:00Z' : null,
      });
      router.replace(existing ? next : `/proto/core/${locale}/onboarding?next=${encodeURIComponent(next)}`);
    }, 700);
  }

  return (
    <div className='flex min-h-[72vh] items-center justify-center bg-surface-1 px-5 py-16'>
      <ScreenSpecRegistrar spec={SPEC} />
      <div className='w-full max-w-[420px]'>
        <div className='mb-8 text-center' data-anno='1'>
          <h1 className='text-[28px] font-bold tracking-tight'>
            {ko ? 'StudyClub++ 로그인' : 'Log in to StudyClub++'}
          </h1>
          <p className='mt-3 text-sm leading-relaxed text-fg-muted'>
            {ko ? '함께 배우고 성장하는 스터디를 만나보세요.' : 'Find your people. Learn and grow together.'}
          </p>
        </div>
        <div className='rounded-card border border-border bg-bg p-6 shadow-xs sm:p-8'>
          {error && (
            <p
              role='alert'
              className='mb-5 flex items-start gap-2 rounded-control bg-error-50 p-3 text-sm text-error-700'
              data-anno='3'
            >
              <AlertCircle size={17} className='mt-0.5 shrink-0' />
              {error}
            </p>
          )}
          <div data-anno='2'>
            <Button
              variant='secondary'
              size='lg'
              className='w-full text-sm'
              loading={loading}
              onClick={startLogin}
              leadingIcon={<GoogleIcon />}
            >
              {loading
                ? ko
                  ? '로그인 처리 중…'
                  : 'Signing in…'
                : ko
                  ? 'Google 계정으로 로그인'
                  : 'Continue with Google'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width='18' height='18' viewBox='0 0 24 24' aria-hidden='true'>
      <path
        fill='#4285F4'
        d='M23.06 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h6.2a5.3 5.3 0 0 1-2.3 3.48v2.89h3.72c2.18-2 3.44-4.96 3.44-8.38z'
      />
      <path
        fill='#34A853'
        d='M12 24c3.1 0 5.7-1.03 7.6-2.79l-3.72-2.89c-1.03.69-2.35 1.1-3.88 1.1-2.98 0-5.5-2.01-6.4-4.72H1.76v2.98A11.99 11.99 0 0 0 12 24z'
      />
      <path fill='#FBBC05' d='M5.6 14.7a7.2 7.2 0 0 1 0-4.6V7.12H1.76a12 12 0 0 0 0 10.56L5.6 14.7z' />
      <path
        fill='#EA4335'
        d='M12 4.75c1.68 0 3.19.58 4.38 1.71l3.28-3.28C17.7 1.19 15.1 0 12 0 7.31 0 3.26 2.69 1.76 6.62L5.6 9.9C6.5 7.19 9.02 4.75 12 4.75z'
      />
    </svg>
  );
}
