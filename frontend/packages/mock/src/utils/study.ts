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
 * 모집 상태. 모집 시작일·마감일·정원으로 판정한다. 마감일이 없으면 마감 없이 모집 중으로 본다.
 */
export function recruitState(study: Study): RecruitState {
  if (study.status !== "recruiting" || study.recruitment?.status === "closed")
    return "closed";
  const today = todayISO();
  const start = toISODate(study.recruitment?.start);
  if (start && start > today) return "closed";
  const deadline = toISODate(study.recruitment?.deadline);
  if (deadline && deadline < today) return "closed";
  const capacity = study.recruitment?.capacity;
  if (capacity !== undefined && study.applicantCount !== undefined && study.applicantCount >= capacity)
    return "closed";
  return "apply";
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
