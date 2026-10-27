// 구글 OAuth redirect 착지점. 팝업에서 열리며, code 를 opener(로그인 페이지)로
// postMessage 하고 창을 닫는다. (zapp popupResponse 패턴)
import { NextRequest } from 'next/server';

/**
 * code 를 받아도 되는 opener. 백오피스도 이 콜백을 같이 쓴다(GCP 에 core-front 주소만 등록).
 * 로컬 두 주소는 로컬 화면을 운영 콜백에 붙여 볼 때용이다(docker-compose 「운영 API 에 붙이기」).
 * 여기 없는 사이트가 팝업을 열면 postMessage 가 버려진다 — '*' 였을 때는 아무 사이트나 인가 code 를 받을 수 있었다.
 */
const OPENER_ORIGINS = [
  new URL(process.env.NEXT_PUBLIC_BACKOFFICE_URL ?? 'http://localhost:4701').origin,
  'http://localhost:4700',
  'http://localhost:4701',
];

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code') ?? '';
  const error = req.nextUrl.searchParams.get('error') ?? '';
  // 쿼리값이 <script> 안에 들어간다 — '<' 를 이스케이프해 </script> 로 빠져나가지 못하게 한다
  const payload = JSON.stringify({ source: 'studyclub-oauth', code, error }).replace(/</g, '\\u003c');
  const origins = JSON.stringify(OPENER_ORIGINS).replace(/</g, '\\u003c');

  const html = `<!doctype html><html><body><script>
    (function () {
      var data = ${payload};
      if (window.opener) {
        [window.location.origin].concat(${origins}).forEach(function (o) { window.opener.postMessage(data, o); });
      }
      window.close();
      document.write("로그인 처리 중… 이 창은 자동으로 닫힙니다.");
    })();
  </script></body></html>`;

  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
