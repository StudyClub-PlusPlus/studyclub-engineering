'use client';

import { Segmented } from '@studyclub/ui';

/** 알약 모양 구간 탭 — 참여 상태 필터, KST/PDT 전환 등에 쓴다. 모양은 @studyclub/ui Segmented(pill) 가 정한다. */
export function SegmentTabs<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { key: T; label: string }[];
  onChange: (key: T) => void;
  label?: string;
}) {
  return (
    <Segmented
      shape='pill'
      aria-label={label}
      value={value}
      options={options.map((o) => ({ value: o.key, label: o.label }))}
      onChange={onChange}
      className='shrink-0'
    />
  );
}
