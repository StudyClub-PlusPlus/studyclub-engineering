'use client';

import { useState } from 'react';

import type { Locale } from '@core/lib/content';
import { t } from '@core/lib/i18n';
import { setDiscord } from '@core/lib/me';
import { Button, Modal } from '@studyclub/ui';
import { MessageCircle } from 'lucide-react';

/**
 * 스터디 신청 전 디스코드 연동 확인.
 *
 * 연동이 없으면 신청 폼을 열지 않는다. 프로토는 OAuth 대신 화면에서 바로 연결한다.
 *
 * TODO(api): POST /api/me/discord/link
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
  const [linking, setLinking] = useState(false);

  async function connect() {
    setLinking(true);
    await new Promise((r) => setTimeout(r, 400));
    setDiscord('jiwon_dev');
    setLinking(false);
    onLinked();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t({ ko: '디스코드 연동', en: 'Connect Discord' }, locale)}
      footer={
        <>
          <Button data-anno='discord:3' variant='secondary' onClick={onClose} disabled={linking}>
            {t({ ko: '취소', en: 'Cancel' }, locale)}
          </Button>
          <Button
            data-anno='discord:2'
            onClick={connect}
            loading={linking}
            leadingIcon={<MessageCircle size={16} />}
          >
            {t({ ko: '디스코드 연동하기', en: 'Connect Discord' }, locale)}
          </Button>
        </>
      }
    >
      <div data-anno='discord:1' className='flex flex-col gap-3 py-2'>
        <p className='text-sm font-medium text-fg'>
          {t(
            { ko: '스터디 신청 전 디스코드 연동은 필수입니다.', en: 'You must connect Discord before applying.' },
            locale,
          )}
        </p>
        <p className='text-sm leading-relaxed text-fg-secondary'>
          {t(
            {
              ko: '스터디는 디스코드에서 진행됩니다. 연동이 끝나면 신청 폼으로 이동합니다.',
              en: 'Studies run on Discord. After connecting, you continue to the application form.',
            },
            locale,
          )}
        </p>
      </div>
    </Modal>
  );
}
