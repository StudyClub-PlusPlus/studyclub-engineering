'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';

import { OnboardingConsent } from '@/components/OnboardingConsent';
import { TimeZonePicker } from '@/components/TimeZonePicker';
import { ApiError } from '@/lib/api/client';
import { checkNicknameAvailability } from '@/lib/api/nicknames';
import { completeOnboarding } from '@/lib/api/onboarding';
import {
  getSuggestedNickname,
  getUser,
  logout,
  setSuggestedNickname,
  setUser,
} from '@/lib/auth';
import type { Locale } from '@/lib/content';
import {
  clearDraft,
  initialDraft,
  isOnboardingTimeZone,
  nicknameError,
  returnPath,
  saveDraft,
  type OnboardingDraft,
} from '@/lib/onboarding';
import { Button, Input } from '@studyclub/ui';
import { AlertCircle, ArrowRight, Check } from 'lucide-react';

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div className='min-h-[80vh]' />}>
      <OnboardingScreen />
    </Suspense>
  );
}

function OnboardingScreen() {
  const { locale: param } = useParams();
  const locale: Locale = param === 'en' ? 'en' : 'ko';
  const search = useSearchParams();
  const router = useRouter();
  const next = returnPath(search.get('next'), locale);
  const [ready, setReady] = useState(false);
  const [accountId, setAccountId] = useState<number | null>(null);

  useEffect(() => {
    const user = getUser();
    if (!user) {
      router.replace(`/${locale}/login?next=${encodeURIComponent(`/${locale}/onboarding?next=${encodeURIComponent(next)}`)}`);
      return;
    }
    if (user.onboardingCompletedAt) {
      router.replace(next);
      return;
    }
    setAccountId(user.id);
    setReady(true);
  }, [locale, next, router]);

  return (
    <div className='min-h-[80vh] bg-surface-1 px-4 pb-24 pt-8 sm:px-6 sm:pt-12'>
      <div className='mx-auto max-w-[540px]'>
        <header className='mb-7 text-center'>
          <div className='mb-4 inline-flex items-center gap-1.5 rounded-full bg-brand-subtle px-3 py-1.5 text-xs font-medium text-primary-700'>
            <Check size={13} aria-hidden='true' />
            {locale === 'ko' ? 'Google 계정 연결 완료' : 'Google account connected'}
          </div>
          <h1 className='break-keep text-2xl font-bold tracking-tight sm:text-[28px]'>
            {locale === 'ko' ? 'StudyClub++에 오신 것을 환영해요' : 'Welcome to StudyClub++'}
          </h1>
        </header>
        {ready && accountId != null ? (
          <OnboardingForm locale={locale} next={next} accountId={accountId} />
        ) : (
          <div
            aria-busy='true'
            role='status'
            className='rounded-card border border-border bg-bg p-8 text-sm text-fg-muted'
          >
            {locale === 'ko' ? '가입 정보를 확인하고 있어요…' : 'Loading your profile…'}
          </div>
        )}
      </div>
    </div>
  );
}

