'use client';

import { useState } from 'react';

import { Button, Modal } from '@studyclub/ui';
import { MessageCircle } from 'lucide-react';

import type { Locale } from '@/lib/content';
import { t } from '@/lib/i18n';
import { setDiscord } from '@/lib/me';

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
      // TODO(api): POST /api/me/discord/link
      await new Promise((r) => setTimeout(r, 400));
      setDiscord('jiwon_dev');
      setLinking(false);
      onLinked();
    } catch {
      setLinking(false);
      setError(
        t(
          {
            ko: '디스코드 연동을 완료하지 못했습니다. 다시 시도해 주세요.',
            en: 'Failed to connect Discord. Please try again.',
          },
          locale,
        ),
      );
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
