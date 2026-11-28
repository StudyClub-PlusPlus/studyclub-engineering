import { events as eventsData } from '@studyclub/mock';
import { type StudyclubEvent } from '@studyclub/types';

import { FEATURES } from '@/lib/features';

// TODO(api): GET /api/events — 행사 API 가 생기면 연동. 그전까지는 mock 데이터.
export async function getEvents(): Promise<StudyclubEvent[]> {
  // 기능 플래그가 꺼져 있으면 홈 「다가오는 행사」 등 어디에도 mock 행사가 새지 않게 여기서 막는다
  if (!FEATURES.EVENTS) return [];
  return [...eventsData].sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || a.id.localeCompare(b.id));
}

export async function getEvent(id: string): Promise<StudyclubEvent | null> {
  return (await getEvents()).find((e) => e.id === id) ?? null;
}
