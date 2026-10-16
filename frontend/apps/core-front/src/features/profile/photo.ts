/** 사진이 없을 때 동그라미에 넣는 글자 — 닉네임 첫 글자. 비어 있으면 이메일 첫 글자. */
export function initialOf(name: string | null | undefined, fallback: string): string {
  const source = (name ?? '').trim() || fallback;
  return source.charAt(0).toUpperCase();
}
