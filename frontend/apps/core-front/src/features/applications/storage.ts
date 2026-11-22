'use client';


import type { MemberRegion } from '@studyclub/types';
import { readJSON, writeJSON } from '@studyclub/utils';
import { z } from 'zod';

/** 서버 신청 응답을 즉시 표시하기 위한 브라우저 캐시. */
export const APPLICATION_KEY = 'sc_applications';

/**
 * 브라우저에 남긴 신청 기록의 상태 — 옛 프로토의 값이라 화면은 이 값으로 가르지 않는다.
 * 신청에는 승인 단계가 없다 — 신청하면 곧 참여다 (POL-0004).
 */
export type ApplicationStatus = 'pending' | 'accepted';

export type Application = {
  studyId: string;
  appliedAt: string; // yyyy-mm-dd
  status: ApplicationStatus;
  /** 신청 당시 거주 지역. 가능 시간을 어느 시간대로 적었는지 여기서 결정된다. */
  region: MemberRegion;
  /** 일정 미정 스터디에서 고른 "요일-시간대" 조합 (예: mon-evening) */
  cells?: string[];
  motivation?: string;
};

const applicationSchema = z.object({ studyId: z.string(), appliedAt: z.string(), status: z.enum(['pending', 'accepted']), region: z.enum(['KR', 'NA', 'ETC']), cells: z.array(z.string()).optional(), motivation: z.string().optional() });

export function getApplications(): Application[] {
  return readJSON(APPLICATION_KEY, z.array(applicationSchema), []);
}

export function getApplication(studyId: string): Application | undefined {
  return getApplications().find((a) => a.studyId === studyId);
}

export function addApplication(app: Application) {
  const rest = getApplications().filter((a) => a.studyId !== app.studyId);
  writeJSON(APPLICATION_KEY, [...rest, app]);
}
