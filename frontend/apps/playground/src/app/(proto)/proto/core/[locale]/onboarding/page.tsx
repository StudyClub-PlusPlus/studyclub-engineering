'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';

import { OnboardingConsent } from '@core/components/OnboardingConsent';
import { TimeZonePicker } from '@core/components/TimeZonePicker';
import { getUser, setUser } from '@core/lib/auth';
import type { Locale } from '@core/lib/content';
import {
  clearDrafts,
  initialDraft,
  isValidTimeZone,
  nicknameError,
  ONBOARDING_SCENARIOS,
  returnPath,
  saveDraft,
  SUCCESS_KEY,
  type OnboardingRequest,
  type OnboardingScenario,
} from '@core/lib/onboarding';
import { Button, Checkbox, Input } from '@studyclub/ui';
import { AlertCircle, ArrowRight, Check, ShieldCheck } from 'lucide-react';


import { SPEC } from './spec';
import { ScreenSpecRegistrar } from '@/proto/annotate';

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
  const forcedPreview = search.has('scenario');
  const candidate = search.get('scenario');
  const scenario = ONBOARDING_SCENARIOS.find((value) => value === candidate) ?? 'default';
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (getUser()?.onboardingCompletedAt && !forcedPreview) {
      router.replace(next);
    } else {
      setReady(true);
    }
  }, [forcedPreview, next, router]);

  return (
    <div className='min-h-[80vh] bg-surface-1 px-4 pb-24 pt-8 sm:px-6 sm:pt-12'>
      <ScreenSpecRegistrar spec={SPEC} />
      <div className='mx-auto max-w-[540px]'>
        <header className='mb-7 text-center' data-anno='1'>
          <div className='mb-4 inline-flex items-center gap-1.5 rounded-full bg-brand-subtle px-3 py-1.5 text-xs font-medium text-primary-700'>
            <Check size={13} aria-hidden='true' />
            {locale === 'ko' ? 'Google 계정 연결 완료' : 'Google account connected'}
          </div>
          <h1 className='break-keep text-2xl font-bold tracking-tight sm:text-[28px]'>
            {locale === 'ko' ? 'StudyClub++에 오신 것을 환영해요' : 'Welcome to StudyClub++'}
          </h1>
          <p className='mt-2 break-keep text-sm leading-relaxed text-fg-muted'>
            {locale === 'ko'
              ? '기본 정보를 설정하고 약관에 동의하면 가입이 완료돼요.'
              : 'Set up your profile and review the terms to finish joining.'}
          </p>
        </header>
        {ready ? (
          <OnboardingForm
            key={`${scenario}:${search.get('reset') ?? ''}:${locale}`}
            locale={locale}
            scenario={scenario}
            next={next}
          />
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

function OnboardingForm({ locale, scenario, next }: { locale: Locale; scenario: OnboardingScenario; next: string }) {
  const ko = locale === 'ko';
  const router = useRouter();
  const [draft, setDraft] = useState<OnboardingRequest>(() => initialDraft(scenario));
  const [touched, setTouched] = useState(['empty', 'nickname'].includes(scenario));
  const [composing, setComposing] = useState(false);
  const [duplicate, setDuplicate] = useState(
    scenario === 'duplicate' && initialDraft(scenario).nickname.toLowerCase() === 'studyclub',
  );
  const [problem, setProblem] = useState<'server' | 'expired' | null>(
    scenario === 'server' ? 'server' : scenario === 'expired' ? 'expired' : null,
  );
  const [pending, setPending] = useState(scenario === 'loading');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submitting = useRef(false);

  useEffect(() => {
    saveDraft(scenario, draft);
  }, [draft, scenario]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function update<K extends keyof OnboardingRequest>(field: K, value: OnboardingRequest[K]) {
    setDraft((previous) => ({ ...previous, [field]: value }));
    if (field === 'nickname') setDuplicate(false);
  }

  const nameProblem = duplicate
    ? ko
      ? '이미 사용 중인 닉네임이에요. 다른 이름을 입력해 주세요.'
      : 'This nickname is already taken. Choose another one.'
    : touched && !composing
      ? nicknameError(draft.nickname, locale)
      : undefined;
  const valid =
    !nicknameError(draft.nickname, locale) &&
    isValidTimeZone(draft.timeZone) &&
    draft.termsOfServiceAgreed &&
    draft.privacyPolicyAgreed;
  const disabled = pending || problem === 'expired';

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || disabled) return;
    setTouched(true);
    if (!valid || composing) return;
    submitting.current = true;
    setPending(true);
    setProblem(null);
    timer.current = setTimeout(() => {
      submitting.current = false;
      setPending(false);
      if (draft.nickname.trim().toLowerCase() === 'studyclub') {
        setDuplicate(true);
        document.getElementById('onboarding-nickname')?.focus();
        return;
      }
      // Playground completion only. Never send a real consent or registration request.
      setUser({
        id: -1001,
        email: 'crew@example.com',
        name: draft.nickname.trim(),
        picture: null,
        role: 'MEMBER',
        timeZone: draft.timeZone,
        onboardingCompletedAt: new Date().toISOString(),
      });
      clearDrafts();
      try {
        sessionStorage.setItem(SUCCESS_KEY, JSON.stringify({ nickname: draft.nickname.trim(), locale }));
      } catch {
        /* Optional toast. */
      }
      router.replace(next);
    }, 900);
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
          data-anno='6'
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
                : ko
                  ? '저장하지 못했어요. 입력한 내용은 유지됐으니 다시 시도해 주세요.'
                  : 'We couldn’t save your details. Your entries are still here. Please try again.'}
            </p>
          </div>
          {problem === 'expired' && (
            <Link
              onClick={() => saveDraft('default', draft)}
              href={`/proto/core/${locale}/login?scenario=returning&next=${encodeURIComponent(next)}`}
              className='mt-3 inline-flex font-semibold underline underline-offset-4'
            >
              {ko ? '다시 로그인' : 'Log in again'} <ArrowRight size={15} className='ml-1' />
            </Link>
          )}
        </div>
      )}

      <fieldset disabled={disabled} className='min-w-0 space-y-6'>
        <legend className='sr-only'>{ko ? '기본 정보와 약관 동의' : 'Profile details and agreements'}</legend>
        <div data-anno='2'>
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
            error={nameProblem}
            labelHint={`${draft.nickname.trim().length}/20`}
            className='h-12'
            aria-describedby='nickname-help'
          />
          <p id='nickname-help' className='mt-2 text-xs leading-relaxed text-fg-muted'>
            {ko
              ? '2~20자 · 글자, 숫자, 밑줄(_)을 사용할 수 있어요.'
              : '2–20 characters · Letters, numbers and underscores (_) are welcome.'}
          </p>
        </div>

        <TimeZonePicker
          value={draft.timeZone}
          onChange={(value) => update('timeZone', value)}
          locale={locale}
          disabled={disabled}
          error={
            touched && !isValidTimeZone(draft.timeZone)
              ? ko
                ? '일정에 사용할 시간대를 선택해 주세요.'
                : 'Choose a time zone for your schedule.'
              : undefined
          }
        />

        <section className='border-t border-border pt-6' data-anno='4'>
          <h2 className='mb-4 text-base font-semibold'>{ko ? '약관 동의' : 'Terms and agreements'}</h2>
          {!ko && (
            <p
              role='note'
              className='mb-4 rounded-control bg-surface-1 px-3 py-2.5 text-xs leading-relaxed text-fg-muted'
            >
              The documents below are currently available in Korean. English versions have not been provided yet.
            </p>
          )}
          <div className='space-y-5'>
            <OnboardingConsent
              kind='terms'
              locale={locale}
              checked={draft.termsOfServiceAgreed}
              onChange={(value) => update('termsOfServiceAgreed', value)}
              disabled={disabled}
              error={
                scenario === 'empty' && !draft.termsOfServiceAgreed
                  ? ko
                    ? '가입하려면 이용약관에 동의해 주세요.'
                    : 'Agree to the Terms of Service to join.'
                  : undefined
              }
            />
            <OnboardingConsent
              kind='privacy'
              locale={locale}
              checked={draft.privacyPolicyAgreed}
              onChange={(value) => update('privacyPolicyAgreed', value)}
              disabled={disabled}
              error={
                scenario === 'empty' && !draft.privacyPolicyAgreed
                  ? ko
                    ? '가입하려면 개인정보 수집·이용에 동의해 주세요.'
                    : 'Agree to the collection and use of personal information to join.'
                  : undefined
              }
            />
            <div className='rounded-control bg-surface-1 py-3.5' data-anno='4-3'>
              <div className='flex items-start gap-2'>
                <span className={`mt-0.5 shrink-0 text-xs font-medium text-fg-muted ${ko ? 'w-8' : 'w-16'}`}>
                  {ko ? '[선택]' : '[Optional]'}
                </span>
                <Checkbox
                  id='marketing-agreed'
                  checked={draft.marketingAgreed}
                  onChange={(event) => update('marketingAgreed', event.target.checked)}
                  label={ko ? '마케팅 정보 수신에 동의합니다.' : 'I agree to receive marketing messages.'}
                  className='items-start [&_input]:mt-0.5 [&_span]:break-keep [&_span]:leading-snug'
                />
              </div>
              <p className='mt-2 text-xs leading-relaxed text-fg-muted'>
                {ko
                  ? '스터디 소식과 행사 안내를 보내드려요. 동의하지 않아도 가입할 수 있어요.'
                  : 'Get study news and event updates. You can join without opting in.'}
              </p>
            </div>
          </div>
        </section>
      </fieldset>

      <div className='mt-7' data-anno='5'>
        <Button
          type='submit'
          size='lg'
          className='w-full'
          disabled={!valid || composing || problem === 'expired'}
          loading={pending}
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
        <p className='mt-3 flex items-center justify-center gap-1.5 text-center text-xs leading-relaxed text-fg-muted'>
          <ShieldCheck size={13} className='shrink-0' aria-hidden='true' />
          {ko
            ? '닉네임·시간대와 필수 동의를 확인해 주세요.'
            : 'A valid nickname, time zone and required agreements are needed.'}
        </p>
      </div>
    </form>
  );
}
