import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MarkdownLite } from './ApplicationFormUi';

describe('MarkdownLite', () => {
  it('빈 줄은 줄바꿈 하나로 남겨 문단이 붙지 않는다 — 제목 · 굵게는 마크다운으로', () => {
    const { container } = render(<MarkdownLite text={'첫 문단\n\n## 소제목\n**중요**\n일반'} />);
    const tags = [...container.firstElementChild!.children].map((el) => el.tagName);
    expect(tags).toEqual(['P', 'BR', 'H2', 'P', 'P']);
    expect(container.querySelector('h2')?.textContent).toBe('소제목');
    expect(container.querySelector('strong')?.textContent).toBe('중요');
  });
});
