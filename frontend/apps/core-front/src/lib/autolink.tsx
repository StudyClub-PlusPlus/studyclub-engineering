import type { ReactNode } from 'react';

/**
 * 평문 속 URL 만 링크로 바꾼다. **HTML 로 해석하지 않는다** — 나머지는 문자 그대로 React 텍스트로 남아
 * `<b>` 같은 태그도 글자로 보인다. 공지 본문은 서버가 받은 글자를 그대로 저장하므로 화면이 이걸 지킨다.
 *
 * http(s):// 로 시작하고 URL 에 쓰이는 글자(영숫자와 `-._~:/?#[]@!$&()*+,;=%`)가 이어지는 동안만 주소다.
 * 한글·공백·따옴표는 주소 글자가 아니라서 「https://studyclub.life에서」 처럼 바로 붙여 써도 주소만 링크가 된다.
 * 문장 끝의 마침표·쉼표·닫는 괄호는 주소에서 뺀다 — 「https://studyclub.life.」 처럼 문장이 끝나는 자리가
 * 주소에 붙으면 깨진 주소로 간다. 닫는 괄호는 주소 안에 짝이 없을 때만 — 「…/Python_(language)」 의 `)` 는 주소다.
 */
const URL_RE = /https?:\/\/[A-Za-z0-9\-._~:/?#[\]@!$&()*+,;=%]+/g;
const TRAILING = /[.,!?;:\]]$/;

function trimTrailing(url: string): string {
  let end = url.length;
  while (end > 0) {
    const ch = url[end - 1];
    if (ch === ')') {
      const opens = url.slice(0, end).split('(').length - 1;
      const closes = url.slice(0, end).split(')').length - 1;
      if (opens >= closes) break;
    } else if (!TRAILING.test(ch)) {
      break;
    }
    end -= 1;
  }
  return url.slice(0, end);
}

export function autolink(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    const start = m.index ?? 0;
    const url = trimTrailing(m[0]);
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
