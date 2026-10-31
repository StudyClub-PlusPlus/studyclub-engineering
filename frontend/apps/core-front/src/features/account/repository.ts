import { z } from 'zod';

const navigatorStudiesSchema = z.object({ items: z.array(z.object({ studyId: z.number(), title: z.string(), relation: z.enum(['UPCOMING','ONGOING','COMPLETED','WITHDRAWN']), participantRole: z.enum(['MEMBER','LEADER']).nullable() })) });
import { API_BASE } from '@/lib/http';

/**
 * 회원 탈퇴 화면의 "맡은 스터디 경고"에 쓰는 목록. 다른 `/my` 기능과 달리 이건 로컬에 흉내낼 수
 * 없다 — "지금 이 사람이 진행 중인 스터디의 네비게이터인가"는 서버(STUDY_PARTICIPANT · 회차 일정)
 * 만 판정할 수 있다. GET /api/me/studies 를 실제로 호출한다(specs/my-studies/spec.md).
 */
export type ActiveNavigatorStudy = { studyId: number; title: string };

/**
 * `getActiveNavigatorStudies` 의 결과 — "확인했더니 없음"과 "확인 자체를 못함"을 구별한다.
 * 단순히 빈 배열을 돌려주면 이 둘이 똑같아 보여서, 조회가 실패했는데도 "맡은 스터디 없음"으로
 * 오인해 경고 없이 탈퇴가 진행될 수 있다(PR 리뷰 지적).
 */
export type NavigatorStudiesResult = { status: 'ok'; studies: ActiveNavigatorStudy[] } | { status: 'unknown' };

/**
 * "맡은 진행 중인 스터디" = 네비게이터(LEADER)이고 relation 이 ONGOING(회차가 시작돼
 * 실제로 도는 중)인 것. 이 사람이 빠지면 자리가 비는 경우만 경고한다 — UPCOMING(시작 전)은 빠져도
 * 멈출 게 없고, COMPLETED·WITHDRAWN 은 이미 끝났다(specs/user-leave/spec.md "네비게이터 경고").
 *
 * 403 ONBOARDING_REQUIRED 만 "맡은 스터디 없음"(`status: 'ok', studies: []`)과 동일하게 처리한다 —
 * 온보딩 미완료 계정은 애초에 참여 자체가 불가능해 맡은 스터디가 있을 수 없으므로 안전하다(스펙의
 * `@RequireOnboarding` 과의 관계 절 참고). 그 외 오류(네트워크 오류, 401, 5xx 등)는 `'unknown'` —
 * "없다"고 확정할 근거가 없으므로 호출부가 별도로 경고해야 한다.
 */
export async function getActiveNavigatorStudies(): Promise<NavigatorStudiesResult> {
  try {
    // 백엔드를 직접 호출한다 — access 쿠키가 httpOnly 라도 credentials: 'include' 로 자동으로
    // 실리므로 중계 라우트가 필요 없다 (lib/http.ts 와 같은 이유).
    const res = await fetch(`${API_BASE}/api/me/studies`, { credentials: 'include', cache: 'no-store' });
    if (res.status === 403) return { status: 'ok', studies: [] };
    if (!res.ok) return { status: 'unknown' };
    const { items } = navigatorStudiesSchema.parse(await res.json());
    const studies = items
      .filter((s) => s.relation === 'ONGOING' && s.participantRole === 'LEADER')
      .map((s) => ({ studyId: s.studyId, title: s.title }));
    return { status: 'ok', studies };
  } catch {
    return { status: 'unknown' };
  }
}
