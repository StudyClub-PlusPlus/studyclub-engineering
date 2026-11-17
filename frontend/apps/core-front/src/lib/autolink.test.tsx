import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { autolink } from './autolink';

function renderText(text: string) {
  const { container } = render(<p>{autolink(text)}</p>);
  return container;
}

describe('autolink', () => {
  it('한글이 바로 붙어도 주소만 링크가 된다', () => {
    const container = renderText('자세한 안내는 https://studyclub.life에서 확인하세요');
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', 'https://studyclub.life');
    expect(link).toHaveTextContent('https://studyclub.life');
    expect(container).toHaveTextContent('자세한 안내는 https://studyclub.life에서 확인하세요');
  });

  it('문장 끝 마침표는 주소에서 뺀다', () => {
    renderText('공지는 https://studyclub.life/notices.');
    expect(screen.getByRole('link')).toHaveAttribute('href', 'https://studyclub.life/notices');
  });

  it('괄호로 감싼 주소는 닫는 괄호를 뺀다', () => {
    const container = renderText('(https://studyclub.life)');
    expect(screen.getByRole('link')).toHaveAttribute('href', 'https://studyclub.life');
    expect(container).toHaveTextContent('(https://studyclub.life)');
  });

  it('주소 안에서 짝이 맞는 닫는 괄호는 주소에 남는다', () => {
    renderText('https://en.wikipedia.org/wiki/Python_(programming_language)');
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      'https://en.wikipedia.org/wiki/Python_(programming_language)',
    );
  });

  it('괄호 주소를 괄호로 감싸면 바깥 괄호만 뺀다', () => {
    const container = renderText('(https://en.wikipedia.org/wiki/Python_(programming_language))');
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      'https://en.wikipedia.org/wiki/Python_(programming_language)',
    );
    expect(container).toHaveTextContent('(https://en.wikipedia.org/wiki/Python_(programming_language))');
  });

  it('태그는 HTML 로 해석하지 않고 글자로 남는다', () => {
    const container = renderText('<b>중요</b> https://studyclub.life');
    expect(container).toHaveTextContent('<b>중요</b> https://studyclub.life');
    expect(container.querySelector('b')).toBeNull();
  });
});
