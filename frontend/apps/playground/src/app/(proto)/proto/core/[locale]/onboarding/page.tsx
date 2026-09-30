'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';

import { OnboardingConsent } from '@core/components/OnboardingConsent';
import { TimeZonePicker } from '@core/components/TimeZonePicker';
import { getUser, setUser } from '@core/lib/auth';
import type { Locale } from '@core/lib/content';
import { checkNicknameAvailability } from '@core/lib/nickname-availability';
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
import { Button, Input } from '@studyclub/ui';
import { AlertCircle, ArrowRight, Check } from 'lucide-react';


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
  // 중복은 2-1 상태 줄이 말한다. 시나리오로 미리 켜 두던 플래그는 더 필요하지 않다.
  const [, setDuplicate] = useState(false);
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

  /**
   * 닉네임 중복 검사.
   *
   * **형식이 맞는 값만 묻는다.** 두 글자가 안 되는 값을 서버에 던지면 「이미 사용 중」과 「너무 짧다」가
   * 뒤섞여 무엇을 고쳐야 할지 알 수 없다. 마지막 입력에서 400ms 쉬면 그때 한 번 보낸다.
   */
  const [nickStatus, setNickStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'error'>('idle');
  const nickAbort = useRef<AbortController | null>(null);
  const trimmedNick = draft.nickname.trim();
  // 조합 중에는 검증하지 않는다 — 「ㄱ」 상태에서 「2자 이상」이 뜨면 치는 사람이 놀란다.
  const nickFormatError = composing ? undefined : nicknameError(draft.nickname, locale);

  useEffect(() => {
    nickAbort.current?.abort();
    if (composing || nickFormatError) {
      setNickStatus('idle');
      return;
    }
    const controller = new AbortController();
    nickAbort.current = controller;
    setNickStatus('checking');
    const timer = setTimeout(() => {
      checkNicknameAvailability(trimmedNick, controller.signal)
        .then((result) => setNickStatus(result.available ? 'available' : 'taken'))
        // 취소된 요청은 최신 상태를 덮어쓰지 않는다 — 늦게 온 과거 응답이 답을 바꾸면 안 된다.
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === 'AbortError') return;
          setNickStatus('error');
        });
    }, 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmedNick, composing, nickFormatError]);

  // TODO(api): 만 14세 확인을 저장할 필드가 아직 없다. 지금은 화면 상태로만 들고 있다.
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const requiredAgreed = ageConfirmed && draft.termsOfServiceAgreed && draft.privacyPolicyAgreed;
  // 「확인 중」에도 누를 수 있어야 한다 — 400ms 를 기다렸다 누르게 하면 다 채운 사람이 멈춰 선다.
  // 중복으로 판명된 값만 막는다.
  const valid =
    !nicknameError(draft.nickname, locale) && nickStatus !== 'taken' && isValidTimeZone(draft.timeZone) && requiredAgreed;
  /**
   * 닉네임 칸 아래 한 줄. **자리를 하나만 쓴다** — 상태마다 줄을 더하면 아래가 밀린다.
   * 형식 오류는 친 순간 보여주고, 중복 여부는 형식이 맞은 뒤에만 말한다.
   */
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

  /** 검사가 끝나기 전에 제출을 눌렀는가. 끝나는 대로 이어서 보낸다. */
  const [awaitingCheck, setAwaitingCheck] = useState(false);
  const disabled = pending || problem === 'expired';

  // 기다리던 검사가 끝났다. 쓸 수 있으면 이어서 보내고, 이미 쓰이는 이름이면 그 칸으로 돌려보낸다.
  // `send` 는 매 렌더 새로 만들어지므로 의존성에 두지 않고 ref 로 최신 값만 참조한다.
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

  function send() {
    if (submitting.current || disabled) return;
    setTouched(true);
    if (!valid || composing) return;
    // 검사가 아직 돌고 있으면 결과를 기다렸다 이어서 보낸다.
    if (nickStatus === 'checking') {
      setAwaitingCheck(true);
      return;
    }
    setAwaitingCheck(false);
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
            aria-invalid={nickLine.tone === 'error'}
            labelHint={`${draft.nickname.trim().length}/20`}
            className={`h-12 ${nickLine.tone === 'error' ? 'border-error-600 focus:border-error-600' : ''}`}
            aria-describedby='nickname-help'
          />
          {/* 도움말 자리를 **교체**한다. 줄을 새로 더하면 상태가 바뀔 때마다 아래가 밀린다. */}
          <p
            id='nickname-help'
            data-anno='2-1'
            role={nickLine.tone === 'error' ? 'alert' : undefined}
            className={`mt-2 flex items-center gap-1.5 text-xs leading-relaxed ${
              nickLine.tone === 'ok' ? 'text-success-700' : nickLine.tone === 'error' ? 'text-error-700' : 'text-fg-muted'
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
            touched && !isValidTimeZone(draft.timeZone)
              ? ko
                ? '일정에 사용할 시간대를 선택해 주세요.'
                : 'Choose a time zone for your schedule.'
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
                key === 'terms' ? 'termsOfServiceAgreed' : key === 'privacy' ? 'privacyPolicyAgreed' : 'marketingAgreed',
                value,
              );
            }}
            error={
              (touched || scenario === 'empty') && !requiredAgreed
                ? ko
                  ? '필수 항목을 확인해 주세요.'
                  : 'Confirm the required items to join.'
                : undefined
            }
          />
        </section>
      </fieldset>

      <div className='mt-7' data-anno='5'>
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
