import type { Study } from '@studyclub/types';

import { fetchStudies, fetchStudy } from './repository';

/** 사용자 사이트용 스터디 목록. API 가 실패하면 빈 목록 — 예시 스터디로 메우지 않는다. */
export async function getStudies(): Promise<Study[]> {
  try {
    return await fetchStudies();
  } catch (e) {
    console.error('[content] GET /api/studies failed:', e);
    return [];
  }
}

/** 스터디 단건. API 가 실패하면 null — 메타데이터만 비고, 본문은 클라이언트가 404·500 을 그린다. */
export async function getStudy(studyId: number): Promise<Study | null> {
  try {
    return await fetchStudy(studyId);
  } catch (e) {
    console.error(`[content] GET /api/studies/${studyId} failed:`, e);
    return null;
  }
}
