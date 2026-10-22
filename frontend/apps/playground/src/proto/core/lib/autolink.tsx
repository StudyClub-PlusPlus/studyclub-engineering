import type { ReactNode } from 'react';

/**
 * 평문 속 URL 만 링크로 바꾼다. **HTML 로 해석하지 않는다** — 나머지는 문자 그대로 React 텍스트로 남아
 * `<b>` 같은 태그도 글자로 보인다.
 *
 * http(s):// 로 시작하는 것만 잡는다. 문장 끝의 마침표·쉼표·닫는 괄호는 주소에서 뺀다 —
 * 「https://studyclub.life.」 처럼 문장이 끝나는 자리가 주소에 붙으면 깨진 주소로 간다.
 */
const URL_RE = /https?:\/\/[^\s<>"']+/g;
const TRAILING = /[.,!?;:)\]}'"]+$/;

export function autolink(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    const start = m.index ?? 0;
    let url = m[0];
    const trail = url.match(TRAILING)?.[0] ?? '';
    if (trail) url = url.slice(0, -trail.length);
    if (start > last) out.push(text.slice(last, start));
    out.push(
      <a
        key={start}
        href={url}
        target='_blank'
        rel='noopener noreferrer nofollow'
        className='break-all text-(--color-brand) underline underline-offset-2'
      >
        {url}
      </a>,
    );
    last = start + url.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
