'use client';

import type { MemberRegion } from '@studyclub/mock';

import { clearMyAttendance } from './attendance';
import { getUser } from './auth';
import { API_BASE } from './http';

/**
 * 로그인한 회원의 개인 데이터 — 관심 스터디·스터디 신청.
 *
 * 저장할 서버가 아직 없어 **브라우저에만** 남긴다(기기·브라우저가 바뀌면 사라진다).
 * 서버가 생기면 이 파일의 read/write 만 fetch 로 갈아끼우면 되고, 화면 코드는 그대로 둔다.
 *
 * TODO(api): GET/PUT /api/me/bookmarks · /api/me/applications
 *
 * `getActiveNavigatorStudies` 만 예외 — 회원 탈퇴 경고는 로컬로 흉내낼 수 없어 실제
 * GET /api/me/studies 를 호출한다. 맨 아래 참고.
 */

const BOOKMARK_KEY = 'sc_bookmarks';
const APPLICATION_KEY = 'sc_applications';

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 저장 실패(프라이빗 모드 등)해도 화면 동작은 막지 않는다
  }
}

/* ── 관심 스터디 ─────────────────────────────────────────────────────────────── */

export function getBookmarks(): string[] {
  return readJSON<string[]>(BOOKMARK_KEY, []);
}

export function setBookmarked(studyId: string, on: boolean) {
  const ids = getBookmarks().filter((x) => x !== studyId);
  writeJSON(BOOKMARK_KEY, on ? [...ids, studyId] : ids);
}

/* ── 스터디 신청 ─────────────────────────────────────────────────────────── */

/**
 * 신청 상태.
 * - pending  : 운영진 확인 대기
 * - accepted : 승인 — 참여 중
 * 승인은 운영자 콘솔에서 처리하므로, 서버가 붙기 전까지는 pending 만 생긴다.
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

export function getApplications(): Application[] {
  return readJSON<Application[]>(APPLICATION_KEY, []);
}

export function addApplication(app: Application) {
  const rest = getApplications().filter((a) => a.studyId !== app.studyId);
  writeJSON(APPLICATION_KEY, [...rest, app]);
}

export function cancelApplication(studyId: string) {
  writeJSON(
    APPLICATION_KEY,
    getApplications().filter((a) => a.studyId !== studyId),
  );
}

/* ── 거주 지역 ───────────────────────────────────────────────────────────── */

/**
 * 시간대에서 거주 지역을 정한다 — 서울이면 한국, 그 밖이면 북미.
 * 지역을 따로 저장하지 않는다. 값이 둘이면 시간대만 고친 회원의 지역이 옛 값으로 남는다.
 */
export function regionOfTimeZone(timeZone: string | null | undefined): MemberRegion {
  if (!timeZone || timeZone === 'Asia/Seoul') return 'KR';
  return 'NA';
}

/**
 * 회원 거주 지역. 신청 폼이 "가능한 시간"을 어느 시간대 기준으로 받을지 정하는 값이다.
 * 회원이 마이페이지에서 고친 시간대를 따라간다.
 */
export function getRegion(): MemberRegion {
  return regionOfTimeZone(getUser()?.timeZone);
}

/* ── 데모 데이터 ─────────────────────────────────────────────────────────── */

/**
 * 프로토타입 확인용 초기 데이터. 빈 화면만 보면 목록 레이아웃을 판단할 수 없어서,
 * 미리보기로 들어올 때 채운다. 버전이 같으면 다시 채우지 않으므로 직접 신청·취소한 결과는 남는다.
 */
const SEED_KEY = 'sc_demo_seed';
/** 더미 내용을 바꾸면 올린다 — 이미 한 번 열어본 브라우저에도 새 더미가 들어간다. */
const SEED_VERSION = 5;

