'use client';

import type { Locale } from '@studyclub/types';
import { Button, Input } from '@studyclub/ui';
import { RefreshCw } from 'lucide-react';

import { DISCORD_NICKNAME_EXAMPLE } from '@/features/profile/local-state';
import { t } from '@/lib/i18n';

export const DISCORD_NICKNAME_LABEL = '[스터디클럽] 디스코드 서버 별명';

/**
 * 신청 폼의 디스코드 서버 별명 칸. 직접 입력하지 않는다 — 연동할 때 서버가 디스코드에서 받아 둔 값을 보여 주고,
 * 디스코드에서 별명을 바꿨으면 「새로고침」 으로 다시 불러온다 (새로고침 = 디스코드 연동을 한 번 더).
 */
export function DiscordNicknameField({
  locale,
  value,
  invalid,
  refreshing,
  error,
  onRefresh,
}: {
  locale: Locale;
  value?: string;
  invalid?: boolean;
  refreshing?: boolean;
  /** 새로고침 실패 문구. 있으면 안내 대신 보인다 */
  error?: string | null;
  onRefresh: () => void;
}) {
  const current = value ?? '';
  return (
    <div className='flex flex-col gap-1.5'>
      <div className='flex items-end gap-2'>
        <div className='min-w-0 flex-1'>
          <Input
            label={DISCORD_NICKNAME_LABEL}
            required
            readOnly
            aria-invalid={invalid ? 'true' : undefined}
            value={current}
            placeholder={t({ ko: '새로고침을 눌러 불러와 주세요', en: 'Press Refresh to load it' }, locale)}
          />
        </div>
        <Button variant='secondary' onClick={onRefresh} loading={refreshing} leadingIcon={<RefreshCw size={16} />}>
          {t({ ko: '새로고침', en: 'Refresh' }, locale)}
        </Button>
      </div>
      {error ? (
        <p role='alert' className='type-label-sm text-error-700'>
          {error}
        </p>
      ) : (
        <p className='type-label-sm text-fg-secondary'>
          {t(
            {
              ko: `스터디클럽 디스코드 서버의 별명입니다. 바꾸려면 디스코드에서 별명을 고친 뒤 새로고침해 주세요. 예) ${DISCORD_NICKNAME_EXAMPLE}`,
              en: `Your nickname on the StudyClub Discord server. To change it, edit it in Discord and press Refresh. e.g. ${DISCORD_NICKNAME_EXAMPLE}`,
            },
            locale,
          )}
        </p>
      )}
    </div>
  );
}
