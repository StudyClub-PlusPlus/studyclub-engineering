import { isValidZone } from '@core/lib/schedule-timezone';

import seed from './member-timezones.seed.json';

/** Playground 전용 회원별 명시적 표본. 실제 서비스에서는 가입 완료·비탈퇴 계정을 ID로 집계한다. */
export const MEMBER_TIME_ZONE_KEY = 'sc_member_timezones_v1';
export const seedMemberTimeZones: Readonly<Record<string, string>> = seed;
const emailKey = (email: string) => email.trim().toLowerCase();

export function readMemberTimeZones(): Record<string, string> {
  const result = { ...seedMemberTimeZones };
  if (typeof window === 'undefined') return result;
  try {
    const saved = JSON.parse(window.localStorage.getItem(MEMBER_TIME_ZONE_KEY) ?? '{}');
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
      for (const [email, zone] of Object.entries(saved)) {
        if (email.trim() && typeof zone === 'string' && isValidZone(zone)) result[emailKey(email)] = zone;
      }
    }
  } catch { /* 표본으로 복구. 잘못된 저장값을 유효한 지역으로 집계하지 않는다. */ }
  return result;
}

export function saveMemberTimeZone(email: string, zone: string) {
  if (typeof window === 'undefined' || !email.trim() || !isValidZone(zone)) return;
  try {
    const values = readMemberTimeZones();
    values[emailKey(email)] = zone;
    window.localStorage.setItem(MEMBER_TIME_ZONE_KEY, JSON.stringify(values));
  } catch { /* 프로토의 저장소 제한은 프로필 화면을 중단시키지 않는다. */ }
  // 목록 변경 이벤트를 발행하지 않는다. 다음 화면 진입·새로고침에서 다시 읽는다.
}

export function memberTimeZone(email: string): string | null {
  return readMemberTimeZones()[emailKey(email)] ?? null;
}
