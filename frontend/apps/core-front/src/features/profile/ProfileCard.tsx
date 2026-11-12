'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import type { Locale } from '@studyclub/types';
import { Button, Checkbox, toast, useImageUpload } from '@studyclub/ui';
import { Check, Pencil } from 'lucide-react';
import { useForm } from 'react-hook-form';

import { profileSchema, type ProfileFormValues } from './form-schema';
import type { MarketingConsent } from './types';
import { TimeZonePicker, zoneName } from '@/components/TimeZonePicker';
import type { Account } from '@/features/account/types';
import { logout, setUser, type SessionUser } from '@/features/auth/auth';
import { isPreview } from '@/features/auth/preview';
import { parseOnboardingFieldErrors } from '@/features/onboarding/model';
import { DiscordRow } from '@/features/profile/DiscordRow';
import { isSameNickname } from '@/features/profile/nickname';
import { checkNicknameAvailability } from '@/features/profile/nickname-repository';
import { initialOf } from '@/features/profile/photo';
import {
  useAttachProfileImage,
  useChangeMarketingConsent,
  useFetchLatestAccount,
  useMarketingConsent,
  useRemoveProfileImage,
  useUpdateProfile,
} from '@/features/profile/queries';
import { track } from '@/lib/analytics';
import { ApiError } from '@/lib/http';
import { uploadImage } from '@/lib/upload';

/**
 * 마이페이지 내 정보 카드.
 *
 * 보기와 편집이 같은 카드 안에서 바뀐다 — 고칠 것이 닉네임·시간대 둘뿐이라 지면을 옮길 일이 아니다.
 * 이메일은 로그인 계정 그 자체라 보여주기만 한다.
 *
 * 닉네임·시간대의 진본은 서버다. 저장에 성공하면 응답으로 세션 user 를 갱신한다.
 * 마케팅 수신 동의는 프로필 저장과 따로 간다 — 누르면 바로 바뀐다.
 *
 * 레이아웃은 playground 마이페이지와 같다(이름 옆 연필 · 「이름 | 값」 줄 · 카드 밖 회원 탈퇴). 너비는 페이지 폭을 쓴다.
 * 프로필 사진은 닉네임·이메일 왼쪽에 둔다. 저장 버튼 없이 고른 즉시 반영된다 — 올리기(번호 받기)와 연결, 두 호출을 이어서 부른다.
 * playground 에는 사진이 없다 — 위치는 서비스에서 먼저 정했다 (crew-edit-profile PRD 「기획 확정 필요」).
 */

type NickStatus = 'idle' | 'checking' | 'available' | 'taken' | 'error';
type Tone = 'muted' | 'error' | 'ok';

