/** `next` 는 누구나 고칠 수 있다 — 이 사이트 안 경로(`/` 하나로 시작)만 받는다. `//x`·`/\x` 는 다른 사이트로 간다. */
export function safeNext(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\') ? next : '/';
}
