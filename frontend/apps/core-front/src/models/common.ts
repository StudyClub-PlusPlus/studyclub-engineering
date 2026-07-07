// 도메인 공통 타입 — 로케일/다국어 문자열.
// 데이터(하드코딩)는 @studyclub/mock 에 있고, 여기(models/)는 도메인 "모델"(타입 + 동작)을 소유한다.
// TODO(api): 팀 합류 후 api.studyclub-plusplus.com 응답 스키마와 맞춘다.

export type Locale = "ko" | "en";

export type L10n = { ko: string; en: string };

/** 로케일에 맞는 문자열을 뽑되, 없으면 ko 로 폴백. */
export function localize(value: L10n, locale: Locale): string {
  return value[locale] ?? value.ko;
}
