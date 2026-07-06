// Event(이벤트 · 밋업/워크샵/토크) 도메인 모델.
import type { L10n } from "./common";

export type EventType = "meetup" | "workshop" | "talk" | "online";

export type StudyclubEvent = {
  id: string;
  title: L10n;
  summary: L10n;
  date: string; // ISO8601
  type: EventType;
  location?: L10n;
  link?: string;
  order?: number;
};

export const EVENT_TYPE_LABEL: Record<EventType, L10n> = {
  meetup: { ko: "밋업", en: "Meetup" },
  workshop: { ko: "워크샵", en: "Workshop" },
  talk: { ko: "토크", en: "Talk" },
  online: { ko: "온라인", en: "Online" },
};

/** 기준 시각(now) 이후면 예정 이벤트. */
export function isUpcoming(event: StudyclubEvent, now: Date = new Date()): boolean {
  return new Date(event.date).getTime() >= now.getTime();
}

/** 날짜 오름차순 정렬 비교자. */
export function byDate(a: StudyclubEvent, b: StudyclubEvent): number {
  return new Date(a.date).getTime() - new Date(b.date).getTime();
}
