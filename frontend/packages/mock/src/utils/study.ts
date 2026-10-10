import type { LifecycleState, PublishState, RecruitState, Study } from '../types/study';

/** "2026/03/21"·"2026-3-21" 등 표기 흔들림을 yyyy-mm-dd 로 통일. 파싱 실패 시 원문 유지. */
export function toISODate(raw?: string): string | undefined {
  if (!raw) return undefined;
  const m = raw.trim().match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);
  if (!m) return raw.trim() || undefined;
  return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
}

/**
 * 스터디가 단 카테고리 — 단일 값을 배열로 감싸서 돌려준다.
 */
export function categoriesOf(study: Study): string[] {
  return study.category ? [study.category] : [];
}

/**
 * 신청 폼 주소.
 */
export function applyFormUrl(study: Study): string | undefined {
  return study.recruit_url ?? study.recruitment?.form_url;
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * 모집 상태. API 데이터는 서버 판정(`recruitStatus` → `recruitment.status`)이 먼저 거른다 —
 * 아래 마감일 비교는 mock 데이터용이다. 판정 축(시작일·정원·인원)을 여기 더하지 않는다
 * (docs/frontend-development-guide/api-integration.md §판정을 다시 하지 않는다).
 */
export function recruitState(study: Study): RecruitState {
  if (study.status !== "recruiting" || study.recruitment?.status === "closed")
    return "closed";
  const deadline = toISODate(study.recruitment?.deadline);
  if (!deadline) return "apply";
  return deadline >= todayISO() ? "apply" : "closed";
}

/**
 * 공개 상태.
 */
export function publishState(study: Study): PublishState {
  if (study.published === false) return "draft";
  const at = toISODate(study.publish_at);
  return at && at > todayISO() ? "draft" : "live";
}

/**
 * 스터디 상태 — 백엔드 STUDY.STATUS 5단계.
 */
export function lifecycleState(study: Study): LifecycleState {
  if (publishState(study) === "draft") return "DRAFT";
  if (study.status === "recruiting") return "OPEN";
  if (study.status === "ongoing") return "ONGOING";
  return study.channelDeleted ? "CLOSED" : "ENDED";
}
