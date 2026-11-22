import { events as archiveEventsData } from '@studyclub/mock';

import { eventListSchema, type ApiEventListItem } from '@/features/events/response-schema';
import type { StudyclubEvent } from '@studyclub/types';

const API_BASE = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

/** 공개 행사 목록 — 서버 렌더용. 실패 시 빈 배열. */
export async function fetchEventListServer(): Promise<ApiEventListItem[]> {
  try {
    const res = await fetch(`${API_BASE}/api/events`, { next: { revalidate: 30 } });
    if (!res.ok) return [];
    return eventListSchema.parse(await res.json());
  } catch {
    return [];
  }
}

export async function fetchEventDetailServer(eventId: number) {
  try {
    const res = await fetch(`${API_BASE}/api/events/${eventId}`, { next: { revalidate: 15 } });
    if (!res.ok) return null;
    const { eventDetailSchema } = await import('@/features/events/response-schema');
    return eventDetailSchema.parse(await res.json());
  } catch {
    return null;
  }
}

/** 기존 콘텐츠 행사 기록 — API 가 아니다. */
export function getArchiveEvents(): StudyclubEvent[] {
  return [...archiveEventsData];
}

/** mock 행사 (랜딩 카드 등) — API 연결 전과 동일. */
export async function getEvents(): Promise<StudyclubEvent[]> {
  return getArchiveEvents();
}

export async function getEvent(id: string): Promise<StudyclubEvent | null> {
  return (await getEvents()).find((e) => e.id === id) ?? null;
}