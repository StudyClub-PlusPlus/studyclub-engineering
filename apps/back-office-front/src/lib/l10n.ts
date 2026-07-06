// 백오피스는 single-locale (ko 우선). L10n 객체에서 표시 문자열만 뽑는다.
import type { L10n } from "@studyclub/mock";

export function tx(value: L10n | undefined): string {
  if (!value) return "";
  return value.ko || value.en || "";
}

export const STATUS_LABEL: Record<string, string> = {
  recruiting: "모집 중",
  ongoing: "진행 중",
  closed: "종료",
};

export const FORMAT_LABEL: Record<string, string> = {
  online: "온라인",
  offline: "오프라인",
  hybrid: "하이브리드",
};

export const KIND_LABEL: Record<string, string> = {
  study: "스터디",
  club: "클럽",
};

// 모집 모델(recruitment.status) — 스터디 라이프사이클(status)과 별개.
export const RECRUITMENT_LABEL: Record<string, string> = {
  open: "모집 중",
  monthly: "매월 모집",
  always: "상시 모집",
  closed: "모집 마감",
};

export const EVENT_TYPE_LABEL: Record<string, string> = {
  meetup: "밋업",
  workshop: "워크샵",
  talk: "토크",
  online: "온라인",
};
