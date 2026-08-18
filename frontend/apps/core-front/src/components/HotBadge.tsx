/**
 * 인기 표시. 컬러 배너 위에 얹히므로 **흰 알약에 붉은 글씨** — 어떤 카테고리 색 위에서도 읽힌다.
 * 판정은 `isHotStudy` 한 곳에서만 한다(기준이 바뀌어도 화면은 그대로).
 */
export function HotBadge() {
  return (
    <span className="rounded-pill bg-white/95 px-2 py-1 text-[10px] font-extrabold uppercase tracking-[0.1em] text-error-600 shadow-sm">
      HOT
    </span>
  );
}
