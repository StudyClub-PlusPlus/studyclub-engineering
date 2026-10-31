import { toISODate } from './study';

/**
 * 스터디 날짜는 서울 날짜로 읽는다.
 *
 * 백오피스는 날짜 입력을 서울 시각으로 저장한다 — 시작일은 `00:00+09:00`, 모집 마감일은 `23:59:59+09:00`
 * (`back-office-front/src/components/StudyForm.tsx`). 응답 값의 앞 10글자(UTC 날짜)를 자르면 시작일은 하루
 * 앞당겨지고, 「오늘」을 UTC 로 잡으면 서울 0~9시에는 D-N 이 하루 어긋난다.
 */
const SEOUL = 'Asia/Seoul';

const seoulFormat = new Intl.DateTimeFormat('en-CA', { timeZone: SEOUL });

/** 시각 값(`2026-10-14T15:00:00Z`)이면 서울 날짜로, 날짜만 있으면(`2026-10-15`) 그대로 `yyyy-mm-dd`. */
export function seoulDate(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  if (!/T\d{2}:\d{2}/.test(raw)) return toISODate(raw);
  const at = new Date(raw);
  if (Number.isNaN(at.getTime())) return toISODate(raw);
  return seoulFormat.format(at);
}

/** 오늘 — 서울 날짜. */
export function seoulToday(now: Date = new Date()): string {
  return seoulFormat.format(now);
}
