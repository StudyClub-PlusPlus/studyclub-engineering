// @vitest-environment node
import { NextRequest } from 'next/server';

import { describe, expect, it } from 'vitest';

import { GET } from './route';

describe('구글 OAuth 콜백', () => {
  it('쿼리값으로 </script> 를 끊고 스크립트를 넣을 수 없다', async () => {
    const evil = encodeURIComponent('</script><script>alert(1)</script>');
    const html = await (await GET(new NextRequest(`http://localhost/api/auth/callback?code=${evil}`))).text();

    expect(html.match(/<script>/g)).toHaveLength(1);
    expect(html).toContain('\\u003c/script>');
  });

  it("code 를 '*' 로 보내지 않는다", async () => {
    const html = await (await GET(new NextRequest('http://localhost/api/auth/callback?code=c'))).text();

    expect(html).not.toContain('"*"');
    expect(html).toContain('https://back-office-stage.studyclub.life');
    expect(html).toContain('https://back-office.studyclub.life');
  });
});
