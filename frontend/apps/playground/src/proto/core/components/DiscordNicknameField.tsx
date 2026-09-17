'use client';

import { DISCORD_NICKNAME_EXAMPLE } from '@core/lib/me';
import { Input } from '@studyclub/ui';

export const DISCORD_NICKNAME_LABEL = '[스터디 클럽++] 디스코드 서버 별명';

/**
 * 신청 폼의 디스코드 서버 별명.
 * 계정에 값이 있으면 그대로 보여주고, 없으면 필수 입력이다.
 */
export function DiscordNicknameField({
  stored,
  value,
  disabled,
  onChange,
}: {
  stored?: string;
  value?: string;
  disabled?: boolean;
  onChange?: (value: string) => void;
}) {
  const fromAccount = Boolean(stored);
  return (
    <Input
      label={DISCORD_NICKNAME_LABEL}
      required
      disabled={disabled || fromAccount}
      value={fromAccount ? stored : (value ?? '')}
      onChange={fromAccount ? undefined : (ev) => onChange?.(ev.target.value)}
      placeholder={DISCORD_NICKNAME_EXAMPLE}
    />
  );
}
