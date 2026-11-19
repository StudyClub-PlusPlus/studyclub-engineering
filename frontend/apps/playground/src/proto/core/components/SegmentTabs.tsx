'use client';

import { Segmented } from '@studyclub/ui';

/** 알약 모양 구간 탭 — 내 스터디룸의 필터·KST/PDT, 스터디 관리 일정의 시간대가 같이 쓴다. 모양은 @studyclub/ui Segmented(pill). */
export function SegmentTabs<T extends string>({
  value,
  options,
  onChange,
  anno,
  label,
}: {
  value: T;
  options: { key: T; label: string }[];
  onChange: (key: T) => void;
  anno?: string;
  /** 탭 묶음의 이름 — 스크린리더가 무엇을 고르는 탭인지 읽는다. */
  label?: string;
}) {
  return (
    // data-anno 는 주석 모드가 짚는 자리 — Segmented 가 data 속성을 받지 않아 바깥에 단다
    <span data-anno={anno} className='inline-flex shrink-0'>
      <Segmented
        shape='pill'
        aria-label={label}
        value={value}
        options={options.map((o) => ({ value: o.key, label: o.label }))}
        onChange={onChange}
      />
    </span>
  );
}
