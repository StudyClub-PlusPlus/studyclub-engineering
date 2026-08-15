/** 클래스 결합 유틸. 외부 라이브러리(clsx 등) 추가 금지 규칙에 따라 최소 구현. */
export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}