export function seedDemoData() {
  if (readJSON<number>(SEED_KEY, 0) >= SEED_VERSION) return;
  writeJSON(SEED_KEY, SEED_VERSION);
  {
    writeJSON(APPLICATION_KEY, [
      {
        studyId: '11', // ddia-2nd
        appliedAt: '2026-07-28',
        status: 'accepted',
        region: 'KR',
      },
      {
        studyId: '1', // ai-paper-study
        appliedAt: '2026-08-11',
        status: 'accepted',
        region: 'KR',
      },
      // 끝난 스터디 — 참여 이력으로 내려간다
      {
        studyId: '19', // leetcode150-2026
        appliedAt: '2026-02-03',
        status: 'accepted',
        region: 'KR',
      },
      {
        studyId: '15', // sql-for-data-analysis
        appliedAt: '2025-11-12',
        status: 'accepted',
        region: 'KR',
      },
      {
        studyId: '2', // pytorch-ai-coding
        appliedAt: '2026-08-14',
        status: 'pending',
        region: 'KR',
        cells: ['mon-evening', 'wed-evening', 'sun-afternoon'],
        motivation: 'PyTorch로 직접 구현해보고 싶어 신청합니다.',
      },
    ] satisfies Application[]);
  }
  writeJSON(BOOKMARK_KEY, ['2', '7']); // pytorch-ai-coding, system-design-interview
}

/**
 * 회원 탈퇴 — 이 브라우저에 남은 회원별 데이터(관심·신청·출석)를 지운다.
 * 로그인 세션(sc_user)은 `logout()` 이 지운다. 데모 시드 키(SEED_KEY)는 일부러 남긴다 — 지우면 다음
 * 미리보기 진입 때 더미가 다시 채워져 탈퇴한 사람의 데이터처럼 보인다.
 */
export function clearMyLocalData() {
  if (typeof window === 'undefined') return;
  for (const key of [BOOKMARK_KEY, APPLICATION_KEY]) {
    try {
      localStorage.removeItem(key);
    } catch {
      // 저장소 접근 실패해도 탈퇴 흐름은 막지 않는다
    }
  }
  clearMyAttendance();
}

/* ── 맡은 진행 중인 스터디 (회원 탈퇴 경고) ──────────────────────────────────── */

/**
 * 회원 탈퇴 화면의 "맡은 스터디 경고"에 쓰는 목록. 다른 `/my` 기능과 달리 이건 로컬에 흉내낼 수
 * 없다 — "지금 이 사람이 진행 중인 스터디의 네비게이터인가"는 서버(STUDY_PARTICIPANT · 회차 일정)
 * 만 판정할 수 있다. GET /api/me/studies 를 실제로 호출한다(specs/my-studies/spec.md).
 */
export type ActiveNavigatorStudy = { studyId: number; title: string };

type MyStudyItem = {
  studyId: number;
  title: string;
  relation: 'UPCOMING' | 'ONGOING' | 'COMPLETED' | 'WITHDRAWN';
  participantRole: 'MEMBER' | 'LEADER' | 'CO_LEADER';
};

/**
 * `getActiveNavigatorStudies` 의 결과 — "확인했더니 없음"과 "확인 자체를 못함"을 구별한다.
 * 단순히 빈 배열을 돌려주면 이 둘이 똑같아 보여서, 조회가 실패했는데도 "맡은 스터디 없음"으로
 * 오인해 경고 없이 탈퇴가 진행될 수 있다(PR 리뷰 지적).
 */
export type NavigatorStudiesResult =
  | { status: 'ok'; studies: ActiveNavigatorStudy[] }
  | { status: 'unknown' };

/**
 * "맡은 진행 중인 스터디" = 네비게이터(LEADER·CO_LEADER)이고 relation 이 ONGOING(회차가 시작돼
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
    const data = await res.json();
    const items: MyStudyItem[] = data?.items ?? [];
    const studies = items
      .filter(
        (s) =>
          s.relation === 'ONGOING' &&
          (s.participantRole === 'LEADER' || s.participantRole === 'CO_LEADER'),
      )
      .map((s) => ({ studyId: s.studyId, title: s.title }));
    return { status: 'ok', studies };
  } catch {
    return { status: 'unknown' };
  }
}
