// @vitest-environment node
import { NextRequest } from 'next/server';

import { describe, expect, it } from 'vitest';

import { GET } from './route';

describe('디스코드 OAuth 콜백', () => {
  it('쿼리값으로 </script> 를 끊고 스크립트를 넣을 수 없다', async () => {
    const evil = encodeURIComponent('</script><script>alert(1)</script>');
    const res = await GET(new NextRequest(`http://localhost/api/auth/discord/callback?code=${evil}&state=s`));
    const html = await res.text();

    expect(html.match(/<script>/g)).toHaveLength(1);
    expect(html).toContain('\\u003c/script>');
    expect(html).toContain('postMessage(data, window.location.origin)');
  });
});
