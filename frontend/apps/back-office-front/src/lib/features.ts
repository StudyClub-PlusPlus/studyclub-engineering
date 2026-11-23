/**
 * Feature flags — 기능별 활성화 여부.
 * false 로 꺼진 기능은 UI 에서 숨긴다.
 * API 준비 후 true 로 바꾼다.
 */
export const FEATURES: Record<'EVENTS', boolean> = {
  /** 행사 관리 (/api/admin/events). 백엔드 API 가 있는 환경에서 사이드바 메뉴를 노출한다. */
  EVENTS: true,
};
