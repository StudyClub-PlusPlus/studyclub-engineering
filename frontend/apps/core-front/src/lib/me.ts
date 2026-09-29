'use client';

import type { MemberRegion } from '@studyclub/mock';

import { clearMyAttendance } from './attendance';
import { API_BASE } from './http';

/**
 * 로그인한 회원의 개인 데이터 — 관심 스터디·스터디 신청·거주 지역.
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
const REGION_KEY = 'sc_region';
const NAME_KEY = 'sc_display_name';
const DISCORD_KEY = 'sc_discord';

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
 * 회원 거주 지역. 신청 폼이 "가능한 시간"을 어느 시간대 기준으로 받을지 정하는 값이라
 * 회원이 직접 고칠 수 있어야 한다(마이페이지).
 */
export function getRegion(): MemberRegion {
  const v = readJSON<string>(REGION_KEY, 'KR');
  return v === 'NA' || v === 'ETC' ? v : 'KR';
}

export function setRegion(region: MemberRegion) {
  writeJSON(REGION_KEY, region);
}

/* ── 표시 이름 ───────────────────────────────────────────────────────────── */

/**
 * 회원이 고친 표시 이름. 구글 계정 이름을 그대로 쓰기 싫은 경우가 있어 따로 둔다.
 * 고친 적이 없으면 undefined — 그때는 로그인 계정 이름을 쓴다.
 */
export function getDisplayName(): string | undefined {
  const v = readJSON<string>(NAME_KEY, '');
  return v || undefined;
}

export function setDisplayName(name: string) {
  writeJSON(NAME_KEY, name.trim());
}

/* ── 디스코드 연결 ───────────────────────────────────────────────────────── */

/**
 * 디스코드 계정 연결.
 *
 * 스터디 진행이 디스코드에서 이뤄지므로, 연결이 안 된 회원은 승인해도 합류할 수 없다.
 * 회원 본인이 지금 연결돼 있는지 알 수 있어야 한다.
 *
 * TODO(api): OAuth 연동 — GET /api/me/discord · POST /api/me/discord/link
 */
export type DiscordLink = { handle: string } | null;

export function getDiscord(): DiscordLink {
  const v = readJSON<string>(DISCORD_KEY, '');
  return v ? { handle: v } : null;
}

export function setDiscord(handle: string | null) {
  writeJSON(DISCORD_KEY, handle ?? '');
}

/* ── 데모 데이터 ─────────────────────────────────────────────────────────── */

/**
 * 프로토타입 확인용 초기 데이터. 빈 화면만 보면 목록 레이아웃을 판단할 수 없어서,
 * 미리보기로 들어올 때 채운다. 버전이 같으면 다시 채우지 않으므로 직접 신청·취소한 결과는 남는다.
 */
const SEED_KEY = 'sc_demo_seed';
/** 더미 내용을 바꾸면 올린다 — 이미 한 번 열어본 브라우저에도 새 더미가 들어간다. */
const SEED_VERSION = 3;

export function seedDemoData() {
  if (readJSON<number>(SEED_KEY, 0) >= SEED_VERSION) return;
  writeJSON(SEED_KEY, SEED_VERSION);
  {
    writeJSON(APPLICATION_KEY, [
      {
        studyId: 'ddia-2nd',
        appliedAt: '2026-07-28',
        status: 'accepted',
        region: 'KR',
      },
      {
        studyId: 'ai-paper-study',
        appliedAt: '2026-08-11',
        status: 'accepted',
        region: 'KR',
      },
      // 끝난 스터디 — 참여 이력으로 내려간다
      {
        studyId: 'leetcode150-2026',
        appliedAt: '2026-02-03',
        status: 'accepted',
        region: 'KR',
      },
      {
        studyId: 'sql-for-data-analysis',
        appliedAt: '2025-11-12',
        status: 'accepted',
        region: 'KR',
      },
      {
        studyId: 'pytorch-ai-coding',
        appliedAt: '2026-08-14',
        status: 'pending',
        region: 'KR',
        cells: ['mon-evening', 'wed-evening', 'sun-afternoon'],
        motivation: 'PyTorch로 직접 구현해보고 싶어 신청합니다.',
      },
    ] satisfies Application[]);
  }
  writeJSON(BOOKMARK_KEY, ['daily-leetcode', 'early-bird', 'system-design-interview']);
  writeJSON(DISCORD_KEY, 'jiwon_dev');
}

/**
 * 회원 탈퇴 — 이 브라우저에 남은 회원별 데이터(관심·신청·지역·표시 이름·디스코드 핸들·출석)를 지운다.
 * 로그인 세션(sc_user)은 `logout()` 이 지운다. 데모 시드 키(SEED_KEY)는 일부러 남긴다 — 지우면 다음
 * 미리보기 진입 때 더미가 다시 채워져 탈퇴한 사람의 데이터처럼 보인다.
 */
export function clearMyLocalData() {
  if (typeof window === 'undefined') return;
  for (const key of [BOOKMARK_KEY, APPLICATION_KEY, REGION_KEY, NAME_KEY, DISCORD_KEY]) {
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
 * 없다 — "지금 이 사람이 진행 중인 스터디의 네비게이터인가"는 서버(STUDY_PARTICIPANT · STUDY.STATUS)
 * 만 판정할 수 있다. GET /api/me/studies (서버 라우트 프록시)를 실제로 호출한다
 * (specs/user-leave/spec.md "GET /api/me/studies (기존 API 확장)").
 */
export type ActiveNavigatorStudy = { studyId: number; title: string };

/**
 * 실패(네트워크 오류, 401, 403 ONBOARDING_REQUIRED 등)는 전부 "맡은 스터디 없음"과 동일하게
 * 빈 배열로 처리한다 — 온보딩 미완료 계정은 애초에 참여 자체가 불가능해 맡은 스터디가 있을 수
 * 없으므로 안전하다(스펙의 `@RequireOnboarding` 과의 관계 절 참고).
 */
export async function getActiveNavigatorStudies(): Promise<ActiveNavigatorStudy[]> {
  try {
    // 백엔드를 직접 호출한다 — access 쿠키가 httpOnly 라도 credentials: 'include' 로 자동으로
    // 실리므로 중계 라우트가 필요 없다 (lib/http.ts 와 같은 이유).
    const res = await fetch(`${API_BASE}/api/me/studies`, { credentials: 'include', cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    const activeStudies: Array<{ studyId: number; title: string; isActiveNavigator: boolean }> =
      data?.activeStudies ?? [];
    return activeStudies
      .filter((s) => s.isActiveNavigator)
      .map((s) => ({ studyId: s.studyId, title: s.title }));
  } catch {
    return [];
  }
}
