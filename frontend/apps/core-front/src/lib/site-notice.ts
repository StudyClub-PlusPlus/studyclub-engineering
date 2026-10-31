// 사이트 공지 화면이 쓰는 순수 계산 — 페이지 크기·게시일 표기. 데이터는 lib/api.ts 가 가져온다.
/** 한 페이지에 보이는 공지 수. 화면은 10 고정 (specs/site-notice/spec.md). */
export const NOTICE_PAGE_SIZE = 10;

/**
 * 게시일 표기 `YYYY-MM-DD`. 서버는 UTC 시각을 주고 날짜는 보는 사람의 시간대로 자른다 — 시간대 정책이 화면 표기를 그렇게 정했다.
 * 숫자 날짜라 언어와 무관하다.
 */
export function noticeDate(iso: string, timeZone: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  // en-CA 는 YYYY-MM-DD 로 찍는다(`ymdInTz` 와 같은 방식)
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}
