import { cx } from './cx';

/** design-system.md §9-8 Avatar — 24/32/40, 이니셜 fallback, 역할 링. */
export type AvatarSize = 24 | 32 | 40;

const SIZE: Record<AvatarSize, string> = {
  24: 'h-6 w-6 text-[10px]',
  32: 'h-8 w-8 text-xs',
  40: 'h-10 w-10 text-sm',
};

export interface AvatarProps {
  name: string;
  src?: string;
  size?: AvatarSize;
  /** 캡틴은 brand 링으로 구분 (§9-8). */
  role?: 'captain' | 'navigator' | 'member';
  className?: string;
}

/** 한글은 첫 글자, 라틴은 최대 2단어 이니셜. */
function initials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  if (/[가-힣]/.test(trimmed)) return trimmed.slice(0, 1);
  return trimmed
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

export function Avatar({ name, src, size = 32, role, className }: AvatarProps) {
  const ring =
    role === 'captain'
      ? 'ring-2 ring-primary-600 ring-offset-1 ring-offset-bg'
      : role === 'navigator'
        ? 'ring-2 ring-info-500 ring-offset-1 ring-offset-bg'
        : '';
  const base = cx(
    'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full',
    SIZE[size],
    ring,
    className,
  );

  if (src) {
    return <img src={src} alt={name} className={cx(base, 'object-cover')} />;
  }
  return (
    <span className={cx(base, 'bg-primary-100 font-semibold text-primary-700')} aria-label={name}>
      {initials(name)}
    </span>
  );
}
