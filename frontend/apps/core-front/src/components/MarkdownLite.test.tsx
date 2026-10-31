import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MarkdownLite } from './ApplicationFormUi';

const TEXT = '첫 문단\n\n## 소제목\n**중요**';

describe('MarkdownLite', () => {
  it('keepBlankLines 면 빈 줄을 줄바꿈 하나로 남겨 문단이 붙지 않는다', () => {
    const { container } = render(<MarkdownLite text={TEXT} keepBlankLines />);
    const tags = [...container.firstElementChild!.children].map((el) => el.tagName);
    expect(tags).toEqual(['P', 'BR', 'H2', 'P']);
    expect(container.querySelector('h2')?.textContent).toBe('소제목');
    expect(container.querySelector('strong')?.textContent).toBe('중요');
  });

  it('기본(신청 폼 설명)은 지금처럼 빈 줄을 버린다', () => {
    const { container } = render(<MarkdownLite text={TEXT} />);
    expect(container.querySelector('br')).toBeNull();
  });
});