function OnboardingForm({
  locale,
  next,
  accountId,
}: {
  locale: Locale;
  next: string;
  accountId: number;
}) {
  const ko = locale === 'ko';
  const router = useRouter();
  const [draft, setDraft] = useState<OnboardingDraft>(() =>
    initialDraft(accountId, getSuggestedNickname()),
  );
  const [touched, setTouched] = useState(false);
  const [composing, setComposing] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [problem, setProblem] = useState<'expired' | 'server' | null>(null);
  const [problemDetail, setProblemDetail] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const submitting = useRef(false);

  useEffect(() => {
    saveDraft(accountId, draft);
  }, [accountId, draft]);

  function update<K extends keyof OnboardingDraft>(field: K, value: OnboardingDraft[K]) {
    setDraft((previous) => ({ ...previous, [field]: value }));
  }

  const [nickStatus, setNickStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'error'>('idle');
  const nickAbort = useRef<AbortController | null>(null);
  const trimmedNick = draft.nickname.trim();
  const nickFormatError = composing ? undefined : nicknameError(draft.nickname, locale);

  useEffect(() => {
    nickAbort.current?.abort();
    if (composing || nickFormatError || !trimmedNick) {
      setNickStatus('idle');
      return;
    }
    const controller = new AbortController();
    nickAbort.current = controller;
    setNickStatus('checking');
    const timer = setTimeout(() => {
      checkNicknameAvailability(trimmedNick, controller.signal)
        .then((result) => setNickStatus(result.available ? 'available' : 'taken'))
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === 'AbortError') return;
          if (err instanceof ApiError && err.status === 401) {
            setProblem('expired');
            setProblemDetail(null);
            return;
          }
          setNickStatus('error');
        });
    }, 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmedNick, composing, nickFormatError]);

  const requiredAgreed = ageConfirmed && draft.termsOfServiceAgreed && draft.privacyPolicyAgreed;
  const valid =
    !nicknameError(draft.nickname, locale) &&
    nickStatus !== 'taken' &&
    isOnboardingTimeZone(draft.timeZone) &&
    requiredAgreed;

  const nickLine: { text: string; tone: 'muted' | 'error' | 'ok' } = !trimmedNick
    ? touched
      ? { text: ko ? '닉네임을 입력해 주세요' : 'Enter a nickname.', tone: 'error' }
      : {
          text: ko ? '2~20자 · 한글, 영문, 숫자, 밑줄(_)' : '2–20 characters · Korean, letters, numbers, underscore (_)',
          tone: 'muted',
        }
    : nickFormatError
      ? { text: nickFormatError, tone: 'error' }
      : nickStatus === 'checking'
        ? { text: ko ? '확인 중입니다' : 'Checking…', tone: 'muted' }
        : nickStatus === 'available'
          ? { text: ko ? '사용할 수 있는 닉네임입니다' : 'This nickname is available', tone: 'ok' }
          : nickStatus === 'taken'
            ? { text: ko ? '이미 사용중인 닉네임입니다' : 'This nickname is taken', tone: 'error' }
            : nickStatus === 'error'
              ? {
                  text: ko ? '확인하지 못했습니다. 다시 시도해 주세요' : 'Could not check. Try again',
                  tone: 'muted',
                }
              : {
                  text: ko
                    ? '2~20자 · 한글, 영문, 숫자, 밑줄(_)'
                    : '2–20 characters · Korean, letters, numbers, underscore (_)',
                  tone: 'muted',
                };

  const [awaitingCheck, setAwaitingCheck] = useState(false);
  const disabled = pending || problem === 'expired';
  const sendRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!awaitingCheck || nickStatus === 'checking') return;
    if (nickStatus === 'taken') {
      setAwaitingCheck(false);
      document.getElementById('onboarding-nickname')?.focus();
      return;
    }
    setAwaitingCheck(false);
    sendRef.current();
  }, [awaitingCheck, nickStatus]);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    send();
  }

  sendRef.current = send;

  async function send() {
    if (submitting.current || disabled) return;
    setTouched(true);
    if (!valid || composing) return;
    if (nickStatus === 'checking') {
      setAwaitingCheck(true);
      return;
    }
    setAwaitingCheck(false);
    submitting.current = true;
    setPending(true);
    setProblem(null);
    setProblemDetail(null);
    try {
      const account = await completeOnboarding({
        age14Confirmed: ageConfirmed,
        termsOfServiceAgreed: draft.termsOfServiceAgreed,
        privacyPolicyAgreed: draft.privacyPolicyAgreed,
        marketingAgreed: draft.marketingAgreed,
        nickname: draft.nickname.trim(),
        timeZone: draft.timeZone,
      });
      setUser({
        id: account.id,
        email: account.email,
        nickname: account.nickname,
        picture: account.picture,
        role: account.role,
        timeZone: account.timeZone,
        onboardingCompletedAt: account.onboardingCompletedAt,
      });
      setSuggestedNickname(null);
      clearDraft(accountId);
      router.replace(next);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          setProblem('expired');
          setProblemDetail(null);
        } else if (err.status === 409) {
          setNickStatus('taken');
          document.getElementById('onboarding-nickname')?.focus();
        } else if (err.status === 400) {
          setProblem('server');
          setProblemDetail(err.message);
        } else {
          setProblem('server');
          setProblemDetail(null);
        }
      } else {
        setProblem('server');
        setProblemDetail(null);
      }
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      aria-label={ko ? '회원가입 정보' : 'Complete your profile'}
      className='rounded-card border border-border bg-bg p-5 shadow-xs sm:p-8'
    >
      {problem && (
        <div
          role='alert'
          className='mb-6 rounded-control border border-error-600/20 bg-error-50 p-4 text-sm text-error-700'
        >
          <div className='flex items-start gap-2'>
            <AlertCircle size={17} className='mt-0.5 shrink-0' />
            <p className='leading-relaxed'>
              {problem === 'expired'
                ? ko
                  ? '로그인 시간이 만료됐어요. 다시 로그인하면 입력하던 내용을 이어서 작성할 수 있어요.'
                  : 'Your session has expired. Log in again to continue where you left off.'
                : problemDetail
                  ? problemDetail
                  : ko
                    ? '저장하지 못했어요. 입력한 내용은 유지됐으니 다시 시도해 주세요.'
                    : 'We couldn’t save your details. Your entries are still here. Please try again.'}
            </p>
          </div>
          {problem === 'expired' && (
            <Link
              onClick={() => {
                saveDraft(accountId, draft);
                void logout();
              }}
              href={`/${locale}/login?next=${encodeURIComponent(`/${locale}/onboarding?next=${encodeURIComponent(next)}`)}`}
              className='mt-3 inline-flex font-semibold underline underline-offset-4'
            >
              {ko ? '다시 로그인' : 'Log in again'} <ArrowRight size={15} className='ml-1' />
            </Link>
          )}
        </div>
      )}

      <fieldset disabled={disabled} className='min-w-0 space-y-6'>
        <legend className='sr-only'>{ko ? '기본 정보와 약관 동의' : 'Profile details and agreements'}</legend>
        <div>
          <Input
            id='onboarding-nickname'
            name='nickname'
            label={ko ? '닉네임' : 'Nickname'}
            required
            autoComplete='nickname'
            placeholder={ko ? '함께 사용할 이름을 입력해 주세요' : 'Choose a name for the community'}
            value={draft.nickname}
            onChange={(event) => update('nickname', event.target.value)}
            onBlur={() => setTouched(true)}
            onCompositionStart={() => setComposing(true)}
            onCompositionEnd={() => setComposing(false)}
            aria-invalid={nickLine.tone === 'error'}
            labelHint={`${draft.nickname.trim().length}/20`}
            className={`h-12 ${nickLine.tone === 'error' ? 'border-error-600 focus:border-error-600' : ''}`}
            aria-describedby='nickname-help'
          />
          <p
            id='nickname-help'
            role={nickLine.tone === 'error' ? 'alert' : undefined}
            className={`mt-2 flex items-center gap-1.5 text-xs leading-relaxed ${
              nickLine.tone === 'ok'
                ? 'text-success-700'
                : nickLine.tone === 'error'
                  ? 'text-error-700'
                  : 'text-fg-muted'
            }`}
          >
            {nickLine.tone === 'ok' && <Check size={13} aria-hidden='true' />}
            {nickLine.text}
          </p>
        </div>

        <TimeZonePicker
          value={draft.timeZone}
          onChange={(value) => update('timeZone', value)}
          locale={locale}
          disabled={disabled}
          error={
            touched && !isOnboardingTimeZone(draft.timeZone)
              ? ko
                ? '나의 시간대를 선택해 주세요.'
                : 'Choose your time zone.'
              : undefined
          }
        />

        <section className='border-t border-border pt-6'>
          <h2 className='mb-4 text-base font-semibold'>{ko ? '약관 동의' : 'Terms and agreements'}</h2>
          {!ko && (
            <p
              role='note'
              className='mb-4 rounded-control bg-surface-1 px-3 py-2.5 text-xs leading-relaxed text-fg-muted'
            >
              The documents below are currently available in Korean. English versions have not been provided yet.
            </p>
          )}
          <OnboardingConsent
            locale={locale}
            disabled={disabled}
            values={{
              age: ageConfirmed,
              terms: draft.termsOfServiceAgreed,
              privacy: draft.privacyPolicyAgreed,
              marketing: draft.marketingAgreed,
            }}
            onChange={(key, value) => {
              if (key === 'age') {
                setAgeConfirmed(value);
                return;
              }
              update(
                key === 'terms'
                  ? 'termsOfServiceAgreed'
                  : key === 'privacy'
                    ? 'privacyPolicyAgreed'
                    : 'marketingAgreed',
                value,
              );
            }}
            error={
              touched && !requiredAgreed
                ? ko
                  ? '필수 항목을 확인해 주세요.'
                  : 'Confirm the required items to join.'
                : undefined
            }
          />
        </section>
      </fieldset>

      <div className='mt-7'>
        <Button
          type='submit'
          size='lg'
          className='w-full'
          disabled={!valid || composing || problem === 'expired'}
          loading={pending || awaitingCheck}
          trailingIcon={!pending ? <ArrowRight size={17} aria-hidden='true' /> : undefined}
        >
          {pending
            ? ko
              ? '가입 처리 중…'
              : 'Joining…'
            : problem === 'server'
              ? ko
                ? '다시 시도'
                : 'Try again'
              : ko
                ? '가입 완료'
                : 'Complete sign-up'}
        </Button>
      </div>
    </form>
  );
}
