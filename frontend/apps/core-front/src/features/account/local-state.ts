'use client';

import { APPLICATION_KEY } from '@/features/applications/storage';
import { BOOKMARK_KEY } from '@/features/bookmarks/storage';

const LEGACY_ATTENDANCE_KEY = 'sc_my_attendance';
const LEGACY_DISCORD_KEY = 'sc_discord';

/**
 * 예전 개발 서버가 브라우저에 채운 더미 신청·관심(`sc_demo_seed` 표시). 실제 스터디 id 에 붙어 있어서
 * MSW 를 꺼도 「신청함」·하트·마이페이지 목록이 더미로 보였다. 표시가 남은 브라우저에서 한 번 지운다.
 */
const LEGACY_SEED_KEY = 'sc_demo_seed';

export function dropLegacyDemoSeed() {
  if (typeof window === 'undefined') return;
  try {
    if (localStorage.getItem(LEGACY_SEED_KEY) === null) return;
    for (const key of [APPLICATION_KEY, BOOKMARK_KEY, LEGACY_SEED_KEY]) localStorage.removeItem(key);
  } catch {
    // 저장소 접근 실패해도 화면 동작은 막지 않는다
  }
}

/**
 * 회원 탈퇴 — 이 브라우저에 남은 회원별 데이터(관심·신청·출석·옛 디스코드 표시)를 지운다.
 * 로그인 세션(sc_user)은 `logout()` 이 지운다.
 */
export function clearMyLocalData() {
  if (typeof window === 'undefined') return;
  for (const key of [BOOKMARK_KEY, APPLICATION_KEY, LEGACY_ATTENDANCE_KEY, LEGACY_DISCORD_KEY]) {
    try {
      localStorage.removeItem(key);
    } catch {
      // 저장소 접근 실패해도 탈퇴 흐름은 막지 않는다
    }
  }
}
