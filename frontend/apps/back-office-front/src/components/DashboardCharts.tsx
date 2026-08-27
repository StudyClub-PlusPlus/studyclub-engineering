import { MEMBER_REGIONS, type MemberRegion } from '@studyclub/mock';

/**
 * 대시보드 차트.
 *
 * 차트 라이브러리를 넣지 않는다(레포 규칙: 외부 의존 임의 추가 금지). 여기서 필요한 것은
 * **비율 두 가지**뿐이라 SVG 도넛과 가로 막대로 충분하다.
 */

const REGION_COLOR: Record<MemberRegion, string> = {
  KR: 'var(--color-primary-600)',
  NA: 'var(--color-info-500)',
  ETC: 'var(--color-neutral-300)',
};

/** 출석률 색 — 80 이상 정상, 60 이상 주의, 그 아래 위험. 표의 출석률 색과 같은 기준. */
function rateColor(rate: number): string {
  if (rate >= 80) return 'var(--color-success-500)';
  if (rate >= 60) return 'var(--color-warning-500)';
  return 'var(--color-error-500)';
}

export function Card({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className='card px-6 py-5'>
      <div className='flex items-baseline justify-between gap-3'>
        <h2 className='text-[15px] font-bold'>{title}</h2>
        {action}
      </div>
      <div className='mt-4'>{children}</div>
    </section>
  );
}

/** 지역 분포 — 도넛. 조각이 셋뿐이라 범례에 수치를 같이 적는다. */
export function RegionDonut({ data }: { data: { key: MemberRegion; count: number }[] }) {
  const total = data.reduce((a, b) => a + b.count, 0) || 1;
  const R = 56;
  const C = 2 * Math.PI * R;
  let offset = 0;

  return (
    <div className='flex flex-wrap items-center gap-6'>
      <svg viewBox='0 0 140 140' className='h-[140px] w-[140px] shrink-0 -rotate-90'>
        <circle cx='70' cy='70' r={R} fill='none' stroke='var(--color-surface-2)' strokeWidth='20' />
        {data.map((d) => {
          const len = (d.count / total) * C;
          const el = (
            <circle
              key={d.key}
              cx='70'
              cy='70'
              r={R}
              fill='none'
              stroke={REGION_COLOR[d.key]}
              strokeWidth='20'
              strokeDasharray={`${len} ${C - len}`}
              strokeDashoffset={-offset}
            />
          );
          offset += len;
          return el;
        })}
      </svg>

      <ul className='flex min-w-0 flex-1 flex-col gap-2.5'>
        {data.map((d) => {
          const meta = MEMBER_REGIONS.find((r) => r.key === d.key);
          const pct = Math.round((d.count / total) * 100);
          return (
            <li key={d.key} className='flex items-center gap-2.5'>
              <span
                className='h-2.5 w-2.5 shrink-0 rounded-full'
                style={{ background: REGION_COLOR[d.key] }}
                aria-hidden='true'
              />
              <span className='min-w-0 flex-1 truncate text-sm font-medium text-fg'>
                {meta?.label.ko ?? d.key}
                <span className='ml-1.5 text-xs text-fg-muted'>{meta?.tzLabel}</span>
              </span>
              <span className='tnum shrink-0 text-sm font-bold text-fg'>{pct}%</span>
              <span className='tnum w-12 shrink-0 text-right text-xs text-fg-muted'>{d.count}명</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** 카테고리별 출석률 — 가로 막대. 세로 막대는 카테고리 이름이 겹쳐 읽히지 않는다. */
export function CategoryBars({ data }: { data: { category: string; rate: number; crew: number }[] }) {
  if (data.length === 0) {
    return <p className='py-6 text-center text-sm text-fg-muted'>집계할 출석 기록이 없습니다.</p>;
  }
  return (
    <ul className='flex flex-col gap-3'>
      {data.map((d) => (
        <li key={d.category} className='flex items-center gap-3'>
          <span className='w-24 shrink-0 truncate text-[13px] font-medium text-fg-secondary' title={d.category}>
            {d.category}
          </span>
          <span className='h-2.5 min-w-0 flex-1 overflow-hidden rounded-pill bg-surface-2'>
            <span
              className='block h-full rounded-pill'
              style={{ width: `${d.rate}%`, background: rateColor(d.rate) }}
            />
          </span>
          <span className='tnum w-10 shrink-0 text-right text-[13px] font-bold text-fg'>{d.rate}%</span>
          <span className='tnum w-14 shrink-0 text-right text-xs text-fg-muted'>{d.crew}명</span>
        </li>
      ))}
    </ul>
  );
}
