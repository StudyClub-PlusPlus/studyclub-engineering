import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Button, IconButton } from '../../../../packages/ui/src/Button';

describe('shared Button contract', () => {
  it('supports native Enter and Space activation', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>저장</Button>);
    await user.tab();
    expect(screen.getByRole('button', { name: '저장' })).toHaveFocus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it('keeps the label and icon layout in loading and blocks duplicate execution', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const { rerender } = render(
      <Button leadingIcon={<svg />} onClick={onClick}>
        저장
      </Button>,
    );
    const content = screen.getByRole('button').querySelector('.sc-button-content');
    const before = content?.innerHTML;
    rerender(
      <Button leadingIcon={<svg />} onClick={onClick} loading>
        저장
      </Button>,
    );
    const button = screen.getByRole('button', { name: '저장' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button.querySelector('.sc-button-content')?.innerHTML).toBe(before);
    expect(button.querySelector('.sc-button-progress')).toBeNull();
    expect(button.querySelector('.sc-button-content')).toBeVisible();
    await user.click(button);
    await user.keyboard('{Enter} ');
    expect(onClick).not.toHaveBeenCalled();
    rerender(<Button onClick={onClick}>저장</Button>);
    expect(button).toBeEnabled();
    expect(button).not.toHaveAttribute('aria-busy');
  });

  it.each([true, 'true'] as const)('enforces aria-disabled=%s as native disabled', (disabled) => {
    const onClick = vi.fn();
    render(
      <Button aria-disabled={disabled} onClick={onClick}>
        저장
      </Button>,
    );
    const button = screen.getByRole('button', { name: '저장' });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('preserves the original error label and associates failure copy', () => {
    render(
      <>
        <Button state='error' aria-describedby='save-failure'>
          저장
        </Button>
        <p id='save-failure' role='alert'>
          저장하지 못했어요.
        </p>
      </>,
    );
    const button = screen.getByRole('button', { name: '저장' });
    expect(button).toHaveAttribute('data-state', 'error');
    expect(button).toHaveAccessibleDescription('저장하지 못했어요.');
    expect(screen.queryByRole('button', { name: '다시 저장' })).not.toBeInTheDocument();
  });

  it.each(['primary', 'secondary', 'tertiary', 'danger', 'destructive'] as const)(
    'preserves %s variant and error semantics while disabled',
    (variant) => {
      render(
        <Button variant={variant} state='error' disabled>
          저장
        </Button>,
      );
      const button = screen.getByRole('button', { name: '저장' });
      expect(button).toHaveAttribute('data-variant', variant);
      expect(button).toHaveAttribute('data-state', 'error');
      expect(button).toBeDisabled();
    },
  );

  it.each(['sm', 'md', 'lg'] as const)('uses the agreed %s typography role', (size) => {
    render(<Button size={size}>저장</Button>);
    const button = screen.getByRole('button', { name: '저장' });
    expect(button).toHaveAttribute('data-size', size);
    expect(button).toHaveClass(size === 'sm' ? 'type-label-sm' : 'type-label-lg');
  });

  it('forwards native form attributes and submits once', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event) => event.preventDefault());
    render(
      <>
        <form id='save-form' onSubmit={onSubmit} />
        <Button type='submit' form='save-form' name='action' value='save'>
          저장
        </Button>
      </>,
    );
    await user.click(screen.getByRole('button', { name: '저장' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('gives IconButton a stable name and hides decorative icons even in loading', () => {
    render(
      <IconButton
        aria-label='검색'
        icon={
          <svg role='img'>
            <title>돋보기</title>
          </svg>
        }
        loading
      />,
    );
    const button = screen.getByRole('button', { name: '검색' });
    expect(button).toHaveClass('sc-icon-button');
    expect(button).toBeDisabled();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
