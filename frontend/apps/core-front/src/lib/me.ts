'use client';

import type { MemberRegion } from '@studyclub/mock';

import { getUser } from './auth';

/**
 * 로그인한 회원의 개인 데이터 — 관심 스터디·스터디 신청.
 *
 * 저장할 서버가 아직 없어 **브라우저에만** 남긴다(기기·브라우저가 바뀌면 사라진다).
 * 서버가 생기면 이 파일의 read/write 만 fetch 로 갈아끼우면 되고, 화면 코드는 그대로 둔다.
 *
 * TODO(api): GET/PUT /api/me/bookmarks · /api/me/applications
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
const SEED_VERSION = 4;

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
  writeJSON(BOOKMARK_KEY, ['pytorch-ai-coding', 'system-design-interview']);
}
