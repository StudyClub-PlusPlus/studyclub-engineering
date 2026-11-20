import { events as eventsData } from '@studyclub/mock';
import { type StudyclubEvent } from '@studyclub/types';

// TODO(api): GET /api/events — 행사 API 가 생기면 연동. 그전까지는 mock 데이터.
export async function getEvents(): Promise<StudyclubEvent[]> {
  return [...eventsData].sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || a.id.localeCompare(b.id));
}

export async function getEvent(id: string): Promise<StudyclubEvent | null> {
  return (await getEvents()).find((e) => e.id === id) ?? null;
}
