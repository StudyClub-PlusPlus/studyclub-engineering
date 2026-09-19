'use client';

// 수강생 페이지(A8) — 로그인 게이팅. 서버 미들웨어가 access 쿠키로 1차 게이트하고,
// 여기서도 클라이언트 세션(sc_user)이 없으면 /login 으로 보낸다(방어적).
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';


import { categoryGradient, categoryMeta } from '@core/components/StudyThumb';
import { TimeZonePicker, zoneName } from '@core/components/TimeZonePicker';
import { getUser, type SessionUser } from '@core/lib/auth';
import type { Locale } from '@core/lib/content';
import { t } from '@core/lib/i18n';
import {
  cancelApplication,
  getApplications,
  getBookmarks,
  getDiscord,
  getDisplayName,
  getTimeZone,
  seedDemoData,
  setDiscord,
  setBookmarked,
  setDisplayName,
  setTimeZone,
  type Application,
  type DiscordLink,
} from '@core/lib/me';
import { checkNicknameAvailability, normalizeNickname } from '@core/lib/nickname-availability';
import { nicknameError } from '@core/lib/onboarding';
import { IS_DEV, syncPreview } from '@core/lib/preview';
import { recruitState } from '@core/lib/recruit';
import { studies as allStudies, type Study } from '@studyclub/mock';
import { Button, Input } from '@studyclub/ui';
import { CalendarClock, Heart, Pencil } from 'lucide-react';

import { SPEC } from './spec';
import { ScreenSpecRegistrar } from '@/proto/annotate';

/**
 * 마이페이지.
 *
 * 스터디를 **회원 입장에서 처리해야 할 순서대로** 나눈다: 승인 대기 → 참여 중 → (참여 이력 ·
 * 관심). 한 목록에 상태 배지만 섞어 두면 "내가 지금 뭘 하고 있는지"를 회원이 직접 읽어내야 한다.
 *
 * 앞의 둘은 펼쳐 두고 뒤의 둘은 탭으로 묶는다 — 앞의 둘은 개수가 늘지 않고, 뒤의 둘만 쌓인다.
 *
 * 참여 중과 참여 이력을 가르는 것은 신청 상태가 아니라 **스터디가 끝났는지** 여부다.
 *
 * 거주 지역은 내 정보에 있다. 신청 시 참여 가능 요일과 함께 남겨, 운영자가 어느 시간대 응답인지 알게 한다.
 */

/** 목록 한 줄 — 카테고리 색 막대로 어느 분야인지 한눈에 구분한다(목록 카드와 같은 색 규칙). */
function StudyRow({ study, locale, right }: { study: Study; locale: Locale; right?: React.ReactNode }) {
  const { icon: Icon, label } = categoryMeta(study.category);
  return (
    <li className='flex items-center gap-4 border-b border-border py-3.5 last:border-b-0'>
      <span
        className='grid h-10 w-10 shrink-0 place-items-center rounded-card text-white'
        style={{ background: categoryGradient(study.category) }}
        aria-hidden='true'
      >
        <Icon size={17} strokeWidth={1.75} />
      </span>
      <div className='min-w-0 flex-1'>
        <Link
          href={`/proto/core/${locale}/studies/${study.id}`}
          className='block truncate font-bold text-fg underline-offset-4 hover:underline'
        >
          {t(study.title, locale)}
        </Link>
        <p className='mt-0.5 flex items-center gap-1.5 truncate text-[13px] text-fg-secondary'>
          <span className='shrink-0 text-fg-muted'>{label}</span>
          <span className='text-fg-muted'>·</span>
          <CalendarClock size={12} strokeWidth={1.75} className='shrink-0' />
          {/* 일정 미정은 빈칸이 아니라 정책 — 신청자 응답으로 정한다 */}
          <span className='truncate'>{study.schedule ? t(study.schedule, locale) : '일정 미정 · 신청자와 조율'}</span>
        </p>
      </div>
      {right}
    </li>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section className='card mt-6 px-6 py-5'>
      <h2 className='flex items-baseline gap-2 text-[15px] font-bold text-fg'>
        {title}
        <span className='tnum text-[13px] font-medium text-fg-muted'>{count}</span>
      </h2>
      <div className='mt-2'>{children}</div>
    </section>
  );
}

/**
 * 쌓이는 목록(참여 이력·관심 스터디)은 탭 하나로 묶는다.
 *
 * 넷을 모두 세로로 늘어놓으면 스터디가 쌓일수록 페이지가 끝없이 길어진다. 반대로 넷을 전부
 * 탭으로 만들면 "승인 대기가 있는지"를 보려고 탭을 눌러야 한다 — **지금 할 일은 펼쳐 두고,
 * 쌓이기만 하는 것만 접는다.**
 */
