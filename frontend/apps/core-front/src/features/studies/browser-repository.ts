import { studyQuery, toStudy, toStudyFromDetail } from './model';
import { apiStudyPageSchema, apiStudyDetailSchema } from './response-schema';
import type { StudySearch } from './types';
import { http } from '@/lib/http';

export async function fetchBrowserStudies(search: StudySearch) {
  const page = await http(`/api/studies?${studyQuery(search)}`, apiStudyPageSchema);
  return page.items.map(toStudy);
}
export async function fetchBrowserStudy(studyId: number) {
  return toStudyFromDetail(await http(`/api/studies/${studyId}`, apiStudyDetailSchema));
}
