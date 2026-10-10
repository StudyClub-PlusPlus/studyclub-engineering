'use client';

/** 알약 모양 구간 탭 — 참여 상태 필터, KST/PDT 전환 등에 쓴다. */
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
    <div role='tablist' aria-label={label} className='inline-flex shrink-0 rounded-pill bg-surface-2 p-1'>
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
