import { z } from 'zod';

import { API_BASE } from '@/lib/http';

const leaveStudiesSchema = z.object({
  items: z.array(
    z.object({
      studyId: z.number(),
      title: z.string(),
      relation: z.enum(['UPCOMING', 'ONGOING', 'COMPLETED', 'WITHDRAWN']),
      participantRole: z.enum(['MEMBER', 'LEADER']).nullable(),
    }),
  ),
});

export type LeaveStudy = { studyId: number; title: string };

/**
 * 조회 실패를 빈 목록과 구분한다. 실패했을 때 경고 없이 탈퇴하는 일이 없도록 화면에서 재확인한다.
 */
export type LeaveStudiesResult =
  { status: 'ok'; crewStudies: LeaveStudy[]; navigatorStudies: LeaveStudy[] } | { status: 'unknown' };

/**
 * GET /api/me/studies의 본인 명부를 한 번 조회해 역할별로 나눈다.
 * ONGOING + MEMBER는 크루, ONGOING + LEADER는 네비게이터다. 시작 전·참여 종료는 제외한다.
 * 캡틴 여부나 계정의 전역 권한 대신 스터디별 participantRole로 판단한다.
 * 기존 탈퇴 화면과 동일하게 403(온보딩 미완료)은 빈 목록, 그 외 조회 실패는 unknown으로 처리한다.
 */
export async function getLeaveStudies(): Promise<LeaveStudiesResult> {
  try {
    const res = await fetch(`${API_BASE}/api/me/studies`, { credentials: 'include', cache: 'no-store' });
    if (res.status === 403) return { status: 'ok', crewStudies: [], navigatorStudies: [] };
    if (!res.ok) return { status: 'unknown' };
    const { items } = leaveStudiesSchema.parse(await res.json());
    const crewStudies: LeaveStudy[] = [];
    const navigatorStudies: LeaveStudy[] = [];
    for (const study of items) {
      if (study.relation !== 'ONGOING') continue;
      const summary = { studyId: study.studyId, title: study.title };
      if (study.participantRole === 'MEMBER') crewStudies.push(summary);
      if (study.participantRole === 'LEADER') navigatorStudies.push(summary);
    }
    return { status: 'ok', crewStudies, navigatorStudies };
  } catch {
    return { status: 'unknown' };
  }
}
