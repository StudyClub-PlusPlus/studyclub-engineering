/**
 * Feature flags — 기능별 활성화 여부.
 * false 로 꺼진 기능은 UI 에서 숨긴다.
 * API 준비 후 true 로 바꾼다.
 */
export const FEATURES: Record<'EVENTS', boolean> = {
  /** 행사 관리. TODO(api): POST/GET/PATCH/DELETE /api/events 준비되면 true 로 바꾼다. */
  EVENTS: false,
};