const NICKNAME_HINT = '2~20자 · 한글, 영문, 숫자, 밑줄(_)';
const NICKNAME_TAKEN = '이미 사용중인 닉네임입니다';

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
function toSessionUser(account: Account): SessionUser {
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
  /** 방금 저장했다 — 잠깐 「저장됨」을 띄운다 */
  const [savedFlash, setSavedFlash] = useState(false);

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
  // 사용자에게는 한 동작이다 — 올리기 201 직후 연결을 바로 부른다. 연결이 실패하면 올린 파일은 하루 뒤 서버가 지운다
  const photo = useImageUpload({
    purpose: 'PROFILE',
    upload: uploadImage,
    onUploaded: async (uploaded) => applyPhoto(await attachImage.mutateAsync(uploaded.fileId)),
    onError: photoErrorMessage,
  });
  const attachImage = useAttachProfileImage();
  const removeImage = useRemoveProfileImage();

  const draftName = watch('nickname');
  const draftZone = watch('timeZone');
  const trimmedName = draftName.trim();
  const nicknameMessage = errors.nickname?.message;
  // 지금 쓰는 자기 닉네임이면 서버에 묻지 않는다 — 안 바뀐 값으로 요청을 보낼 이유가 없다
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
  // 저장 중에는 입력칸과 취소를 잠근다 — 취소한 뒤 다시 연 편집을 먼저 보낸 저장 응답이 닫아 버리면 안 된다
  const saving = updateProfile.isPending;
  // 올리기~연결, 지우기 동안 사진 버튼 둘 다 잠근다. 닉네임 저장과도 서로 잠근다 — 두 응답이 세션을 번갈아 쓰면 한쪽이 덮인다
  const photoBusy = photo.isUploading || removeImage.isPending;
  const photoLocked = photoBusy || saving;
  const blocked =
    composing || Boolean(nicknameMessage) || nickStatus === 'taken' || nickStatus === 'checking' || saving || photoBusy;

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
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1800);
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
      const result = await updateProfile.mutateAsync(payload);
      const changedFields: string[] = [];
      if (!isSameNickname(values.nickname, user.nickname)) changedFields.push('nickname');
      if (values.timeZone !== user.timeZone) changedFields.push('timeZone');
      track({ name: 'My Profile Updated', props: { changed_fields: changedFields, new_region: values.timeZone } });
      applySaved(toSessionUser(result));
    } catch (err) {
      handleSaveError(err);
    }
  });

  /** 사진 쪽 실패 문구. 400·503 은 서버 사유를 그대로, 401 은 재로그인, 403 은 온보딩으로 — 이 둘은 문구 없이 null. */
  function photoErrorMessage(err: unknown): string | null {
    if (err instanceof ApiError) {
      if (err.status === 401) {
        setProblem('expired');
        return null;
      }
      if (err.status === 403) {
        router.replace(`/${locale}/onboarding?next=${encodeURIComponent(`/${locale}/my`)}`);
        return null;
      }
      return err.message;
    }
    return '사진을 바꾸지 못했습니다. 잠시 후 다시 시도해 주세요';
  }

  function applyPhoto(account: Account) {
    const next = toSessionUser(account);
    setUser(next);
    onUserChange(next);
  }

  async function removePhoto() {
    photo.setError(null);
    try {
      applyPhoto(await removeImage.mutateAsync());
    } catch (err) {
      photo.setError(photoErrorMessage(err));
    }
  }

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

  const { ref: nicknameRef, ...nicknameField } = register('nickname');

  return (
    <>
      {/* 이메일·닉네임이 보이는 카드 — Clarity 녹화에서 가린다 */}
      <section className={cardClass} data-clarity-mask='true'>
        <div className='flex items-start gap-4 px-6 pb-5 pt-6'>
          {/* 사진 — 닉네임·이메일 왼쪽. 미리보기 세션은 서버가 모르는 계정이라 바꾸기·지우기를 두지 않는다 */}
          <div className='flex shrink-0 flex-col items-center gap-1.5'>
            {user.picture ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.picture} alt='' className='h-14 w-14 rounded-full object-cover' />
            ) : (
              <div
                aria-hidden='true'
                className='grid h-14 w-14 place-items-center rounded-full bg-surface-2 type-title-lg text-fg-secondary'
              >
                {initialOf(user.nickname, user.email)}
              </div>
            )}
            {!preview && (
              <div className='flex items-center gap-2 type-label-sm'>
                <button
                  type='button'
                  onClick={photo.pick}
                  disabled={photoLocked}
                  className='text-fg-secondary underline-offset-4 hover:text-fg hover:underline disabled:opacity-50'
                >
                  {photo.isUploading ? '올리는 중' : '바꾸기'}
                </button>
                {user.picture && (
                  <button
                    type='button'
                    onClick={removePhoto}
                    disabled={photoLocked}
                    className='text-fg-muted underline-offset-4 hover:text-fg-secondary hover:underline disabled:opacity-50'
                  >
                    지우기
                  </button>
                )}
              </div>
            )}
            <input {...photo.inputProps} className='hidden' aria-label='프로필 사진 파일' />
          </div>

          <div className='min-w-0 flex-1 pt-2'>
            {editing ? (
              /* 이름이 있던 줄이 입력칸이 되고, 이메일 줄 자리에 상태 문구가 온다 — 카드 높이가 그대로다 */
              <div>
                <div className='flex items-center gap-2'>
                  <input
                    {...nicknameField}
                    ref={nicknameRef}
                    onCompositionStart={() => setComposing(true)}
                    onCompositionEnd={() => setComposing(false)}
                    onKeyDown={(e) => {
                      if (composing) return;
                      if (e.key === 'Enter') void save();
                      if (e.key === 'Escape' && !saving) closeEditor();
                    }}
                    autoFocus
                    autoComplete='nickname'
                    maxLength={20}
                    disabled={saving}
                    aria-label='닉네임'
                    aria-invalid={line.tone === 'error'}
                    aria-describedby='profile-nickname-help'
                    /* 테두리 대신 밑줄 — 상자로 만들면 그 줄만 키가 커져 카드가 달라 보인다 */
                    className='min-w-0 flex-1 border-0 border-b-2 border-brand bg-transparent p-0 pb-0.5 type-title-lg text-fg outline-none'
                  />
                  <span className='tnum shrink-0 type-label-sm text-fg-placeholder'>{trimmedName.length}/20</span>
                </div>
                <p id='profile-nickname-help' className={`mt-1 truncate type-body-sm ${toneClass(line.tone)}`}>
                  {line.text}
                </p>
              </div>
            ) : (
              <div>
                <div className='flex min-w-0 items-center gap-1.5'>
                  <p className='truncate type-title-lg text-fg'>{user.nickname ?? user.email}</p>
                  <button
                    type='button'
                    onClick={openEditor}
                    disabled={opening}
                    title='내 정보 수정'
                    aria-label='내 정보 수정'
                    className='grid h-7 w-7 shrink-0 place-items-center rounded-full text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg'
                  >
                    <Pencil size={14} />
                  </button>
                  <Saved show={savedFlash} />
                </div>
                <p className='mt-0.5 truncate type-body-sm text-fg-muted'>{user.email}</p>
              </div>
            )}
            {photo.error && (
              <p role='alert' className='mt-1 type-label-sm text-error-700'>
                {photo.error}
              </p>
            )}
          </div>
        </div>

        <dl className='divide-y divide-border border-t border-border type-body-sm'>
          <Field label='시간대'>
            {editing ? (
              <div className='w-full max-w-xs'>
                <TimeZonePicker
                  value={draftZone}
                  onChange={(zone) => setValue('timeZone', zone, { shouldValidate: true })}
                  locale={locale}
                  error={errors.timeZone?.message}
                  disabled={saving}
                  hideLabel
                />
              </div>
            ) : (
              <span className='font-semibold text-fg'>{zoneLabel}</span>
            )}
          </Field>

          <Field label='디스코드'>
            <DiscordRow accountId={user.id} locale={locale} preview={preview} onExpired={() => setProblem('expired')} />
          </Field>

          {/* 체크박스는 상태가 곧 결과다. 처리됐는지는 알림으로 알린다 */}
          <Field label='마케팅 수신'>
            <div className='min-w-0'>
              <Checkbox
                label='스터디 소식과 행사 안내를 이메일로 받기'
                checked={consent.data?.agreed ?? false}
                disabled={!consent.data || changeConsent.isPending}
                onChange={(event) =>
                  changeConsent.mutate(event.target.checked, {
                    onSuccess: (saved) => toast.success(consentMessage(saved)),
                  })
                }
              />
              {consent.isError && (
                <p role='alert' className='mt-1 type-label-sm text-error-700'>
                  수신 동의 상태를 불러오지 못했습니다. 새로고침해 주세요
                </p>
              )}
              {changeConsent.isError && (
                <p role='alert' className='mt-1 type-label-sm text-error-700'>
                  {consentChangeError}
                </p>
              )}
            </div>
          </Field>
        </dl>

        {problem === 'expired' && (
          <p role='alert' className='border-t border-border px-6 py-3 type-label-sm text-error-700'>
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
          <p role='alert' className='border-t border-border px-6 py-3 type-label-sm text-error-700'>
            내 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요
          </p>
        )}
        {problem === 'server' && (
          <p role='alert' className='border-t border-border px-6 py-3 type-label-sm text-error-700'>
            저장하지 못했습니다. 잠시 후 다시 시도해 주세요
          </p>
        )}

        {editing && (
          <div className='flex justify-end gap-2 border-t border-border px-6 py-3'>
            <Button size='sm' variant='tertiary' onClick={closeEditor} disabled={saving}>
              취소
            </Button>
            <Button size='sm' onClick={save} disabled={blocked} loading={saving}>
              저장
            </Button>
          </div>
        )}
      </section>

      {/* 찾을 수 있되 눈에 띄지 않게 — 카드 안 한 줄을 통째로 내주면 링크 하나에 무게가 실린다 */}
      <div className='mt-3 px-1'>
        <Link
          href={`/${locale}/my/leave`}
          className='type-label-sm text-fg-muted underline-offset-4 hover:text-fg-secondary hover:underline'
        >
          회원 탈퇴
        </Link>
      </div>
    </>
  );
}

/** 내 정보 한 줄 — 이름은 왼쪽 고정 폭, 값과 동작은 오른쪽. */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className='flex min-h-14 flex-col gap-2 px-6 py-3 sm:flex-row sm:items-center sm:gap-0'>
      {/* 이름 칸은 고정 폭 — 값이 이름 바로 옆에서 시작해 한 줄로 읽힌다 */}
      <dt className='shrink-0 whitespace-nowrap font-medium text-fg-secondary sm:w-28'>{label}</dt>
      <dd className='flex min-w-0 flex-1 items-center gap-2'>{children}</dd>
    </div>
  );
}

/** 저장 직후 잠깐 뜨는 표시 — 정말 저장됐는지 알 수 있게 */
function Saved({ show }: { show: boolean }) {
  return (
    <span
      aria-live='polite'
      className={`inline-flex items-center gap-0.5 type-label-sm text-success-700 transition-opacity duration-300 ${
        show ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {show && (
        <>
          <Check size={12} strokeWidth={3} /> 저장됨
        </>
      )}
    </span>
  );
}