function ArchiveTabs({
  tabs,
  children,
}: {
  tabs: { key: string; label: string; count: number }[];
  children: (key: string) => React.ReactNode;
}) {
  const [active, setActive] = useState(tabs[0].key);
  return (
    <section className='card mt-6 px-6 py-5'>
      <div className='flex gap-1 border-b border-border'>
        {tabs.map((t) => (
          <button
            key={t.key}
            type='button'
            onClick={() => setActive(t.key)}
            className={`-mb-px border-b-2 px-3 pb-2.5 text-[15px] font-bold transition-colors ${
              active === t.key ? 'border-brand text-fg' : 'border-transparent text-fg-muted hover:text-fg-secondary'
            }`}
          >
            {t.label}
            <span className='tnum ml-1.5 text-[13px] font-medium text-fg-muted'>{t.count}</span>
          </button>
        ))}
      </div>
      <div className='mt-2'>{children(active)}</div>
    </section>
  );
}

/** 길어지는 목록은 일부만 보이고 나머지는 눌러서 편다. */
function ExpandableList({ children, initial = 5 }: { children: React.ReactNode[]; initial?: number }) {
  const [all, setAll] = useState(false);
  const hidden = children.length - initial;
  return (
    <>
      <ul>{all ? children : children.slice(0, initial)}</ul>
      {hidden > 0 && !all && (
        <button
          type='button'
          onClick={() => setAll(true)}
          className='mt-3 w-full rounded-control border border-border py-2 text-[13px] font-semibold text-fg-secondary transition-colors hover:bg-surface-2'
        >
          {hidden}개 더 보기
        </button>
      )}
    </>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className='py-6 text-center text-sm text-fg-secondary'>{children}</p>;
}

export default function MyPage() {
  const params = useParams();
  const router = useRouter();
  const locale = ((params?.locale as string) ?? 'ko') as Locale;
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);

  const [timeZone, setTimeZoneState] = useState('Asia/Seoul');
  const [applications, setApplications] = useState<Application[]>([]);
  const [bookmarks, setBookmarks] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [discord, setDiscordState] = useState<DiscordLink>(null);
  // 인라인 편집 — 고치는 값 옆에서 바로 고친다. 항목이 둘뿐이라 따로 지면을 열 일이 아니다.
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftZone, setDraftZone] = useState('Asia/Seoul');
  const [composing, setComposing] = useState(false);
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
    setName(getDisplayName() ?? u.name ?? u.email);
    setTimeZoneState(getTimeZone());
    setApplications(getApplications());
    setBookmarks(getBookmarks());
    setDiscordState(getDiscord());
    setReady(true);
  }, [locale, router]);

  const byId = useMemo(() => new Map(allStudies.map((s) => [s.id, s])), []);
  const joined = applications
    .map((a) => ({ app: a, study: byId.get(a.studyId) }))
    .filter((x): x is { app: Application; study: Study } => Boolean(x.study))
    .sort((a, b) => b.app.appliedAt.localeCompare(a.app.appliedAt));
  const pending = joined.filter((x) => x.app.status === 'pending');
  const active = joined.filter((x) => x.app.status === 'accepted' && x.study.status !== 'closed');
  const past = joined.filter((x) => x.app.status === 'accepted' && x.study.status === 'closed');
  const marked = bookmarks
    .map((id) => byId.get(id))
    .filter((s): s is Study => Boolean(s))
    .reverse();

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
    setEditing(true);
  }

  function save() {
    if (nameBlocked) return;
    setName(trimmedName);
    setDisplayName(trimmedName);
    setTimeZoneState(draftZone);
    setTimeZone(draftZone);
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

  function handleCancel(studyId: string) {
    cancelApplication(studyId);
    setApplications(getApplications());
  }

  function handleUnbookmark(studyId: string) {
    setBookmarked(studyId, false);
    setBookmarks(getBookmarks());
  }

  return (
    <div className='mx-auto max-w-3xl px-6 pb-16 pt-10'>
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
              <div data-anno='profile:2' className='max-w-sm'>
                <Input
                  label='닉네임'
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onCompositionStart={() => setComposing(true)}
                  onCompositionEnd={() => setComposing(false)}
                  labelHint={`${trimmedName.length}/20`}
                  autoFocus
                />
                <p
                  className={`mt-2 text-xs ${
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
        <dl className='mt-5 grid grid-cols-[4.5rem_1fr] items-baseline gap-x-6 gap-y-3 px-6 pb-5 text-sm'>
          <dt className='text-fg-muted'>시간대</dt>
          <dd data-anno='profile:3' className='min-w-0'>
            {editing ? (
              <div className='max-w-xs'>
                <TimeZonePicker value={draftZone} onChange={setDraftZone} locale={locale} hideLabel />
              </div>
            ) : (
              <span className='font-semibold text-fg'>{zoneLabel}</span>
            )}
          </dd>

          <dt className='text-fg-muted'>디스코드</dt>
          <dd data-anno='profile:4' className='flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1'>
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
        </dl>

        {/* 닫는 줄 — 무거운 동작은 왼쪽 끝, 주액션은 오른쪽 끝 */}
        <div className='flex items-center justify-between gap-3 border-t border-border px-6 py-3'>
          <Link
            data-anno='profile:6'
            href={`/proto/core/${locale}/my/leave`}
            className='text-xs text-fg-muted underline-offset-4 hover:text-fg-secondary hover:underline'
          >
            회원 탈퇴
          </Link>
          <div data-anno='profile:5' className='flex items-center gap-2'>
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

      <Section title='승인 대기' count={pending.length}>
        {pending.length === 0 ? (
          <Empty>
            승인을 기다리는 신청이 없습니다.{' '}
            <Link href={`/proto/core/${locale}/studies`} className='font-semibold text-brand underline-offset-4 hover:underline'>
              스터디 둘러보기
            </Link>
          </Empty>
        ) : (
          <ul>
            {pending.map(({ app, study }) => (
              <StudyRow
                key={study.id}
                study={study}
                locale={locale}
                right={
                  <div className='flex shrink-0 items-center gap-3'>
                    <p className='tnum text-[11px] text-fg-muted'>{app.appliedAt} 신청</p>
                    {/* 승인 전에는 회원이 스스로 물릴 수 있어야 한다 */}
                    <button
                      type='button'
                      onClick={() => handleCancel(study.id)}
                      className='text-xs font-semibold text-fg-muted underline-offset-4 hover:text-error-600 hover:underline'
                    >
                      취소
                    </button>
                  </div>
                }
              />
            ))}
          </ul>
        )}
      </Section>

      <Section title='참여 중인 스터디' count={active.length}>
        {active.length === 0 ? (
          <Empty>참여 중인 스터디가 없습니다.</Empty>
        ) : (
          <ul>
            {active.map(({ study }) => (
              <StudyRow
                key={study.id}
                study={study}
                locale={locale}
                right={
                  <span className='shrink-0 rounded-pill bg-recruiting-bg px-2.5 py-1 text-[11px] font-bold text-recruiting-fg'>
                    진행 중
                  </span>
                }
              />
            ))}
          </ul>
        )}
      </Section>

      {/* 쌓이기만 하는 두 목록 — 탭으로 묶어 페이지가 길어지지 않게 한다 */}
      <ArchiveTabs
        // 관심이 앞 — 다시 열어볼 일이 더 잦고, 참여 이력은 굳이 찾아보는 기록이다
        tabs={[
          { key: 'saved', label: '관심 스터디', count: marked.length },
          { key: 'past', label: '참여 이력', count: past.length },
        ]}
      >
        {(key) =>
          key === 'past' ? (
            past.length === 0 ? (
              <Empty>아직 완료한 스터디가 없습니다.</Empty>
            ) : (
              <ExpandableList>
                {past.map(({ app, study }) => (
                  <StudyRow
                    key={study.id}
                    study={study}
                    locale={locale}
                    right={
                      <div className='shrink-0 text-right'>
                        <span className='inline-flex rounded-pill bg-surface-2 px-2.5 py-1 text-[11px] font-bold text-fg-secondary'>
                          완료
                        </span>
                        <p className='tnum mt-1 text-[11px] text-fg-muted'>{app.appliedAt} 참여</p>
                      </div>
                    }
                  />
                ))}
              </ExpandableList>
            )
          ) : marked.length === 0 ? (
            <Empty>스터디 카드의 하트를 누르면 여기에 모입니다.</Empty>
          ) : (
            <ExpandableList>
              {marked.map((s) => (
                <StudyRow
                  key={s.id}
                  study={s}
                  locale={locale}
                  right={
                    <div className='flex shrink-0 items-center gap-3'>
                      <span className='text-xs font-medium text-fg-secondary'>
                        {recruitState(s) === 'apply' ? '모집중' : '모집 마감'}
                      </span>
                      <button
                        type='button'
                        onClick={() => handleUnbookmark(s.id)}
                        aria-label='관심 스터디에서 빼기'
                        title='관심 스터디에서 빼기'
                        className='grid h-8 w-8 place-items-center rounded-full text-error-500 transition-colors hover:bg-surface-2'
                      >
                        <Heart size={16} strokeWidth={2} className='fill-current' />
                      </button>
                    </div>
                  }
                />
              ))}
            </ExpandableList>
          )
        }
      </ArchiveTabs>

    </div>
  );
}
