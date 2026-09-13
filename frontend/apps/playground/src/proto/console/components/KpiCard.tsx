import Link from 'next/link';

/**
 * KPI 카드.
 *
 * 넷 다 무채색이다. 하나를 강조 배경으로 칠하면 나머지 셋은 덜 중요한 수가 되는데, 이 넷은
 * 서로 견주는 값이지 우선순위가 있는 값이 아니다.
 *
 * **델타는 있을 때만 붙인다.** 지난주 수가 없는데 「–」 를 그려 두면 「변화 없음」으로 읽힌다.
 */
export function KpiCard({
  label,
  value,
  sub,
  delta,
  deltaUnit = '',
  /** 내려가는 것이 나쁜 값인가. 출석률은 하락이 빨강, 인원 수는 상승이 초록. */
  downIsBad = true,
  href,
  anno,
}: {
  label: string;
  value: string;
  sub: string;
  delta?: number;
  deltaUnit?: string;
  downIsBad?: boolean;
  href?: string;
  anno?: string;
}) {
  const body = (
    <div
      data-anno={anno}
      className='card h-full px-5 py-4 transition-[border-color,box-shadow] duration-fast ease-out group-hover:border-border-strong group-hover:shadow-sm'
    >
      <div className='text-[13px] font-medium text-fg-muted'>{label}</div>
      <div className='mt-1.5 flex items-baseline gap-2'>
        <span className='tnum text-2xl font-extrabold tracking-tight'>{value}</span>
        {delta !== undefined && (
          <span data-anno={anno ? `${anno}-1` : undefined}>
            <Delta value={delta} unit={deltaUnit} downIsBad={downIsBad} />
          </span>
        )}
      </div>
      <div className='mt-1 text-xs text-fg-muted'>{sub}</div>
    </div>
  );

  return href ? (
    <Link href={href} className='group'>
      {body}
    </Link>
  ) : (
    body
  );
}

function Delta({ value, unit, downIsBad }: { value: number; unit: string; downIsBad: boolean }) {
  if (value === 0) {
    return <span className='tnum text-xs font-semibold text-fg-muted'>–0{unit}</span>;
  }
  const good = downIsBad ? value > 0 : value < 0;
  return (
    <span className={`tnum text-xs font-bold ${good ? 'text-success-700' : 'text-error-700'}`}>
      {value > 0 ? '▲' : '▼'}
      {Math.abs(value)}
      {unit}
    </span>
  );
}
