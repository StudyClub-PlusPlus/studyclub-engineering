import { describe, expect, it } from 'vitest';

import { siteNoticeSchema } from '@/features/site-notices/form-schema';

describe('notice schema', () => {
  it('rejects whitespace-only required content', () => {
    const result = siteNoticeSchema.safeParse({ title: ' ', body: '\n' });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues.map((issue) => issue.message)).toEqual(['제목을 입력하세요.', '본문을 입력하세요.']);
  });
  it('preserves raw content and allows titles beyond the recommended count', () => {
    const notice = { title: `  ${'a'.repeat(41)}  `, body: '\n본문\n' };
    expect(siteNoticeSchema.parse(notice)).toEqual(notice);
  });
});
