'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';

import { track } from '@/lib/analytics';
import {
  appleRedirectUri,
  buildAppleAuthUrl,
  buildGoogleAuthUrl,
  isConfigured,
  setLoginMethod,
  setSuggestedNickname,
  setUser,
} from '@/lib/auth';
import type { SessionUser } from '@/lib/auth';
import {
  LOGIN_NOT_CONFIGURED_MESSAGE,
  loginErrorFromCaught,
  loginErrorFromExchange,
  loginErrorFromOAuthPopup,
} from '@/lib/login-errors';

type Provider = 'google' | 'apple';
const PROVIDER_LABEL = { google: 'Google', apple: 'Apple' } as const;

// useSearchParams() 는 next build 프리렌더 시 Suspense 경계가 필요.
export default function LoginPage() {
  return (
    <Suspense fallback={<div className='min-h-[70vh]' />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const params = useParams();
  const router = useRouter();
  const search = useSearchParams();
  const locale = (params?.locale as string) ?? 'ko';
  const next = search.get('next') ?? `/${locale}/my`;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const popupRef = useRef<Window | null>(null);

  const exchange = useCallback(
    async (code: string, provider: Provider, name?: string) => {
      setLoading(true);
      setError(null);
      let httpStatus = 0;
      try {
        // 애플은 authorize 때 쓴 콜백을 교환에도 실어야 한다. 이름은 첫 인가에만 온다
        const extra = provider === 'apple' ? { redirectUri: appleRedirectUri(), name: name || undefined } : {};
        const res = await fetch('/api/auth/social/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, provider, ...extra }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          httpStatus = res.status;
          throw new Error(loginErrorFromExchange(res.status, data, PROVIDER_LABEL[provider]));
        }
        if (data.account) {
          const account = data.account as SessionUser;
          setUser(account);
          setLoginMethod(provider);
          if (typeof data.suggestedNickname === 'string' && data.suggestedNickname.trim()) {
            setSuggestedNickname(data.suggestedNickname.trim());
          } else {
            setSuggestedNickname(null);
          }
          if (!account.onboardingCompletedAt) {
            track({ name: 'Auth Login Completed', props: { is_new_user: true, next_path: next } });
            router.replace(`/${locale}/onboarding?next=${encodeURIComponent(next)}`);
            return;
          }
        }
        track({ name: 'Auth Login Completed', props: { is_new_user: false, next_path: next } });
        // 가입(온보딩)을 마친 회원의 로그인만 센다 — 새 회원은 온보딩 완료가 `User Signed Up` 이다
        track({ name: 'User Logged In', props: { method: provider } });
        router.replace(next);
      } catch (e) {
        track({ name: 'Auth Login Failed', props: { error_message: String(e), http_status: httpStatus } });
        setError(loginErrorFromCaught(e));
      } finally {
        setLoading(false);
      }
    },
    [locale, next, router],
  );

  useEffect(() => {
    function onMessage(ev: MessageEvent) {
      const data = ev.data;
      if (!data || data.source !== 'studyclub-oauth') return;
      popupRef.current?.close();
      const provider: Provider = data.provider === 'apple' ? 'apple' : 'google';
      if (data.error) {
        track({ name: 'Auth OAuth Cancelled', props: { error: String(data.error) } });
        setError(loginErrorFromOAuthPopup(String(data.error), PROVIDER_LABEL[provider]));
        return;
      }
      if (data.code) void exchange(data.code, provider, typeof data.name === 'string' ? data.name : undefined);
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [exchange]);

  function openPopup(url: string, target: string) {
    const w = 480;
    const h = 640;
    const left = window.screenX + (window.outerWidth - w) / 2;
    const top = window.screenY + (window.outerHeight - h) / 2;
    popupRef.current = window.open(url, target, `width=${w},height=${h},left=${left},top=${top}`);
  }

  function startLogin() {
    setError(null);
    if (!isConfigured()) {
      setError(LOGIN_NOT_CONFIGURED_MESSAGE);
      return;
    }
    openPopup(buildGoogleAuthUrl(), 'studyclub-google-login');
    track({ name: 'Auth Google Login Clicked', props: { popup_blocked: !popupRef.current } });
  }

  function startAppleLogin() {
    setError(null);
    openPopup(buildAppleAuthUrl(), 'studyclub-apple-login');
    track({ name: 'Auth Apple Login Clicked', props: { popup_blocked: !popupRef.current } });
  }

  return (
    <div className='mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-6 py-16 text-center'>
      <h1 className='type-headline-lg'>StudyClub 로그인</h1>
      <p className='mt-2 type-body-sm text-fg-muted'>로그인하면 내 스터디룸에서 참여한 스터디를 볼 수 있어요.</p>

      <button
        type='button'
        onClick={startLogin}
        disabled={loading}
        className='mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-bg px-4 py-3 type-label-lg text-fg shadow-sm transition hover:bg-surface-1 disabled:opacity-60'
      >
        <svg width='18' height='18' viewBox='0 0 24 24' aria-hidden>
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
        {loading ? '로그인 처리 중…' : 'Google 계정으로 로그인'}
      </button>

      <button
        type='button'
        onClick={startAppleLogin}
        disabled={loading}
        className='mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-black bg-black px-4 py-3 type-label-lg text-white shadow-sm transition hover:bg-neutral-800 disabled:opacity-60'
      >
        <svg width='18' height='18' viewBox='0 0 814 1000' aria-hidden fill='currentColor'>
          <path d='M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76.5 0-103.7 40.8-165.9 40.8s-105.6-57-155.5-127C46.7 790.7 0 663 0 541.8c0-194.4 126.4-297.5 250.8-297.5 66.1 0 121.2 43.4 162.7 43.4 39.5 0 101.1-46 176.3-46 28.5 0 130.9 2.6 198.3 99.2zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z' />
        </svg>
        Apple 계정으로 로그인
      </button>

      {error && (
        <p role='alert' className='mt-4 type-body-sm text-danger-fg'>
          {error}
        </p>
      )}
    </div>
  );
}
