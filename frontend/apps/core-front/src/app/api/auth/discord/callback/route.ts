// 디스코드 OAuth redirect 착지점. 연동 팝업에서 열리며, code·state 를 opener(연동 창)로
// postMessage 하고 창을 닫는다. 구글 로그인 콜백(../../callback)과 같은 모양이다.
import { NextRequest } from 'next/server';

import { DISCORD_OAUTH_SOURCE } from '@/features/profile/discord';

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  // 쿼리값이 <script> 안에 들어간다 — '<' 를 이스케이프해 </script> 로 빠져나가지 못하게 한다
  const payload = JSON.stringify({
    source: DISCORD_OAUTH_SOURCE,
    code: q.get('code') ?? '',
    state: q.get('state') ?? '',
    error: q.get('error') ?? '',
  }).replace(/</g, '\\u003c');

  // 받는 쪽 출처를 자기 출처로 고정한다 — code 가 다른 사이트의 opener 로 새지 않게
  const html = `<!doctype html><html><body><script>
    (function () {
      var data = ${payload};
      if (window.opener) { window.opener.postMessage(data, window.location.origin); }
      window.close();
      document.write("디스코드 연동 처리 중… 이 창은 자동으로 닫힙니다.");
    })();
  </script></body></html>`;

  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
