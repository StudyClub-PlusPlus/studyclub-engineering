import { CATEGORY_DISPLAY } from '@studyclub/utils';

import type { ApiStudyBoardItem, CrewTimeZoneGroupCode } from '@/features/dashboard/types';

// 대시보드 표시 형식 — 서버가 준 수·시각을 글자로 바꾸는 곳은 여기 하나다.
// 값을 다시 세거나 판정하지 않는다. 하는 일은 반올림과 「그 시간대의 달력 날짜」 계산뿐이다 (spec 2.4).

const DAY = 86_400_000;

/** 서버가 준 시간대를 브라우저(Intl)가 모르면 UTC 로 그린다 — 화면 전체가 깨지는 것보다 낫다. */
function safeZone(timeZone: string): string {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return timeZone;
  } catch {
    return 'UTC';
  }
}

/** 인원·기수 수 — 정수, 천 단위 구분. */
export function formatCount(n: number): string {
  return n.toLocaleString('ko-KR');
}

/** 출석률 — 서버가 이미 백분율로 준다(0~100). 다시 100을 곱하지 않고 정수로만 반올림한다. */
export function formatRate(rate: number): string {
  return `${Math.round(rate)}%`;
}

/** 1인당 참여 스터디 — 소수 한 자리. */
export function formatPerCrew(value: number): string {
  return `${(Math.round(value * 10) / 10).toFixed(1)}개`;
}

export type DeltaTone = 'up' | 'down' | 'flat';

/**
 * 전주 대비 %p — 필요할 때만 소수 한 자리. 반올림해서 0 이면 중립으로 `–0%p`.
 * 출석률은 내림이 나쁜 변화다(PRD 2-2-1) — 색은 그리는 쪽이 tone 으로 고른다.
 */
export function formatDelta(pp: number): { text: string; tone: DeltaTone } {
  // 0.5 는 0 에서 먼 쪽으로 — 오름과 내림이 같은 크기로 보이게 (Math.round 는 -6.75 를 -6.7 로 올린다)
  const rounded = (Math.sign(pp) * Math.round(Math.abs(pp) * 10)) / 10;
  if (rounded === 0) return { text: '–0%p', tone: 'flat' };
  const abs = Math.abs(rounded);
  return {
    text: `${rounded > 0 ? '▲' : '▼'}${Number.isInteger(abs) ? abs : abs.toFixed(1)}%p`,
    tone: rounded > 0 ? 'up' : 'down',
  };
}

/** 그 시간대의 달력 날짜 `YYYY-MM-DD`. */
export function localDate(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: safeZone(timeZone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

/** 두 달력 날짜(`YYYY-MM-DD`) 사이 일수. 시각이 아니라 날짜 차이다(spec 3-2 의 D-n). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY);
}

/** 그 날짜의 시간대 약칭(서머타임 반영 — EDT·EST). 한국은 KST — Intl 은 `GMT+9` 로만 준다. */
export function zoneAbbr(iso: string, timeZone: string): string {
  const zone = safeZone(timeZone);
  if (zone === 'Asia/Seoul') return 'KST';
  const part = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'short' })
    .formatToParts(new Date(iso))
    .find((p) => p.type === 'timeZoneName');
  return part?.value ?? zone;
}

/** 1-1 갱신 시각 — `YYYY-MM-DD HH:mm KST`. 24시간제(POL-0006). 「N분 전」 꼴은 쓰지 않는다. */
export function formatAsOf(asOf: string, timeZone: string): string {
  const zone = safeZone(timeZone);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date(asOf))
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute} ${zoneAbbr(asOf, zone)}`;
}

export type DeadlineTone = 'muted' | 'normal' | 'closed';

/**
 * 3-2 모집중 행의 마감 칸. **문구는 서버가 고른 `deadlineBadge` 로 정한다** — 날짜로 다시 판정하지 않는다.
 *
 * 기획(PRD 3-2)을 따라 「임박」·「오늘 마감」은 쓰지 않는다. 남은 날은 `D-N`(마감 당일은 D-0)으로 적고,
 * 이미 닫힌 것(마감 경과·정원 마감)만 따로 구분한다. 서버는 72시간 임박(`CLOSING_SOON`)을 주지만 여기서는 보통 행과 같다.
 * 날짜·D-N 은 응답의 timeZone 으로 센다 — 마감 날짜와 asOf 날짜의 달력 차이다.
 */
export function deadlineLabel(
  item: Pick<ApiStudyBoardItem, 'recruitDeadlineAt' | 'deadlineBadge'>,
  asOf: string,
  timeZone: string,
): { text: string; tone: DeadlineTone } {
  const date = item.recruitDeadlineAt ? localDate(item.recruitDeadlineAt, timeZone) : null;
  const shown = date ? `~${date.slice(5)}` : null;
  switch (item.deadlineBadge) {
    case 'DEADLINE_PASSED':
      return { text: shown ? `${shown} (마감 경과)` : '마감 경과', tone: 'closed' };
    case 'CAPACITY_FULL':
      return { text: shown ? `${shown} (정원 마감)` : '정원 마감', tone: 'closed' };
    case 'DEADLINE_MISSING':
      return { text: '마감일 미등록', tone: 'muted' };
    case 'CLOSING_SOON':
    case 'NORMAL':
      if (shown && date) {
        return { text: `${shown} (D-${Math.max(0, daysBetween(localDate(asOf, timeZone), date))})`, tone: 'normal' };
      }
      return { text: '마감일 미등록', tone: 'muted' };
    default:
      // 모르는 코드(서버가 먼저 배포됨) — 날짜만 적는다
      return { text: shown ?? '', tone: 'muted' };
  }
}

/** 카테고리 코드 → 화면 이름. 목록으로 넘길 때는 이름이 아니라 코드를 쓴다(PRD 6). */
export function categoryLabel(code: string): string {
  return CATEGORY_DISPLAY[code] ?? code;
}

/**
 * 4 크루 지역 분포 — 그룹 코드별 이름. 시간대가 곧 거주 지역이다(POL-0006).
 * 시간대는 계절을 타지 않는 이름으로 적는다 — 북미는 PST/PDT 가 아니라 PT (PRD 4).
 */
export const TIME_ZONE_GROUP_LABEL: Record<CrewTimeZoneGroupCode, { region: string; zone?: string }> = {
  KST: { region: '한국', zone: 'KST' },
  ET: { region: '북미 동부', zone: 'ET' },
  PT: { region: '북미 서부', zone: 'PT' },
  UNKNOWN: { region: '미분류' },
};
