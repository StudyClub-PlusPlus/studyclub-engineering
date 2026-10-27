import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { Meeting, ScheduleGroup } from './meetings';
import { ScheduleTable } from './ScheduleTable';

const group: ScheduleGroup = { id: '3', title: '목요일반', time: { weekdays: [4], time: '20:00', tz: 'Asia/Seoul' } };

const meeting = (id: string, no: number, scheduledAt: string, started?: boolean): Meeting => ({
  id,
  no,
  scheduledAt,
  date: scheduledAt.slice(0, 10),
  time: '20:00',
  title: '',
  presenter1: '',
  presenter2: '',
  started,
});

describe('일정 표', () => {
  it('서버가 시작했다고 한 회차는 시각이 안 됐어도 고치거나 지우지 않는다 — 디스코드에서 일찍 시작', () => {
    render(
      <ScheduleTable
        group={group}
        meetings={[meeting('41', 1, '2099-01-01T11:00:00Z', true), meeting('42', 2, '2099-01-08T11:00:00Z', false)]}
        people={[]}
        onSave={vi.fn()}
        onAdd={vi.fn()}
        onSetKickoff={vi.fn()}
        onDelete={vi.fn()}
        onDirtyChange={vi.fn()}
      />,
    );

    expect(screen.queryByRole('checkbox', { name: '1회차 선택' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('1회차 일자 (KST)')).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: '2회차 선택' })).toBeVisible();
    expect(screen.getByText('전체 2 · 예정 1')).toBeVisible();
  });

  it('일부만 고르면 전체 선택 체크박스가 「일부 선택」으로 보인다', async () => {
    render(
      <ScheduleTable
        group={group}
        meetings={[meeting('41', 1, '2099-01-01T11:00:00Z'), meeting('42', 2, '2099-01-08T11:00:00Z')]}
        people={[]}
        onSave={vi.fn()}
        onAdd={vi.fn()}
        onSetKickoff={vi.fn()}
        onDelete={vi.fn()}
        onDirtyChange={vi.fn()}
      />,
    );
    const all = screen.getByRole('checkbox', { name: '지울 수 있는 회차 전체 선택' }) as HTMLInputElement;

    await userEvent.click(screen.getByRole('checkbox', { name: '1회차 선택' }));
    expect(all.indeterminate).toBe(true);
    await userEvent.click(all);
    expect(all).toBeChecked();
    expect(all.indeterminate).toBe(false);
  });
  it('저장하지 못한 회차는 고친 값을 남기고, 저장한 회차만 비운다', async () => {
    const onSave = vi.fn().mockResolvedValue(['42']);
    render(
      <ScheduleTable
        group={group}
        meetings={[meeting('41', 1, '2099-01-01T11:00:00Z'), meeting('42', 2, '2099-01-08T11:00:00Z')]}
        people={[]}
        onSave={onSave}
        onAdd={vi.fn()}
        onSetKickoff={vi.fn()}
        onDelete={vi.fn()}
        onDirtyChange={vi.fn()}
      />,
    );

    await userEvent.type(screen.getByLabelText('1회차 제목'), '1장');
    await userEvent.type(screen.getByLabelText('2회차 제목'), '2장');
    await userEvent.click(screen.getByRole('button', { name: '저장' }));

    expect(onSave).toHaveBeenCalledOnce();
    expect(await screen.findByText(/회차 1개를 저장했고, 1개는 저장하지 못해/)).toBeInTheDocument();
    expect(screen.getByLabelText('1회차 제목')).toHaveValue('');
    expect(screen.getByLabelText('2회차 제목')).toHaveValue('2장');
  });
});
