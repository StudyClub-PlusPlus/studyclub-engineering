'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useEffect, useState } from 'react';

import type { Locale } from '@studyclub/types';
import { Button, Input, Segmented } from '@studyclub/ui';

import { setLoginMethod, setSuggestedNickname, setUser } from '@/features/auth/auth';
import { browserLoginResponseSchema } from '@/features/auth/response-schema';
import { returnPath } from '@/features/onboarding/model';

// 메뉴에 없는 테스트 로그인 (specs/stage-email-login). 백엔드 스위치가 꺼진 환경에서는 API 가 404 다.
type Step = 'login' | 'signup' | 'verify';
const RESEND_GAP = 60;

async function call(step: Step, body: object): Promise<{ ok: boolean; status: number; data: unknown }> {
  try {
    const res = await fetch(`/api/auth/email/${step}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { ok: res.ok, status: res.status, data: await res.json().catch(() => null) };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

function messageOf(r: { status: number; data: unknown }): { text: string; code?: string } {
  if (r.status === 0) return { text: '보내지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요.', code: 'NETWORK' };
  if (r.status === 404) return { text: '이 환경에서는 쓸 수 없어요.' };
  const d = (r.data ?? {}) as { errorCode?: string; errorMessage?: string };
  if (d.errorCode === 'ACCOUNT_LINK_REQUIRED') return { text: '이 메일은 소셜 로그인으로 가입돼 있어요. 그 방법으로 로그인해 주세요.', code: d.errorCode };
  if (r.status === 401) return { text: '이메일 또는 비밀번호가 맞지 않아요.' };
  return { text: d.errorMessage || '잠시 뒤 다시 해 주세요.', code: d.errorCode };
}

export default function TestLoginPage() {
  return (
    <Suspense fallback={<div className='min-h-[70vh]' />}>
      <TestLoginForm />
    </Suspense>
  );
}

function TestLoginForm() {
  const params = useParams();
  const router = useRouter();
  const search = useSearchParams();
  const locale = (params?.locale as string) ?? 'ko';
  const next = returnPath(search.get('next'), locale as Locale);
  const invited = search.get('email') ?? '';

  const [step, setStep] = useState<Step>(invited ? 'signup' : 'login');
  const [email, setEmail] = useState(invited);
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; code?: string } | null>(null);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const go = (s: Step) => {
    setStep(s);
    setError(null);
  };

  async function login() {
    const r = await call('login', { email, password });
    if (!r.ok) return setError(messageOf(r));
    const { account } = browserLoginResponseSchema.parse(r.data);
    setUser(account);
    setLoginMethod('email');
    setSuggestedNickname(null);
    router.replace(account.onboardingCompletedAt ? next : `/${locale}/onboarding?next=${encodeURIComponent(next)}`);
  }

  async function sendCode() {
    const r = await call('signup', { email });
    if (!r.ok) return setError(messageOf(r));
    setCode('');
    setWait(RESEND_GAP);
    go('verify');
  }

  async function verify() {
    const r = await call('verify', { email, code, password });
    if (!r.ok) return setError(messageOf(r));
    await login();
  }

  function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    fn().finally(() => setBusy(false));
  }

  function submit(e: FormEvent, fn: () => Promise<void>) {
    e.preventDefault();
    run(fn);
  }

  const locked = error?.code === 'EMAIL_CODE_EXPIRED';
  const title = step === 'login' ? '테스트 계정으로 로그인' : step === 'signup' ? '메일로 코드를 보내 드려요' : '메일로 온 6자리를 넣어 주세요';

  return (
    <div className='mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-16'>
      <h1 className='type-headline-lg'>{title}</h1>

      {step !== 'verify' && (
        <Segmented
          className='mt-6'
          value={step}
          onChange={(v: string) => go(v as Step)}
          options={[
            { value: 'login', label: '로그인' },
            { value: 'signup', label: '가입' },
          ]}
        />
      )}

      {step === 'login' && (
        <form className='mt-6 flex flex-col gap-4' onSubmit={(e) => submit(e, login)}>
          <Input label='메일' type='email' autoComplete='username' required value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input label='비밀번호' type='password' autoComplete='current-password' required value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <p role='alert' className='type-body-sm text-danger-fg'>{error.text}</p>}
          <Button type='submit' loading={busy}>로그인</Button>
          <p className='type-body-sm text-fg-muted'>테스트 계정 전용이에요. 평소에는 Google · Apple 로 로그인해 주세요.</p>
        </form>
      )}

      {step === 'signup' && (
        <form className='mt-6 flex flex-col gap-4' onSubmit={(e) => submit(e, sendCode)}>
          <Input label='메일' type='email' autoComplete='email' required value={email} onChange={(e) => setEmail(e.target.value)} />
          {error && <p role='alert' className='type-body-sm text-danger-fg'>{error.text}</p>}
          <Button type='submit' loading={busy}>{error?.code === 'NETWORK' ? '다시 시도' : '코드 받기'}</Button>
          <p className='type-body-sm text-fg-muted'>초대 링크로 오면 메일이 미리 채워져 있어요.</p>
        </form>
      )}

      {step === 'verify' && (
        <form className='mt-6 flex flex-col gap-4' onSubmit={(e) => submit(e, verify)}>
          <p className='type-body-sm text-fg-muted'>
            {email} 로 보냈어요. 10분 안에 넣어 주세요.{' '}
            <Button type='button' variant='tertiary' size='sm' onClick={() => go('signup')}>메일 바꾸기</Button>
          </p>
          <Input
            label='인증코드'
            inputMode='numeric'
            autoComplete='one-time-code'
            pattern='\d{6}'
            maxLength={6}
            required
            value={code}
            error={error?.code === 'EMAIL_CODE_WRONG' || locked ? error.text : undefined}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          />
          <Input
            label='비밀번호 (8자 이상)'
            type='password'
            autoComplete='new-password'
            minLength={8}
            maxLength={72}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && error.code !== 'EMAIL_CODE_WRONG' && !locked && <p role='alert' className='type-body-sm text-danger-fg'>{error.text}</p>}
          <Button type='submit' loading={busy} disabled={locked}>가입하고 로그인</Button>
          <Button type='button' variant='tertiary' disabled={busy || wait > 0} onClick={() => run(sendCode)}>
            {wait > 0 ? `코드 다시 받기 (${wait}초 뒤)` : '코드 다시 받기'}
          </Button>
        </form>
      )}
    </div>
  );
}
