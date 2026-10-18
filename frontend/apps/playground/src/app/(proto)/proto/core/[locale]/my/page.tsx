'use client';

// 수강생 페이지(A8) — 로그인 게이팅. 서버 미들웨어가 access 쿠키로 1차 게이트하고,
// 여기서도 클라이언트 세션(sc_user)이 없으면 /login 으로 보낸다(방어적).
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';


import { TimeZonePicker, zoneName } from '@core/components/TimeZonePicker';
import { getUser, type SessionUser } from '@core/lib/auth';
import { type Locale } from '@core/lib/content';
import { PAGE } from '@core/lib/layout';
import {
  getDiscord,
  getDisplayName,
  getMarketing,
  getTimeZone,
  seedDemoData,
  setDiscord,
  setMarketing,
  setDisplayName,
  setTimeZone,
  type DiscordLink,
} from '@core/lib/me';
import { checkNicknameAvailability, normalizeNickname } from '@core/lib/nickname-availability';
import { nicknameError } from '@core/lib/onboarding';
import { IS_DEV, syncPreview } from '@core/lib/preview';
import { Button } from '@studyclub/ui';
import { Pencil } from 'lucide-react';

import { SPEC } from './spec';
import { ScreenSpecRegistrar } from '@/proto/annotate';

/**
 * 마이페이지 — 내 정보만 다룬다.
 *
 * 스터디 목록은 두지 않는다. 참여 중·참여 종료는 내 스터디룸, 관심은 찜한 스터디가 맡는다.
 * 신청에는 승인 대기가 없다 (POL-0004) — 신청하면 곧 참여라 따로 기다리는 목록이 필요 없다.
 *
 * 거주 지역은 내 정보에 있다. 신청 시 참여 가능 요일과 함께 남겨, 운영자가 어느 시간대 응답인지 알게 한다.
 */
