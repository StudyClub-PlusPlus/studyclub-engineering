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
