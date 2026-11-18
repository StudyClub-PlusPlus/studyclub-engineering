'use client';

import { Select, cx } from '@studyclub/ui';

/**
 * 거르는 칸 하나 (POL-0008). 고르기 전에는 축 이름만 보이고, 하나 고르면 첫 줄이 「전체」로 바뀌어 되돌아갈 길이 생긴다.
 * 「유형 전체」처럼 적으면 이미 거른 것처럼 읽힌다. 거른 축은 브랜드 테두리 · 굵은 글씨로 드러낸다(스터디 목록과 같다).
 */
export function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  /** `ALL` 이면 거르지 않는다. */
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (next: string) => void;
}) {
  const all = value === 'ALL';
  return (
    <Select
      size='sm'
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cx('w-auto shrink-0', all ? 'border-border-strong text-fg-secondary' : 'border-brand font-semibold text-fg')}
    >
      <option value='ALL'>{all ? label : '전체'}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </Select>
  );
}
