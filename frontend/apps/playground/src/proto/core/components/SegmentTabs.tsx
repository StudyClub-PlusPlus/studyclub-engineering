'use client';

/** 알약 모양 구간 탭 — 내 스터디의 필터·KST/PDT, 스터디 관리 일정의 시간대가 같이 쓴다. */
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
    <div
      role='tablist'
      aria-label={label}
      data-anno={anno}
      className='inline-flex shrink-0 rounded-pill bg-surface-2 p-1'
    >
      {options.map((o) => {
        const on = value === o.key;
        return (
          <button
            key={o.key}
            type='button'
            role='tab'
            aria-selected={on}
            onClick={() => onChange(o.key)}
            className={`whitespace-nowrap rounded-pill px-4 py-1.5 text-sm font-bold transition-colors ${
              on ? 'bg-bg text-fg shadow-sm' : 'text-fg-secondary hover:text-fg'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
