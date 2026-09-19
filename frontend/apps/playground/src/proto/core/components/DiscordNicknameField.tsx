'use client';

import { DISCORD_NICKNAME_MAX } from '@core/lib/apply-validation';
import { DISCORD_NICKNAME_EXAMPLE } from '@core/lib/me';
import { Input } from '@studyclub/ui';

export const DISCORD_NICKNAME_LABEL = '[스터디 클럽++] 디스코드 서버 별명';

/**
 * 신청 폼의 디스코드 서버 별명.
 * 계정에 값이 있으면 그 값으로 채우고, 지원자가 고칠 수 있다.
 * MAX 100 — ACCOUNT.DISCORD_NICKNAME VARCHAR(100)
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
  const current = value ?? stored ?? '';
  return (
    <Input
      label={DISCORD_NICKNAME_LABEL}
      required
      disabled={disabled}
      value={current}
      maxLength={DISCORD_NICKNAME_MAX}
      labelHint={`${current.length}/${DISCORD_NICKNAME_MAX}`}
      onChange={disabled ? undefined : (ev) => onChange?.(ev.target.value)}
      placeholder={DISCORD_NICKNAME_EXAMPLE}
    />
  );
}
