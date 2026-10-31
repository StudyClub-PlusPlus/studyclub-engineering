import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MarkdownLite } from '@/features/application-form/ApplicationFormUi';

describe('MarkdownLite (신청 폼 미리보기)', () => {
  it('빈 줄은 줄바꿈 하나로 남겨 문단이 붙지 않는다 — 사이트와 같은 규칙', () => {
    const { container } = render(<MarkdownLite text={'# 제목\n\n**중요**\n일반텍스트'} />);
    const tags = [...container.firstElementChild!.children].map((el) => el.tagName);
    expect(tags).toEqual(['H1', 'BR', 'P', 'P']);
    expect(container.querySelector('strong')?.textContent).toBe('중요');
  });
});
