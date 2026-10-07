'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Checkbox, Input, toast } from '@studyclub/ui';
import { Check, Pencil } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { TimeZonePicker, zoneName } from '@/components/TimeZonePicker';
import { isSameNickname } from '@/features/profile/nickname';
import {
  useChangeMarketingConsent,
  useFetchLatestAccount,
  useMarketingConsent,
  useUpdateProfile,
  type MarketingConsent,
} from '@/features/profile/queries';
import { checkNicknameAvailability } from '@/lib/api/nicknames';
import type { OnboardingAccount } from '@/lib/api/onboarding';
import { logout, setUser, type SessionUser } from '@/lib/auth';
import type { Locale } from '@/lib/content';
import { ApiError } from '@/lib/http';
import { nicknameError, parseOnboardingFieldErrors } from '@/lib/onboarding';
import { isPreview } from '@/lib/preview';

/**
 * 마이페이지 내 정보 카드.
 *
 * 보기와 편집이 같은 카드 안에서 바뀐다 — 고칠 것이 닉네임·시간대 둘뿐이라 지면을 옮길 일이 아니다.
 * 이메일은 로그인 계정 그 자체라 보여주기만 한다.
 *
 * 닉네임·시간대의 진본은 서버다. 저장에 성공하면 응답으로 세션 user 를 갱신한다.
 * 마케팅 수신 동의는 프로필 저장과 따로 간다 — 누르면 바로 바뀐다.
 */

type NickStatus = 'idle' | 'checking' | 'available' | 'taken' | 'error';
type Tone = 'muted' | 'error' | 'ok';
type ProfileFormValues = { nickname: string; timeZone: string };

const NICKNAME_HINT = '2~20자 · 한글, 영문, 숫자, 밑줄(_)';
const NICKNAME_TAKEN = '이미 사용중인 닉네임입니다';

/** 형식 규칙은 온보딩과 같은 함수 하나를 쓴다 — 두 화면이 같은 닉네임을 두고 다른 말을 하면 안 된다. */
function profileSchema(locale: Locale) {
  return z.object({
    nickname: z.string().superRefine((value, ctx) => {
      const message = nicknameError(value, locale);
      if (message) ctx.addIssue({ code: z.ZodIssueCode.custom, message });
    }),
    timeZone: z.string().min(1, '시간대를 다시 선택해 주세요'),
  });
}

/** 체크 표시만 바뀌면 처리됐는지 알기 어렵다 — 어떤 값으로 언제 처리됐는지 알림으로 띄운다. */
function consentMessage(consent: MarketingConsent): string {
  let message = '마케팅 정보 수신 동의를 철회했습니다';
  if (consent.agreed) message = '마케팅 정보 수신에 동의했습니다';
  if (!consent.agreedAt) return message;
  // "2026. 10. 1." 의 공백을 뺀다 — 알림 폭이 좁아 날짜 한가운데서 줄이 바뀐다
  const date = new Date(consent.agreedAt).toLocaleDateString('ko-KR').replaceAll(' ', '');
  return `${message} (${date})`;
}

/** 서버 응답에서 세션에 담는 값만 고른다 — 조회와 저장 응답이 같은 모양이라 둘 다 이걸 쓴다. */
function toSessionUser(account: OnboardingAccount): SessionUser {
  return {
    id: account.id,
    email: account.email,
    nickname: account.nickname,
    picture: account.picture,
    role: account.role,
    timeZone: account.timeZone,
    onboardingCompletedAt: account.onboardingCompletedAt,
  };
}

function toneClass(tone: Tone): string {
  if (tone === 'ok') return 'text-success-700';
  if (tone === 'error') return 'text-error-700';
  return 'text-fg-muted';
}

