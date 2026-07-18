// 구글 OAuth redirect 착지점. 팝업에서 열리며, code 를 opener(로그인 페이지)로
// postMessage 하고 창을 닫는다. (zapp popupResponse 패턴)
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code") ?? "";
  const error = req.nextUrl.searchParams.get("error") ?? "";
  const payload = JSON.stringify({ source: "studyclub-oauth", code, error });

  const html = `<!doctype html><html><body><script>
    (function () {
      var data = ${payload};
      if (window.opener) { window.opener.postMessage(data, "*"); }
      window.close();
      document.write("로그인 처리 중… 이 창은 자동으로 닫힙니다.");
    })();
  </script></body></html>`;

  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
