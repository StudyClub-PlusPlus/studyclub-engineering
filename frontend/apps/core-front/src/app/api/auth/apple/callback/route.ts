// 애플 로그인 착지점 (specs/auth-apple-login). scope 에 name·email 을 넣으면 애플은 GET 이 아니라
// form_post(POST) 로 code 를 보낸다. 팝업에서 열리며, code 와 첫 인가에만 오는 이름을 로그인 페이지로
// postMessage 하고 창을 닫는다. 구글 콜백(../../callback)과 같은 모양이고, 백오피스는 애플을 쓰지 않아 자기 오리진에만 보낸다.

/** 애플이 첫 인가에만 주는 `user` JSON 의 이름. 형식이 다르면 버린다 — 제안 닉네임일 뿐이다 */
function nameFrom(user: FormDataEntryValue | null): string {
  if (typeof user !== 'string') return '';
  try {
    const name = (JSON.parse(user) as { name?: { firstName?: string; lastName?: string } }).name;
    return [name?.firstName, name?.lastName].filter(Boolean).join(' ').trim();
  } catch {
    return '';
  }
}

export async function POST(req: Request) {
  const form = await req.formData().catch(() => new FormData());
  const code = String(form.get('code') ?? '');
  const error = String(form.get('error') ?? '');
  // 폼값이 <script> 안에 들어간다 — '<' 를 이스케이프해 </script> 로 빠져나가지 못하게 한다
  const payload = JSON.stringify({
    source: 'studyclub-oauth',
    provider: 'apple',
    code,
    name: nameFrom(form.get('user')),
    error,
  }).replace(/</g, '\\u003c');

  const html = `<!doctype html><html><body><script>
    (function () {
      var data = ${payload};
      if (window.opener) window.opener.postMessage(data, window.location.origin);
      window.close();
      document.write("로그인 처리 중… 이 창은 자동으로 닫힙니다.");
    })();
  </script></body></html>`;

  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
