'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';

import { site } from '@studyclub/mock';
import { Button, Modal } from '@studyclub/ui';
import { ExternalLink, MessageCircle } from 'lucide-react';

import { clearSession, getUser } from '@/lib/auth';
import type { Locale } from '@/lib/content';
import { DISCORD_LINK_READY, linkDiscord } from '@/lib/discord';
import { ApiError } from '@/lib/http';
import { t } from '@/lib/i18n';

/**
 * 디스코드 OAuth 인가 코드 자리. 연동 API(DSC-01, #298)는 있지만 화면에 OAuth 팝업이 아직 없다(DSC-04) —
 * DISCORD_LINK_READY 가 켜진 개발 서버에서만 보내고, MSW 목은 코드를 보지 않는다.
 * 팝업이 붙으면 거기서 받은 코드로 바꾼다.
 */
const PENDING_OAUTH_CODE = 'pending-oauth';

function isNotInGuild(e: unknown) {
  return e instanceof ApiError && e.status === 403 && (e.body as { errorCode?: string } | undefined)?.errorCode === 'DISCORD_NOT_IN_GUILD';
}

/**
 * POST /api/me/discord/link 실패 문구. 401 은 로그인으로 보내고, 403 길드 미가입은 가입 안내(notInGuild)로 따로 보인다.
 * 503(토큰 교환 실패·서버 설정 없음) 등은 기본 문구.
 */
function linkErrorCopy(e: unknown) {
  if (e instanceof ApiError && e.status === 409) {
    return {
      ko: '이 디스코드 계정은 다른 StudyClub 계정에 이미 연동되어 있습니다.',
      en: 'This Discord account is already connected to another StudyClub account.',
    };
  }
  return {
    ko: '디스코드 연동을 완료하지 못했습니다. 다시 시도해 주세요.',
    en: 'Failed to connect Discord. Please try again.',
  };
}

/**
 * 신청 전 디스코드 연동 창. 서버가 연동을 저장해야(204) 신청 폼으로 넘어간다.
 * 연동 API(DSC-01)가 없는 환경에서는 요청을 보내지 않고 준비 중이라고 알린다.
 */
export function ApplyDiscordGate({
  locale,
  open,
  onClose,
  onLinked,
}: {
  locale: Locale;
  open: boolean;
  onClose: () => void;
  onLinked: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** 403 DISCORD_NOT_IN_GUILD — 스터디클럽 디스코드 서버에 먼저 가입해야 한다 */
  const [notInGuild, setNotInGuild] = useState(false);

  /** 세션이 끝났다 — 창에 남겨 두지 않고 신청하기와 같이 로그인으로 보낸다 */
  function goLogin() {
    clearSession();
    setError(null);
    setNotInGuild(false);
    onClose();
    router.push(`/${locale}/login?next=${encodeURIComponent(pathname)}`);
  }

  async function connect() {
    const user = getUser();
    if (!user) return goLogin();
    setLinking(true);
    setError(null);
    setNotInGuild(false);
    try {
      await linkDiscord(user.id, PENDING_OAUTH_CODE);
      setLinking(false);
      onLinked();
    } catch (e) {
      setLinking(false);
      if (e instanceof ApiError && e.status === 401) return goLogin();
      if (isNotInGuild(e)) return setNotInGuild(true);
      setError(t(linkErrorCopy(e), locale));
    }
  }

  function handleClose() {
    setError(null);
    setNotInGuild(false);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={linking ? () => {} : handleClose}
      title={t({ ko: '디스코드 연동', en: 'Connect Discord' }, locale)}
      footer={
        DISCORD_LINK_READY ? (
          <>
            <Button variant='secondary' onClick={handleClose} disabled={linking}>
              {t({ ko: '취소', en: 'Cancel' }, locale)}
            </Button>
            <Button onClick={connect} loading={linking} leadingIcon={<MessageCircle size={16} />}>
              {t({ ko: '디스코드 연동하기', en: 'Connect Discord' }, locale)}
            </Button>
          </>
        ) : (
          <Button variant='secondary' onClick={handleClose}>
            {t({ ko: '닫기', en: 'Close' }, locale)}
          </Button>
        )
      }
    >
      <div className='flex flex-col gap-3 py-2'>
        <p className='text-sm font-medium text-fg'>
          {t({ ko: '스터디 신청 전 디스코드 연동은 필수입니다.', en: 'You must connect Discord before applying.' }, locale)}
        </p>
        <p className='text-sm leading-relaxed text-fg-secondary'>
          {t({ ko: '스터디는 디스코드에서 진행됩니다. 연동이 끝나면 신청 폼으로 이동합니다.', en: 'Studies run on Discord. After connecting, you continue to the application form.' }, locale)}
        </p>
        {!DISCORD_LINK_READY && (
          <p role='status' className='text-sm leading-relaxed text-fg-secondary'>
            {t({ ko: '디스코드 연동은 준비 중입니다. 운영진에게 문의해 주세요.', en: 'Discord connection is coming soon. Please contact the organizers.' }, locale)}
          </p>
        )}
        {notInGuild && (
          <div role='alert' className='flex flex-col gap-2 rounded-control bg-surface-2 p-3'>
            <p className='text-sm leading-relaxed text-fg'>
              {t({ ko: '스터디클럽 디스코드 서버에 아직 가입하지 않았습니다. 서버에 가입한 뒤 다시 연동해 주세요.', en: 'You have not joined the StudyClub Discord server yet. Join the server, then connect again.' }, locale)}
            </p>
            <a
              href={site.discord_invite}
              target='_blank'
              rel='noreferrer'
              className='inline-flex items-center gap-1 self-start text-sm font-semibold text-brand hover:underline'
            >
              {t({ ko: '디스코드 서버 가입하기', en: 'Join the Discord server' }, locale)}
              <ExternalLink size={14} aria-hidden />
            </a>
          </div>
        )}
        {error && (
          <p role='alert' className='text-xs text-error-700'>
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
