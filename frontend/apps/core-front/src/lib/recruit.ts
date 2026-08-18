/**
 * 모집 상태의 **문구**만 담당한다. 판정 자체는 `@studyclub/mock` 이 정본 —
 * 운영자 콘솔과 사용자 사이트가 같은 함수를 써야 표기가 어긋나지 않는다.
 *
 * 신청은 외부 폼이 아니라 **사이트 자체**에서 받으므로 신청 링크 유무로 판정하지 않는다.
 * 판정 축은 **모집 마감일 하나**다.
 * - apply  : 모집 중 + (마감일이 남았거나 · 마감일이 없음=상시 모집)
 * - closed : 진행중·종료·마감일 경과
 *
 * 마감일을 비우면 마감 없이 계속 모집하는 것으로 본다(= 모집중). 스터디 종류를 따로 나누지
 * 않고 마감일 유무로만 표현하므로, 등록 폼에서 마감일은 선택 입력이다.
 */

import { recruitState, toISODate, type RecruitState } from "@studyclub/mock";
import type { Locale, Study } from "@/lib/content";
import { t } from "@/lib/i18n";

export { recruitState, toISODate };
export type { RecruitState };

/** 카드 CTA 문구 — 행동을 지시한다. */
const CTA_LABEL: Record<RecruitState, { ko: string; en: string }> = {
  apply: { ko: "신청하기", en: "Apply" },
  closed: { ko: "모집 마감", en: "Closed" },
};

/** 목록 탭 문구 — 상태를 분류한다. CTA와 달리 명사형. */
const TAB_LABEL: Record<RecruitState, { ko: string; en: string }> = {
  apply: { ko: "모집중", en: "Open" },
  closed: { ko: "모집 마감", en: "Closed" },
};

export function recruitLabel(state: RecruitState, locale: Locale): string {
  return t(CTA_LABEL[state], locale);
}

export function recruitTabLabel(state: RecruitState, locale: Locale): string {
  return t(TAB_LABEL[state], locale);
}

/**
 * 모집 마감일 표기. 마감일이 없으면 **아무것도 표기하지 않는다** —
 * 마감 없이 계속 모집하는 것도 결국 "모집중"이며, 그 사실은 탭과 CTA 가 이미 말해준다.
 */
export function recruitDeadline(study: Study, locale: Locale): string | undefined {
  const d = toISODate(study.recruitment?.deadline);
  if (!d) return undefined;
  return locale === "ko" ? `마감 ${d}` : `Due ${d}`;
}
