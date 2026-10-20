'use client';

// 수강생 페이지(A8) — 로그인 게이팅. 서버 미들웨어가 access 쿠키로 1차 게이트하고,
// 여기서도 클라이언트 세션(sc_user)이 없으면 /login 으로 보낸다(방어적).
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';


import { TimeZonePicker } from '@core/components/TimeZonePicker';
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
import { Button, Checkbox } from '@studyclub/ui';
import { Check, Pencil } from 'lucide-react';

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
  // 닉네임만 따로 고친다 — 검사(형식·중복)가 있어 확정 단계가 필요하다. 나머지 줄은 누르면 바로 저장된다
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState('');
  /** 방금 저장된 줄 — 잠깐 「저장됨」을 띄운다 */
  const [savedRow, setSavedRow] = useState<'name' | 'zone' | 'discord' | 'marketing' | null>(null);
  const [composing, setComposing] = useState(false);
  const [marketing, setMarketingState] = useState(false);
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


  if (!ready || !user) {
    return <div className='px-6 py-16 text-center text-sm text-fg-secondary'>불러오는 중…</div>;
  }


  function flash(row: 'name' | 'zone' | 'discord' | 'marketing') {
    setSavedRow(row);
    window.setTimeout(() => setSavedRow((cur) => (cur === row ? null : cur)), 1800);
  }

  function openEditor() {
    setDraftName(name);
    setEditing(true);
  }

  function saveName() {
    if (nameBlocked) return;
    if (!unchangedName) {
      // TODO(api): PATCH /api/me { nickname, timeZone } — 시간대는 지금 값을 같이 보낸다
      setName(trimmedName);
      setDisplayName(trimmedName);
      flash('name');
    }
    setEditing(false);
  }

  function changeZone(zone: string) {
    if (zone === timeZone) return;
    // TODO(api): PATCH /api/me { nickname, timeZone } — 닉네임은 지금 값을 같이 보낸다
    setTimeZoneState(zone);
    setTimeZone(zone);
    flash('zone');
  }

  function changeMarketing(on: boolean) {
    // TODO(api): PUT /api/me/marketing-consent — 실패하면 이전 값으로 되돌리고 사유를 보여준다
    setMarketingState(on);
    setMarketing(on);
    flash('marketing');
  }

  function connectDiscord() {
    // TODO(api): 디스코드 OAuth 로 교체
    setDiscord('jiwon_dev');
    setDiscordState(getDiscord());
    flash('discord');
  }

  function disconnectDiscord() {
    setDiscord(null);
    setDiscordState(null);
    flash('discord');
  }

  return (
    <div className={`${PAGE} pb-16 pt-10`}>
      <h1 className='text-2xl font-extrabold tracking-tight'>마이페이지</h1>

      <ScreenSpecRegistrar spec={SPEC} />
      {/*
        내 정보 — 줄마다 스스로 저장된다. 카드 전체를 편집 모드로 바꾸지 않는다:
        닉네임·시간대는 저장 버튼을, 마케팅·디스코드는 누르는 즉시를 따르면 한 카드에 저장 방식이 둘이 된다.
        닉네임만 검사가 있어 그 자리에서 고치고 확정한다.
      */}
      {/* 고칠 값이 넷뿐이라 페이지 폭을 다 쓰지 않는다 — 넓히면 이름과 값·동작 사이가 멀어진다 */}
      <section data-anno='profile:1' className='card mt-5 max-w-xl'>
        <div className='px-6 pb-5 pt-6'>
          {editing ? (
            /* 이름이 있던 줄이 입력칸이 되고, 이메일 줄 자리에 상태 문구가 온다 — 카드 높이가 그대로다 */
            <div data-anno='profile:2'>
              <div className='flex items-center gap-2'>
                <input
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onCompositionStart={() => setComposing(true)}
                  onCompositionEnd={() => setComposing(false)}
                  onKeyDown={(e) => {
                    if (composing) return;
                    if (e.key === 'Enter') saveName();
                    if (e.key === 'Escape') setEditing(false);
                  }}
                  autoFocus
                  maxLength={20}
                  aria-label='닉네임'
                  /* 테두리 대신 밑줄 — 상자로 만들면 그 줄만 키가 커져 카드가 달라 보인다 */
                  className='min-w-0 flex-1 border-0 border-b-2 border-brand bg-transparent p-0 pb-0.5 text-xl font-extrabold tracking-tight text-fg outline-none'
                />
                <span className='tnum shrink-0 text-xs text-fg-placeholder'>{trimmedName.length}/20</span>
                <Button size='sm' variant='ghost' onClick={() => setEditing(false)}>
                  취소
                </Button>
                <Button size='sm' onClick={saveName} disabled={nameBlocked}>
                  저장
                </Button>
              </div>
              <p
                className={`mt-1 truncate text-sm ${
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
            <div>
              <div className='flex min-w-0 items-center gap-1.5'>
                <p className='truncate text-xl font-extrabold tracking-tight text-fg'>{name}</p>
                {/* 고치는 자리는 고칠 값 바로 옆 — 카드 모서리의 버튼은 무엇을 고치는지 읽히지 않는다 */}
                <button
                  type='button'
                  data-anno='profile:1-1'
                  onClick={openEditor}
                  title='닉네임 수정'
                  aria-label='닉네임 수정'
                  className='grid h-7 w-7 shrink-0 place-items-center rounded-full text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg'
                >
                  <Pencil size={14} />
                </button>
                <Saved show={savedRow === 'name'} />
              </div>
              <p className='mt-0.5 truncate text-sm text-fg-muted'>{user.email}</p>
            </div>
          )}
        </div>

        <dl className='divide-y divide-border border-t border-border text-sm'>
          <Field label='시간대' anno='profile:3' saved={savedRow === 'zone'}>
            <div className='w-full sm:w-52'>
              <TimeZonePicker value={timeZone} onChange={changeZone} locale={locale} hideLabel compact />
            </div>
          </Field>

          <Field label='디스코드' anno='profile:4' saved={savedRow === 'discord'}>
            {discord ? (
              <>
                <span className='truncate font-semibold text-fg'>@{discord.handle}</span>
                <Button size='sm' variant='ghost' onClick={disconnectDiscord}>
                  연결 해제
                </Button>
              </>
            ) : (
              <>
                <span className='text-fg-muted'>연결 안 됨</span>
                <Button size='sm' variant='secondary' onClick={connectDiscord}>
                  연결하기
                </Button>
              </>
            )}
          </Field>

          {/*
            가입 때 받는 선택 동의라 끄고 켜는 길이 있어야 한다. 가입 화면에만 두면 바꿀 수 없다.
            가입 완료·탈퇴 안내는 이 값과 무관하게 나간다.
          */}
          <Field label='마케팅 수신' anno='profile:5' saved={savedRow === 'marketing'}>
            <Checkbox
              label='스터디 소식과 행사 안내를 이메일로 받기'
              checked={marketing}
              onChange={(ev) => changeMarketing(ev.target.checked)}
            />
          </Field>
        </dl>

      </section>

      {/* 찾을 수 있되 눈에 띄지 않게 — 카드 안 한 줄을 통째로 내주면 링크 하나에 무게가 실린다 */}
      <div className='mt-3 max-w-xl px-1'>
        <Link
          data-anno='profile:7'
          href={`/proto/core/${locale}/my/leave`}
          className='text-xs text-fg-muted underline-offset-4 hover:text-fg-secondary hover:underline'
        >
          회원 탈퇴
        </Link>
      </div>
    </div>
  );
}

/** 내 정보 한 줄 — 이름은 왼쪽 고정 폭, 값과 동작은 오른쪽. 줄마다 스스로 저장된다. */
function Field({
  label,
  anno,
  saved,
  children,
}: {
  label: string;
  anno: string;
  saved: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className='flex min-h-14 flex-col gap-2 px-6 py-3 sm:flex-row sm:items-center sm:gap-0'>
      {/* 이름 칸은 고정 폭 — 값이 이름 바로 옆에서 시작해 한 줄로 읽힌다 */}
      <dt className='shrink-0 whitespace-nowrap font-medium text-fg-secondary sm:w-28'>{label}</dt>
      <dd data-anno={anno} className='flex min-w-0 flex-1 items-center gap-2'>
        {children}
        {/* 저장 표시는 줄 끝 — 값 옆에 두면 값이 밀려 움직인다 */}
        <span className='ml-auto shrink-0'>
          <Saved show={saved} />
        </span>
      </dd>
    </div>
  );
}

/** 저장 직후 잠깐 뜨는 표시 — 즉시 저장되는 줄이 정말 저장됐는지 알 수 있게 */
function Saved({ show }: { show: boolean }) {
  return (
    <span
      aria-live='polite'
      className={`inline-flex items-center gap-0.5 text-xs font-semibold text-success-700 transition-opacity duration-300 ${
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