export function ProfileCard({
  user,
  locale,
  onUserChange,
}: {
  user: SessionUser;
  locale: Locale;
  onUserChange: (user: SessionUser) => void;
}) {
  const router = useRouter();
  // 미리보기 세션은 서버가 모르는 계정이다. 서버를 부르면 401 이 나고 세션이 지워진다.
  const preview = isPreview(user);

  const [editing, setEditing] = useState(false);
  const [opening, setOpening] = useState(false);
  const [composing, setComposing] = useState(false);
  const [nickStatus, setNickStatus] = useState<NickStatus>('idle');
  const [problem, setProblem] = useState<'expired' | 'load' | 'server' | null>(null);

  const schema = useMemo(() => profileSchema(locale), [locale]);
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
    setError,
  } = useForm<ProfileFormValues>({
    defaultValues: { nickname: user.nickname ?? '', timeZone: user.timeZone ?? '' },
    resolver: zodResolver(schema),
    mode: 'onChange',
  });

  const updateProfile = useUpdateProfile();
  const fetchLatestAccount = useFetchLatestAccount(user.id);
  const consent = useMarketingConsent(user.id, !preview);
  const changeConsent = useChangeMarketingConsent(user.id);

  const draftName = watch('nickname');
  const draftZone = watch('timeZone');
  const trimmedName = draftName.trim();
  const nicknameMessage = errors.nickname?.message;
  // 지금 쓰는 자기 닉네임이면 서버에 묻지 않는다 — 확인 API 는 자기 닉네임도 "사용 중" 이라 답한다
  const unchangedName = isSameNickname(draftName, user.nickname);

  useEffect(() => {
    if (!editing || preview || composing || nicknameMessage || unchangedName) {
      setNickStatus('idle');
      return;
    }
    const controller = new AbortController();
    setNickStatus('checking');
    const timer = setTimeout(() => {
      checkNicknameAvailability(trimmedName, controller.signal)
        .then((result) => {
          if (result.available) setNickStatus('available');
          else setNickStatus('taken');
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === 'AbortError') return;
          setNickStatus('error');
        });
    }, 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [editing, preview, composing, nicknameMessage, unchangedName, trimmedName]);

  function nicknameLine(): { text: string; tone: Tone } {
    // 한글 조합 중에는 글자가 덜 만들어진 상태라 형식 오류를 띄우지 않는다
    if (nicknameMessage && !composing) return { text: nicknameMessage, tone: 'error' };
    if (nickStatus === 'checking') return { text: '확인 중입니다', tone: 'muted' };
    if (nickStatus === 'available') return { text: '사용할 수 있는 닉네임입니다', tone: 'ok' };
    if (nickStatus === 'taken') return { text: NICKNAME_TAKEN, tone: 'error' };
    if (nickStatus === 'error') return { text: '확인하지 못했습니다. 다시 시도해 주세요', tone: 'muted' };
    return { text: NICKNAME_HINT, tone: 'muted' };
  }

  const line = nicknameLine();
  const blocked =
    composing ||
    Boolean(nicknameMessage) ||
    nickStatus === 'taken' ||
    nickStatus === 'checking' ||
    updateProfile.isPending;

  async function openEditor() {
    setProblem(null);
    let current = user;
    if (!preview) {
      // 진본은 서버다 — 다른 기기에서 먼저 바꿨으면 이 브라우저 세션에는 이전 값이 남아 있다
      setOpening(true);
      try {
        current = toSessionUser(await fetchLatestAccount());
        setUser(current);
        onUserChange(current);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          setProblem('expired');
          return;
        }
        // 최신 값을 못 받으면 열지 않는다 — 세션 값으로 열면 다른 기기에서 바꾼 뒤의 옛 닉네임을 보여주게 된다
        setProblem('load');
        return;
      } finally {
        setOpening(false);
      }
    }
    // 열 때마다 현재 값에서 다시 시작한다. 취소하고 다시 열면 이전 편집이 남아 있으면 안 된다.
    reset({ nickname: current.nickname ?? '', timeZone: current.timeZone ?? '' });
    setEditing(true);
  }

  function applySaved(next: SessionUser) {
    setUser(next);
    onUserChange(next);
    setEditing(false);
  }

  /** 실패해도 입력은 지우지 않는다 — 편집 상태로 남겨 고쳐서 다시 저장하게 한다. */
  function handleSaveError(err: unknown) {
    if (!(err instanceof ApiError)) {
      setProblem('server');
      return;
    }
    if (err.status === 401) {
      setProblem('expired');
      return;
    }
    // 이 API 의 403 은 온보딩 미완료 하나뿐이다
    if (err.status === 403) {
      router.replace(`/${locale}/onboarding?next=${encodeURIComponent(`/${locale}/my`)}`);
      return;
    }
    if (err.status === 409) {
      setError('nickname', { type: 'server', message: NICKNAME_TAKEN });
      return;
    }
    if (err.status === 400) {
      const parsed = parseOnboardingFieldErrors(err.message, locale);
      if (parsed.nickname) setError('nickname', { type: 'server', message: parsed.nickname });
      if (parsed.timeZone) setError('timeZone', { type: 'server', message: parsed.timeZone });
      if (!parsed.nickname && !parsed.timeZone) setProblem('server');
      return;
    }
    setProblem('server');
  }

  const save = handleSubmit(async (values) => {
    if (blocked) return;
    const payload = { nickname: values.nickname.trim(), timeZone: values.timeZone };
    setProblem(null);
    if (preview) {
      applySaved({ ...user, ...payload });
      return;
    }
    try {
      applySaved(toSessionUser(await updateProfile.mutateAsync(payload)));
    } catch (err) {
      handleSaveError(err);
    }
  });

  function closeEditor() {
    setProblem(null);
    setEditing(false);
  }

  const zoneLabel = zoneName(user.timeZone ?? '', locale) ?? user.timeZone ?? '';

  // 서버가 알려준 사유를 그대로 보여준다. 응답을 못 받은 실패(통신 끊김)만 이 문구다
  let consentChangeError = '변경하지 못했습니다. 다시 시도해 주세요';
  if (changeConsent.error instanceof ApiError) consentChangeError = changeConsent.error.message;

  // 편집 중에는 넘치게 둔다 — 시간대 메뉴가 카드 밖으로 열린다
  let cardClass = 'card mt-5 overflow-hidden';
  if (editing) cardClass = 'card mt-5';

  return (
    <section className={cardClass}>
      <div className='flex items-start justify-between gap-4 px-6 pt-5'>
        <div className='min-w-0 flex-1'>
          {editing && (
            <div className='max-w-sm'>
              <Input
                {...register('nickname')}
                label='닉네임'
                autoComplete='nickname'
                onCompositionStart={() => setComposing(true)}
                onCompositionEnd={() => setComposing(false)}
                labelHint={`${trimmedName.length}/20`}
                aria-invalid={line.tone === 'error'}
                aria-describedby='profile-nickname-help'
                autoFocus
              />
              <p
                id='profile-nickname-help'
                className={`mt-2 flex items-center gap-1.5 text-xs ${toneClass(line.tone)}`}
              >
                {line.tone === 'ok' && <Check size={13} aria-hidden='true' />}
                {line.text}
              </p>
            </div>
          )}
          {!editing && (
            <>
              <p className='truncate text-xl font-extrabold tracking-tight text-fg'>{user.nickname ?? user.email}</p>
              <p className='mt-0.5 truncate text-sm text-fg-muted'>{user.email}</p>
            </>
          )}
        </div>

        {!editing && (
          <button
            type='button'
            onClick={openEditor}
            disabled={opening}
            title='내 정보 수정'
            aria-label='내 정보 수정'
            className='grid h-9 w-9 shrink-0 place-items-center rounded-control border border-border-strong text-fg-secondary transition-colors hover:bg-surface-2 hover:text-fg'
          >
            <Pencil size={15} />
          </button>
        )}
      </div>

      {/* 값은 이름과 값 두 줄로만 세운다 — 칸을 나눠 담으면 몇 안 되는 값이 표처럼 보인다 */}
      <dl className='mt-5 grid grid-cols-[4.5rem_1fr] items-baseline gap-x-6 gap-y-3 px-6 pb-5 text-sm'>
        <dt className='text-fg-muted'>시간대</dt>
        <dd className='min-w-0'>
          {editing && (
            <div className='max-w-xs'>
              <TimeZonePicker
                value={draftZone}
                onChange={(zone) => setValue('timeZone', zone, { shouldValidate: true })}
                locale={locale}
                error={errors.timeZone?.message}
                hideLabel
              />
            </div>
          )}
          {!editing && <span className='font-semibold text-fg'>{zoneLabel}</span>}
        </dd>

        {/* 연결·해제는 디스코드 연결 API 가 나온 뒤에 붙인다 */}
        <dt className='text-fg-muted'>디스코드</dt>
        <dd className='font-semibold text-fg-muted'>연결 안 됨</dd>

        <dt className='text-fg-muted'>수신 동의</dt>
        <dd className='min-w-0'>
          <Checkbox
            label='마케팅 정보 수신 동의'
            checked={consent.data?.agreed ?? false}
            disabled={!consent.data || changeConsent.isPending}
            onChange={(event) =>
              changeConsent.mutate(event.target.checked, {
                onSuccess: (saved) => toast.success(consentMessage(saved)),
              })
            }
          />
          <p className='mt-1 text-xs text-fg-muted'>스터디 소식과 행사 안내를 이메일로 보내드려요</p>
          {consent.isError && (
            <p role='alert' className='mt-1 text-xs text-error-700'>
              수신 동의 상태를 불러오지 못했습니다. 새로고침해 주세요
            </p>
          )}
          {changeConsent.isError && (
            <p role='alert' className='mt-1 text-xs text-error-700'>
              {consentChangeError}
            </p>
          )}
        </dd>
      </dl>

      {problem === 'expired' && (
        <p role='alert' className='border-t border-border px-6 py-3 text-xs text-error-700'>
          로그인 시간이 만료됐어요.{' '}
          <Link
            href={`/${locale}/login?next=${encodeURIComponent(`/${locale}/my`)}`}
            onClick={() => void logout()}
            className='font-semibold underline underline-offset-4'
          >
            다시 로그인
          </Link>
        </p>
      )}
      {problem === 'load' && (
        <p role='alert' className='border-t border-border px-6 py-3 text-xs text-error-700'>
          내 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요
        </p>
      )}
      {problem === 'server' && (
        <p role='alert' className='border-t border-border px-6 py-3 text-xs text-error-700'>
          저장하지 못했습니다. 잠시 후 다시 시도해 주세요
        </p>
      )}

      {/* 닫는 줄 — 무거운 동작은 왼쪽 끝, 주액션은 오른쪽 끝. 로그아웃은 탈퇴 옆에서 잘못 눌려 헤더 메뉴에만 둔다 */}
      <div className='flex items-center justify-between gap-3 border-t border-border px-6 py-3'>
        <Link
          href={`/${locale}/my/leave`}
          className='text-xs text-fg-muted underline-offset-4 hover:text-fg-secondary hover:underline'
        >
          회원 탈퇴
        </Link>
        {editing && (
          <div className='flex items-center gap-2'>
            <Button size='sm' variant='ghost' onClick={closeEditor}>
              취소
            </Button>
            <Button size='sm' onClick={save} disabled={blocked} loading={updateProfile.isPending}>
              저장
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
