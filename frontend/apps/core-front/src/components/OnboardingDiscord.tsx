'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { site } from '@studyclub/mock';
import { Button } from '@studyclub/ui';
import { CheckCircle2, ExternalLink, MessageCircle } from 'lucide-react';

import { profileKeys } from '@/features/profile/queries';
import { track } from '@/lib/analytics';
import { clearSession, getUser } from '@/lib/auth';
import type { Locale } from '@/lib/content';
import {
  DISCORD_LINK_READY,
  DiscordPopupError,
  fetchDiscordLinkState,
  linkDiscord,
  requestDiscordCode,
} from '@/lib/discord';
import { ApiError } from '@/lib/http';
import { withoutApplyIntent } from '@/lib/onboarding';
import { getQueryClient } from '@/lib/query-client';

function errorCode(e: unknown) {
  return e instanceof ApiError ? (e.body as { errorCode?: string } | undefined)?.errorCode : undefined;
}

/**
 * 가입 완료 직후 디스코드 연결 선택 (DSC-03).
 * 연결은 신청·마이페이지와 같은 OAuth 팝업(`requestDiscordCode`)을 쓴다.
 * 연결·건너뛰기 모두 가입 완료 상태를 유지한다.
 */
export function OnboardingDiscord({ locale, next }: { locale: Locale; next: string }) {
  const ko = locale === 'ko';
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notInGuild, setNotInGuild] = useState(false);
  /** 팝업 인증 중에 다른 페이지로 떠나면 나중에 router.replace(next) 하지 않는다 */
  const onPage = useRef(true);

  useEffect(() => {
    onPage.current = true;
    return () => {
      onPage.current = false;
    };
  }, []);

  useEffect(() => {
    const user = getUser();
    if (!user) {
      router.replace(
        `/${locale}/login?next=${encodeURIComponent(`/${locale}/onboarding?step=discord&next=${encodeURIComponent(next)}`)}`,
      );
      return;
    }
    if (!user.onboardingCompletedAt) {
      router.replace(`/${locale}/onboarding?next=${encodeURIComponent(next)}`);
      return;
    }

    let cancelled = false;
    void (async () => {
      const linkState = await fetchDiscordLinkState(user.id);
      if (cancelled) return;
      if (linkState === 'unauthorized') {
        clearSession();
        router.replace(
          `/${locale}/login?next=${encodeURIComponent(`/${locale}/onboarding?step=discord&next=${encodeURIComponent(next)}`)}`,
        );
        return;
      }
      if (linkState === 'linked') {
        router.replace(next);
        return;
      }
      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [locale, next, router]);

  function skip() {
    track({ name: 'Onboarding Discord Skipped', props: { after_not_in_guild: notInGuild } });
    setError(null);
    setNotInGuild(false);
    router.replace(withoutApplyIntent(next));
  }

  async function connect() {
    const user = getUser();
    if (!user) {
      clearSession();
      router.replace(
        `/${locale}/login?next=${encodeURIComponent(`/${locale}/onboarding?step=discord&next=${encodeURIComponent(next)}`)}`,
      );
      return;
    }
    // 팝업은 클릭과 같은 틱에 연다 — await 뒤에 열면 브라우저가 차단한다
    const code = requestDiscordCode();
    setLinking(true);
    setError(null);
    setNotInGuild(false);
    try {
      await linkDiscord(user.id, code, 'onboarding');
      // linkDiscord 가 캐시를 무효화하지만, 마이페이지로 가기 전에 한 번 더 맞춰 둔다 (DiscordRow 와 동일)
      await getQueryClient().invalidateQueries({ queryKey: profileKeys.account(user.id) });
      setLinking(false);
      // 팝업을 연 채 다른 페이지로 이동했으면 목적지로 끌어가지 않는다
      if (!onPage.current) return;
      router.replace(next);
    } catch (e) {
      setLinking(false);
      if (e instanceof DiscordPopupError && e.reason === 'cancelled') {
        setError(ko ? '디스코드 연결을 취소했어요. 다시 연결할 수 있어요.' : 'Discord connection was cancelled. You can try again.');
        return;
      }
      if (e instanceof DiscordPopupError && e.reason === 'blocked') {
        setError(
          ko
            ? '디스코드 창이 차단됐어요. 브라우저에서 팝업을 허용한 뒤 다시 시도해 주세요.'
            : 'The Discord window was blocked. Allow pop-ups in your browser and try again.',
        );
        return;
      }
      if (e instanceof ApiError && e.status === 401) {
        clearSession();
        router.replace(
          `/${locale}/login?next=${encodeURIComponent(`/${locale}/onboarding?step=discord&next=${encodeURIComponent(next)}`)}`,
        );
        return;
      }
      // 스펙: 온보딩 권유 화면의 길드 미가입은 신청 직전 창과 갈린다 — 가입 안내를 띄우고 건너뛸 수 있게 둔다
      if (errorCode(e) === 'DISCORD_NOT_IN_GUILD') {
        setNotInGuild(true);
        return;
      }
      if (e instanceof ApiError && e.status === 409) {
        setError(
          ko
            ? '이 디스코드 계정은 다른 StudyClub 계정에 이미 연결돼 있어요.'
            : 'This Discord account is already connected to another StudyClub account.',
        );
        return;
      }
      setError(
        ko
          ? '디스코드에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.'
          : 'Could not connect Discord. Please try again.',
      );
    }
  }

  if (!ready) {
    return (
      <div role='status' className='min-h-[72vh] p-8 text-center type-body-sm text-fg-muted'>
        {ko ? '가입 정보를 확인하고 있어요…' : 'Loading your profile…'}
      </div>
    );
  }

  return (
    <div className='min-h-[72vh] bg-surface-1 px-4 py-12 sm:px-6'>
      <section className='mx-auto max-w-lg rounded-card border border-border bg-bg p-6 shadow-xs sm:p-8'>
        <div>
          <p className='mb-5 flex items-center gap-2 type-label-lg text-success-700'>
            <CheckCircle2 size={20} aria-hidden='true' />
            {ko ? '홈페이지 가입이 완료됐어요' : 'Your sign-up is complete'}
          </p>
          <h1 className='type-headline-sm'>
            {ko ? '스터디는 디스코드에서 진행돼요. 지금 연결할까요?' : 'Studies happen on Discord. Connect now?'}
          </h1>
        </div>

        {!DISCORD_LINK_READY && (
          <p role='status' className='mt-5 type-body-sm text-fg-secondary'>
            {ko
              ? '디스코드 연결은 준비 중이에요. 스터디를 신청할 때 다시 안내할게요.'
              : 'Discord connection is coming soon. We will ask again when you apply for a study.'}
          </p>
        )}

        {notInGuild && (
          <div role='alert' className='mt-5 flex flex-col gap-2 rounded-control bg-surface-2 p-3'>
            <p className='type-body-sm text-fg'>
              {ko
                ? '스터디클럽 디스코드 서버에 아직 가입하지 않았어요. 서버에 가입한 뒤 다시 연결하거나, 스터디 신청할 때 할 수 있어요.'
                : 'You have not joined the StudyClub Discord server yet. Join the server and try again, or connect when you apply.'}
            </p>
            <a
              href={site.discord_invite}
              target='_blank'
              rel='noreferrer'
              className='inline-flex items-center gap-1 self-start type-label-lg text-brand hover:underline'
            >
              {ko ? '디스코드 서버 들어가기' : 'Join the Discord server'}
              <ExternalLink size={14} aria-hidden />
            </a>
          </div>
        )}

        {error && (
          <p role='alert' className='mt-5 type-body-sm text-error-700'>
            {error}
          </p>
        )}

        <div className='mt-7 flex flex-col gap-3'>
          {DISCORD_LINK_READY ? (
            <Button
              size='lg'
              loading={linking}
              leadingIcon={<MessageCircle size={18} />}
              onClick={connect}
            >
              {ko ? '지금 연결' : 'Connect now'}
            </Button>
          ) : null}
          <Button size='lg' variant='secondary' disabled={linking} onClick={skip}>
            {ko ? '스터디 신청할 때 하기' : 'When I apply for a study'}
          </Button>
        </div>
      </section>
    </div>
  );
}