export default function MyPage() {
  const params = useParams();
  const router = useRouter();
  const locale = ((params?.locale as string) ?? 'ko') as Locale;
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);

  const [timeZone, setTimeZoneState] = useState('Asia/Seoul');
  const [name, setName] = useState('');
  const [discord, setDiscordState] = useState<DiscordLink>(null);
  // 인라인 편집 — 고치는 값 옆에서 바로 고친다. 항목이 둘뿐이라 따로 지면을 열 일이 아니다.
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftZone, setDraftZone] = useState('Asia/Seoul');
  const [composing, setComposing] = useState(false);
  const [marketing, setMarketingState] = useState(false);
  const [draftMarketing, setDraftMarketing] = useState(false);
  const [nickStatus, setNickStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'error'>('idle');

  useEffect(() => {
    // 로컬 미리보기에서는 세션 정의를 맞추고 더미를 채운다(버전이 같으면 아무것도 하지 않는다)
    if (IS_DEV) seedDemoData();
    const u = IS_DEV ? syncPreview() : getUser();
    if (!u) {
      router.replace(`/proto/core/${locale}/login?next=/proto/core/${locale}/my`);
      return;
    }
    setUser(u);
    setName(getDisplayName() ?? u.nickname ?? u.email);
    setTimeZoneState(getTimeZone());
    setDiscordState(getDiscord());
    setMarketingState(getMarketing());
    setReady(true);
  }, [locale, router]);

  const trimmedName = draftName.trim();
  const unchangedName = normalizeNickname(trimmedName) === normalizeNickname(name);
  const nameFormatError = composing ? undefined : nicknameError(draftName, locale);

  useEffect(() => {
    if (!editing || composing || nameFormatError || unchangedName) {
      setNickStatus('idle');
      return;
    }
    const controller = new AbortController();
    setNickStatus('checking');
    const timer = setTimeout(() => {
      checkNicknameAvailability(trimmedName, controller.signal)
        .then((r) => setNickStatus(r.available ? 'available' : 'taken'))
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === 'AbortError') return;
          setNickStatus('error');
        });
    }, 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [editing, trimmedName, composing, nameFormatError, unchangedName]);

  const nameLine: { text: string; tone: 'muted' | 'error' | 'ok' } = nameFormatError
    ? { text: nameFormatError, tone: 'error' }
    : nickStatus === 'checking'
      ? { text: '확인 중입니다', tone: 'muted' }
      : nickStatus === 'available'
        ? { text: '사용할 수 있는 닉네임입니다', tone: 'ok' }
        : nickStatus === 'taken'
          ? { text: '이미 사용중인 닉네임입니다', tone: 'error' }
          : nickStatus === 'error'
            ? { text: '확인하지 못했습니다. 다시 시도해 주세요', tone: 'muted' }
            : { text: '2~20자 · 한글, 영문, 숫자, 밑줄(_)', tone: 'muted' };

  const nameBlocked = Boolean(nameFormatError) || nickStatus === 'taken' || nickStatus === 'checking';

  const zoneLabel = zoneName(timeZone, locale) ?? timeZone;

  if (!ready || !user) {
    return <div className='px-6 py-16 text-center text-sm text-fg-secondary'>불러오는 중…</div>;
  }


  function openEditor() {
    setDraftName(name);
    setDraftZone(timeZone);
    setDraftMarketing(marketing);
    setEditing(true);
  }

  function save() {
    if (nameBlocked) return;
    setName(trimmedName);
    setDisplayName(trimmedName);
    setTimeZoneState(draftZone);
    setTimeZone(draftZone);
    setMarketingState(draftMarketing);
    setMarketing(draftMarketing);
    setEditing(false);
  }

  function connectDiscord() {
    // TODO(api): 디스코드 OAuth 로 교체
    setDiscord('jiwon_dev');
    setDiscordState(getDiscord());
  }

  function disconnectDiscord() {
    setDiscord(null);
    setDiscordState(null);
  }

  return (
    <div className={`${PAGE} pb-16 pt-10`}>
      <h1 className='text-2xl font-extrabold tracking-tight'>마이페이지</h1>

      <ScreenSpecRegistrar spec={SPEC} />
      {/* 내 정보 — 닉네임·이메일·나의 시간대. 고치는 건 한 곳(수정 팝업)에서 한다 */}
      {/* 내 정보 — 이름줄 하나, 값줄 셋. 값을 가로로 늘어놓아야 카드가 비어 보이지 않는다 */}
      {/* 내 정보 — 보기와 편집이 같은 카드 안에서 바뀐다. 고칠 것이 셋뿐이라 지면을 옮길 일이 아니다 */}
      {/* 편집 중에는 넘치게 둔다 — 시간대 메뉴가 카드 밖으로 열린다 */}
      <section data-anno='profile:1' className={`card mt-5 ${editing ? '' : 'overflow-hidden'}`}>
        <div className='flex items-start justify-between gap-4 px-6 pt-5'>
          <div className='min-w-0 flex-1'>
            {editing ? (
              /*
                보던 자리에서 고친다. 이름이 있던 줄이 입력칸이 되고, 이메일 줄 자리에 상태 문구가 온다.
                블록을 새로 쌓으면 아래 값들이 밀려 같은 카드가 다른 화면처럼 보인다.
              */
              <div data-anno='profile:2' className='min-w-0'>
                <div className='flex items-center gap-2'>
                  <input
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    onCompositionStart={() => setComposing(true)}
                    onCompositionEnd={() => setComposing(false)}
                    autoFocus
                    aria-label='닉네임'
                    /* 테두리 대신 밑줄 — 입력칸을 상자로 만들면 그 줄만 키가 커져 카드 전체가 달라 보인다 */
                    className='min-w-0 flex-1 border-0 border-b border-border-strong bg-transparent p-0 text-xl font-extrabold tracking-tight text-fg outline-none focus:border-brand'
                  />
                  <span className='tnum shrink-0 text-xs text-fg-placeholder'>{trimmedName.length}/20</span>
                </div>
                <p
                  className={`mt-0.5 truncate text-sm ${
                    nameLine.tone === 'ok'
                      ? 'text-success-700'
                      : nameLine.tone === 'error'
                        ? 'text-error-700'
                        : 'text-fg-muted'
                  }`}
                >
                  {nameLine.text}
                </p>
              </div>
            ) : (
              <>
                <p className='truncate text-xl font-extrabold tracking-tight text-fg'>{name}</p>
                <p className='mt-0.5 truncate text-sm text-fg-muted'>{user.email}</p>
              </>
            )}
          </div>

          {!editing && (
            <button
              type='button'
              data-anno='profile:1-1'
              onClick={openEditor}
              title='내 정보 수정'
              aria-label='내 정보 수정'
              className='grid h-9 w-9 shrink-0 place-items-center rounded-control border border-border-strong text-fg-secondary transition-colors hover:bg-surface-2 hover:text-fg'
            >
              <Pencil size={15} />
            </button>
          )}
        </div>

        {/* 값은 이름과 값 두 줄로만 세운다 — 칸을 나눠 담으면 둘뿐인 값이 표처럼 보인다 */}
        <dl className='mt-5 grid grid-cols-[4.5rem_1fr] items-center gap-x-6 gap-y-2 px-6 pb-5 text-sm'>
          <dt className='flex min-h-8 items-center text-fg-muted'>시간대</dt>
          <dd data-anno='profile:3' className='flex min-h-8 min-w-0 items-center'>
            {editing ? (
              <div className='max-w-xs'>
                <TimeZonePicker value={draftZone} onChange={setDraftZone} locale={locale} hideLabel compact />
              </div>
            ) : (
              <span className='font-semibold text-fg'>{zoneLabel}</span>
            )}
          </dd>

          <dt className='flex min-h-8 items-center text-fg-muted'>디스코드</dt>
          <dd data-anno='profile:4' className='flex min-h-8 min-w-0 flex-wrap items-center gap-x-2 gap-y-1'>
            {discord ? (
              <>
                <span className='truncate font-semibold text-fg'>@{discord.handle}</span>
                {editing && (
                  <button
                    type='button'
                    onClick={disconnectDiscord}
                    className='text-xs font-semibold text-fg-muted underline-offset-4 hover:text-error-600 hover:underline'
                  >
                    연결 해제
                  </button>
                )}
              </>
            ) : (
              <>
                <span className='font-semibold text-fg-muted'>연결 안 됨</span>
                {editing && (
                  <button
                    type='button'
                    onClick={connectDiscord}
                    className='text-xs font-semibold text-brand underline-offset-4 hover:underline'
                  >
                    연결하기
                  </button>
                )}
              </>
            )}
          </dd>

          {/*
            가입 때 받는 선택 동의라 끄고 켜는 길이 있어야 한다. 가입 화면에만 두면 바꿀 수 없다.
            가입 완료·탈퇴 안내는 이 값과 무관하게 나간다.
          */}
          <dt className='flex min-h-8 items-center text-fg-muted'>마케팅 수신</dt>
          <dd data-anno='profile:5' className='flex min-h-8 min-w-0 flex-wrap items-center gap-x-2 gap-y-1'>
            {/* 보기·편집 모두 같은 체크박스 — 보기 상태는 저장된 값만 보여주고 못 바꾼다 */}
            <label className={'inline-flex items-center gap-2 ' + (editing ? 'cursor-pointer' : 'cursor-default')}>
              <input
                type='checkbox'
                checked={editing ? draftMarketing : marketing}
                disabled={!editing}
                onChange={(ev) => setDraftMarketing(ev.target.checked)}
                className='h-4 w-4 accent-[var(--color-brand)] disabled:cursor-default'
              />
              <span className='text-sm text-fg'>스터디 소식과 행사 안내를 이메일로 받기</span>
            </label>
          </dd>
        </dl>

        {/* 닫는 줄 — 무거운 동작은 왼쪽 끝, 주액션은 오른쪽 끝 */}
        <div className='flex min-h-14 items-center justify-between gap-3 border-t border-border px-6 py-3'>
          <Link
            data-anno='profile:7'
            href={`/proto/core/${locale}/my/leave`}
            className='text-xs text-fg-muted underline-offset-4 hover:text-fg-secondary hover:underline'
          >
            회원 탈퇴
          </Link>
          <div data-anno='profile:6' className='flex items-center gap-2'>
            {editing && (
              <>
                <Button size='sm' variant='ghost' onClick={() => setEditing(false)}>
                  취소
                </Button>
                <Button size='sm' onClick={save} disabled={nameBlocked}>
                  저장
                </Button>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
