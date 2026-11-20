// ponytail: 회차 응답에 길이가 없어 늘 1시간으로 넣는다. 회차 길이가 생기면 minutes 로 넘긴다
const DEFAULT_MINUTES = 60;

const utcStamp = (d: Date) =>
  d
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');

/** 구글 캘린더 「일정 만들기」 화면 주소. 로그인한 사람의 캘린더에 사람이 직접 저장한다. */
export function googleCalendarUrl({
  title,
  start,
  minutes = DEFAULT_MINUTES,
  details,
}: {
  title: string;
  start: Date;
  minutes?: number;
  details?: string | null;
}): string {
  const end = new Date(start.getTime() + minutes * 60_000);
  const params = new URLSearchParams({ action: 'TEMPLATE', text: title, dates: `${utcStamp(start)}/${utcStamp(end)}` });
  if (details) params.set('details', details);
  return `https://calendar.google.com/calendar/render?${params}`;
}
