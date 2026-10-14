/**
 * 인기 표시 뱃지. 컬러 배너 위에서도 읽히도록 흰 알약 + 붉은 글씨.
 */
export function HotBadge() {
  return (
    <span className='rounded-pill bg-white/95 px-2 py-1 text-[10px] font-extrabold uppercase tracking-[0.1em] text-error-600 shadow-sm'>
      HOT
    </span>
  );
}
