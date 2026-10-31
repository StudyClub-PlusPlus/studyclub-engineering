import { describe, expect, it } from 'vitest';

import { buildAppleAuthUrl } from './auth';

describe('애플 authorize URL', () => {
  it("scope 공백을 '+' 가 아니라 %20 으로 보낸다 — '+' 면 애플이 이름·이메일을 요청하지 않은 것으로 본다", () => {
    const url = buildAppleAuthUrl();

    expect(url).toContain('scope=name%20email');
    expect(url).not.toContain('name+email');
    expect(url).toContain('response_mode=form_post');
    expect(url).toContain('client_id=life.studyclub.web');
  });
});
