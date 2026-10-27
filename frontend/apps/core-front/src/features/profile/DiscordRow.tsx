'use client';

import Link from 'next/link';
import { useState } from 'react';

import { site } from '@studyclub/mock';
import { Button, toast } from '@studyclub/ui';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';

import { fetchAccount, profileKeys } from '@/features/profile/queries';
import { track } from '@/lib/analytics';
import type { Locale } from '@/lib/content';
import { DISCORD_LINK_READY, DiscordPopupError, linkDiscord, requestDiscordCode, unlinkDiscord } from '@/lib/discord';
import { ApiError } from '@/lib/http';
import { getQueryClient } from '@/lib/query-client';

/** 줄 아래에 띄우는 안내. blocked·notInGuild 는 다음 행동(링크)이 붙어 따로 그린다 */
type Notice = { kind: 'error'; text: string } | { kind: 'blocked' } | { kind: 'notInGuild' };

function errorCode(e: unknown) {
  return e instanceof ApiError ? (e.body as { errorCode?: string } | undefined)?.errorCode : undefined;
}

function linkFailure(e: unknown): Notice {
  if (e instanceof DiscordPopupError) {
    return {
      kind: 'error',
      text:
        e.reason === 'blocked'
          ? '디스코드 창이 차단됐어요. 브라우저에서 팝업을 허용한 뒤 다시 시도해 주세요.'
          : '디스코드 연결을 취소했어요. 다시 연결할 수 있어요.',
    };
  }
  if (errorCode(e) === 'DISCORD_NOT_IN_GUILD') return { kind: 'notInGuild' };
  // 참여 중에 다른 디스코드 계정으로 갈아타려 함 (POL-0007) — 해제가 막힐 때와 같은 안내
  if (errorCode(e) === 'DISCORD_UNLINK_BLOCKED') return { kind: 'blocked' };
  if (e instanceof ApiError && e.status === 409) {
    return { kind: 'error', text: '이 디스코드 계정은 다른 StudyClub 계정에 이미 연결돼 있어요.' };
  }
  return { kind: 'error', text: '디스코드에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.' };
}

function unlinkFailure(e: unknown): Notice {
  if (errorCode(e) === 'DISCORD_UNLINK_BLOCKED') return { kind: 'blocked' };
  return { kind: 'error', text: '연결을 해제하지 못했어요. 잠시 후 다시 시도해 주세요.' };
}

/**
 * 내 정보 카드의 디스코드 줄 (crew-edit-profile §4). 연결됐으면 계정 이름과 연결 해제, 아니면 연결 안 됨과 연결하기.
 * 진본은 GET /api/me 의 discordLinked · discordHandle 이다 — 신청 버튼과 같은 계정 캐시를 쓴다.
 * 참여 중 해제 거절은 서버가 판정하고(409), 화면은 그때 할 일(4-1)만 보여 준다.
 */
export function DiscordRow({
  accountId,
  locale,
  preview,
  onExpired,
}: {
  accountId: number;
  locale: Locale;
  /** 미리보기 세션은 서버가 모르는 계정이라 부르지 않는다 */
  preview: boolean;
  onExpired: () => void;
}) {
  const account = useQuery({ queryKey: profileKeys.account(accountId), queryFn: fetchAccount, enabled: !preview });
  const [busy, setBusy] = useState<'link' | 'unlink' | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  const linked = account.data?.discordLinked === true;
  const handle = account.data?.discordHandle;

  async function connect() {
    // 팝업은 클릭과 같은 틱에 연다 — await 뒤에 열면 브라우저가 차단한다
    const code = requestDiscordCode();
    setBusy('link');
    setNotice(null);
    try {
      await linkDiscord(accountId, await code);
      // 연결 응답은 204 라 계정 이름이 없다 — 다시 받아 @이름을 보여 준다
      await getQueryClient().invalidateQueries({ queryKey: profileKeys.account(accountId) });
      track({ name: 'My Discord Connected' });
      toast.success('디스코드를 연결했어요');
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) onExpired();
      else setNotice(linkFailure(e));
    } finally {
      setBusy(null);
    }
  }

  async function disconnect() {
    setBusy('unlink');
    setNotice(null);
    try {
      await unlinkDiscord(accountId);
      toast.success('디스코드 연결을 해제했어요');
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) onExpired();
      else setNotice(unlinkFailure(e));
    } finally {
      setBusy(null);
    }
  }

  let status = <span className='font-semibold text-fg-muted'>연결 안 됨</span>;
  let action = null;
  if (!preview && account.isPending) {
    status = <span className='text-fg-muted'>확인 중</span>;
  } else if (!preview && account.isError) {
    status = <span className='text-fg-muted'>연결 상태를 불러오지 못했어요</span>;
  } else if (linked) {
    status = <span className='truncate font-semibold text-fg'>{handle ? `@${handle}` : '연결됨'}</span>;
    action = (
      <Button size='sm' variant='ghost' onClick={disconnect} loading={busy === 'unlink'} disabled={busy !== null}>
        연결 해제
      </Button>
    );
  } else if (!preview && DISCORD_LINK_READY) {
    action = (
      <Button size='sm' variant='secondary' onClick={connect} loading={busy === 'link'} disabled={busy !== null}>
        연결하기
      </Button>
    );
  } else if (!preview) {
    action = <span className='text-xs text-fg-muted'>디스코드 연결은 준비 중이에요</span>;
  }

  return (
    <>
      <dt className='text-fg-muted'>디스코드</dt>
      <dd className='min-w-0'>
        <div className='flex flex-wrap items-center gap-x-3 gap-y-1'>
          {status}
          {action}
        </div>
        {notice?.kind === 'error' && (
          <p role='alert' className='mt-1 text-xs text-error-700'>
            {notice.text}
          </p>
        )}
        {notice?.kind === 'notInGuild' && (
          <div role='alert' className='mt-2 flex flex-col gap-1.5 rounded-control bg-surface-2 p-3 text-xs'>
            <p className='leading-relaxed text-fg'>스터디클럽 디스코드 서버에 먼저 들어온 뒤 다시 연결해 주세요.</p>
            <a
              href={site.discord_invite}
              target='_blank'
              rel='noreferrer'
              className='inline-flex items-center gap-1 self-start font-semibold text-brand hover:underline'
            >
              디스코드 서버 들어가기
              <ExternalLink size={12} aria-hidden />
            </a>
          </div>
        )}
        {/* 4-1: 「해제할 수 없어요」는 적지 않는다. 그대로인 화면이 이미 말한다. 남길 말은 그래서 무엇을 해야 하는가 */}
        {notice?.kind === 'blocked' && (
          <div className='mt-2 rounded-control bg-error-50 p-3 text-xs'>
            <p role='alert' className='leading-relaxed text-error-700'>
              참여 중인 모든 스터디의 참여를 중단한 뒤 다시 시도해 주세요.
              <br />
              참여 중단은 캡틴에게 문의해 주세요.
            </p>
            <Link
              href={`/${locale}/my/joined`}
              className='mt-1.5 inline-flex min-h-8 items-center font-semibold text-fg underline underline-offset-4'
            >
              내 스터디 확인하기
            </Link>
          </div>
        )}
      </dd>
    </>
  );
}
