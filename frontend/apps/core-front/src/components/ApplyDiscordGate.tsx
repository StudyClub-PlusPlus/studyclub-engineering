'use client';

import { useState } from 'react';

import { Button, Modal } from '@studyclub/ui';
import { MessageCircle } from 'lucide-react';

import type { Locale } from '@/lib/content';
import { linkDiscord } from '@/lib/discord';
import { ApiError } from '@/lib/http';
import { t } from '@/lib/i18n';

/**
 * 디스코드 OAuth 인가 코드. 디스코드 앱 등록·백엔드(DSC-01) 전이라 아직 팝업을 열지 않는다 —
 * 개발 서버의 MSW 목은 코드를 보지 않는다. 백엔드가 붙으면 OAuth 팝업으로 받은 코드로 바꾼다.
 */
const PENDING_OAUTH_CODE = 'pending-oauth';

/** POST /api/me/discord/link 실패 문구. 502(토큰 교환 실패) 등은 기본 문구. */
function linkErrorCopy(e: unknown) {
  if (e instanceof ApiError && e.status === 409) {
    return {
      ko: '이 디스코드 계정은 다른 StudyClub 계정에 이미 연동되어 있습니다.',
      en: 'This Discord account is already connected to another StudyClub account.',
    };
  }
  if (e instanceof ApiError && e.status === 401) {
    return { ko: '로그인이 만료되었습니다. 다시 로그인해 주세요.', en: 'Your session has expired. Please log in again.' };
  }
  return {
    ko: '디스코드 연동을 완료하지 못했습니다. 다시 시도해 주세요.',
    en: 'Failed to connect Discord. Please try again.',
  };
}

/** 신청 전 디스코드 연동 창. 서버가 연동을 저장해야(204) 신청 폼으로 넘어간다. */
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
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function connect() {
    setLinking(true);
    setError(null);
    try {
      await linkDiscord(PENDING_OAUTH_CODE);
      setLinking(false);
      onLinked();
    } catch (e) {
      setLinking(false);
      setError(t(linkErrorCopy(e), locale));
    }
  }

  function handleClose() {
    setError(null);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={linking ? () => {} : handleClose}
      title={t({ ko: '디스코드 연동', en: 'Connect Discord' }, locale)}
      footer={
        <>
          <Button variant='secondary' onClick={handleClose} disabled={linking}>
            {t({ ko: '취소', en: 'Cancel' }, locale)}
          </Button>
          <Button onClick={connect} loading={linking} leadingIcon={<MessageCircle size={16} />}>
            {t({ ko: '디스코드 연동하기', en: 'Connect Discord' }, locale)}
          </Button>
        </>
      }
    >
      <div className='flex flex-col gap-3 py-2'>
        <p className='text-sm font-medium text-fg'>
          {t({ ko: '스터디 신청 전 디스코드 연동은 필수입니다.', en: 'You must connect Discord before applying.' }, locale)}
        </p>
        <p className='text-sm leading-relaxed text-fg-secondary'>
          {t({ ko: '스터디는 디스코드에서 진행됩니다. 연동이 끝나면 신청 폼으로 이동합니다.', en: 'Studies run on Discord. After connecting, you continue to the application form.' }, locale)}
        </p>
        {error && (
          <p role='alert' className='text-xs text-error-700'>
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
