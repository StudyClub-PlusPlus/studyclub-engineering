'use client';

import { Input } from '@studyclub/ui';

import { DISCORD_NICKNAME_MAX } from '@/lib/apply-validation';
import { DISCORD_NICKNAME_EXAMPLE } from '@/lib/me';

export const DISCORD_NICKNAME_LABEL = '[스터디 클럽++] 디스코드 서버 별명';

export function DiscordNicknameField({
  value,
  disabled,
  invalid,
  onChange,
}: {
  value?: string;
  disabled?: boolean;
  invalid?: boolean;
  onChange?: (value: string) => void;
}) {
  const current = value ?? '';
  return (
    <Input
      label={DISCORD_NICKNAME_LABEL}
      required
      disabled={disabled}
      aria-invalid={invalid ? 'true' : undefined}
      value={current}
      maxLength={DISCORD_NICKNAME_MAX}
      labelHint={`${current.length}/${DISCORD_NICKNAME_MAX}`}
      onChange={disabled ? undefined : (ev) => onChange?.(ev.target.value)}
      placeholder={DISCORD_NICKNAME_EXAMPLE}
    />
  );
}
