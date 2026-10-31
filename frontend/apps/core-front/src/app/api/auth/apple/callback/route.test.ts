// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { POST } from './route';

function post(fields: Record<string, string>) {
  const body = new URLSearchParams(fields);
  return POST(
    new Request('http://localhost/api/auth/apple/callback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    }),
  );
}

describe('애플 로그인 콜백 (form_post)', () => {
  it('code 와 첫 인가의 이름을 자기 오리진으로만 보낸다', async () => {
    const html = await (
      await post({ code: 'c1', user: JSON.stringify({ name: { firstName: '길동', lastName: '홍' } }) })
    ).text();

    expect(html).toContain('"provider":"apple"');
    expect(html).toContain('"code":"c1"');
    expect(html).toContain('"name":"길동 홍"');
    expect(html).toContain('window.location.origin');
    expect(html).not.toContain('"*"');
  });

  it('폼값으로 </script> 를 끊고 스크립트를 넣을 수 없다', async () => {
    const html = await (await post({ code: '</script><script>alert(1)</script>' })).text();

    expect(html.match(/<script>/g)).toHaveLength(1);
    expect(html).toContain('\\u003c/script>');
  });

  it('취소는 error 로 넘긴다', async () => {
    const html = await (await post({ error: 'user_cancelled_authorize' })).text();

    expect(html).toContain('"error":"user_cancelled_authorize"');
  });
});
