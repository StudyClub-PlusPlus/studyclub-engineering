/**
 * Feature flags — 기능별 활성화 여부.
 * false 로 꺼진 기능은 UI 에서 숨기고 페이지를 404 로 반환한다.
 * API 준비 후 true 로 바꾼다.
 */
export const FEATURES: Record<'EVENTS', boolean> = {
  /** 행사 목록·상세 — event-registration API (`GET /api/events` 등) */
  EVENTS: true,
};
