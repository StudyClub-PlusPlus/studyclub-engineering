import { useSyncExternalStore } from 'react';

/**
 * 유효한 IANA 시간대 ID를 반환하거나 판별 불가이면 `'Asia/Seoul'`.
 * 에러가 나거나 브라우저가 값을 주지 않으면 'Asia/Seoul'.
 */
function detectZone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!tz) return 'Asia/Seoul';
    new Intl.DateTimeFormat('en-US', { timeZone: tz }); // 유효성 검사
    return tz;
  } catch {
    return 'Asia/Seoul';
  }
}

const noSubscription = () => () => {};

/**
 * 화면에 날짜·시각을 표시할 때 쓸 시간대 (IANA ID).
 *
 * POL-0006: 프로필 시간대 → 브라우저 시간대 → 서울 순서.
 * 이 훅은 **브라우저 시간대 → 서울** 까지만 담당한다.
 * 프로필 시간대가 필요한 화면(대시보드 등)은 서버 응답의 `timeZone` 필드를 사용한다.
 *
 * SSR 에서는 하이드레이션 불일치를 막기 위해 'Asia/Seoul' 을 반환한다.
 */
export function useDisplayTimeZone(): string {
  return useSyncExternalStore(noSubscription, detectZone, () => 'Asia/Seoul');
}
