// 서버 전용 조회: 컨테이너 내부 API 주소와 ISR 캐시를 사용한다.
import type { Study } from '@studyclub/types';

import { studyQuery, toStudy, toStudyFromDetail } from './model';
import { apiStudyPageSchema, apiStudyDetailSchema } from './response-schema';
import type { StudySearch } from './types';

const API_BASE = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

/** GET /api/studies — 서버 전용. 실패하면 던진다 — 호출자가 빈 상태나 에러 응답을 고른다. */
export async function fetchStudies(search: StudySearch = {}): Promise<Study[]> {
  const res = await fetch(`${API_BASE}/api/studies?${studyQuery(search)}`, {
    next: { revalidate: 60 }, // ISR: 60초마다 갱신
  });
  if (!res.ok) throw new Error(`GET /api/studies failed: ${res.status}`);

  const page = apiStudyPageSchema.parse(await res.json());
  return page.items.map(toStudy);
}

/** GET /api/studies/{studyId} — 서버 전용. 실패하면 던진다. */
export async function fetchStudy(studyId: number): Promise<Study> {
  const res = await fetch(`${API_BASE}/api/studies/${studyId}`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error(`GET /api/studies/${studyId} failed: ${res.status}`);
  const detail = apiStudyDetailSchema.parse(await res.json());
  return toStudyFromDetail(detail);
}
