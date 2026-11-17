import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NoticeComposer } from './NoticeComposer';
import type { ApiNoticeCompose } from '@/features/study-notices/types';

const mutate = vi.hoisted(() => vi.fn());
vi.mock('../queries', () => ({ useSendNotice: () => ({ mutate, isPending: false }) }));
const compose: ApiNoticeCompose = {
  canSend: true,
  blockedReason: null,
  nextAvailableAt: null,
  remainingToday: 30,
  discord: { available: true, unavailableReason: null },
  recipients: [
    {
      participantId: 1,
      displayName: '테스트 크루',
      participantRole: 'MEMBER',
      participantStatus: 'ACTIVE',
      discordLinked: true,
    },
  ],
};
beforeEach(() => mutate.mockReset());

describe('공지 폼 제출', () => {
  it('길이 검증 후 확인 창을 거쳐 보내고 성공하면 글만 비운다', async () => {
    const user = userEvent.setup();
    render(<NoticeComposer studyId={1} groupId={1} compose={compose} />);
    const title = screen.getByLabelText('제목');
    const body = screen.getByLabelText('본문');
    expect(screen.getByRole('button', { name: '공지 보내기' })).toBeDisabled();
    await user.type(title, '가'.repeat(61));
    await user.type(body, '공지 본문');
    expect(screen.getByRole('button', { name: '공지 보내기' })).toBeDisabled();
    await user.clear(title);
    await user.type(title, ' 공지 제목 ');
    await user.click(screen.getByRole('button', { name: '공지 보내기' }));
    expect(mutate).not.toHaveBeenCalled();
    await user.click(await screen.findByRole('button', { name: '보내기' }));
    await waitFor(() => expect(mutate).toHaveBeenCalledOnce());
    expect(mutate.mock.calls[0][0]).toEqual({
      title: '공지 제목',
      body: '공지 본문',
      channels: ['EMAIL'],
      participantIds: [1],
    });
    act(() => mutate.mock.calls[0][1].onSuccess());
    expect(title).toHaveValue('');
    expect(body).toHaveValue('');
    expect(screen.getByRole('checkbox', { name: '테스트 크루' })).toBeChecked();
  });
  it('확인 중 수신자가 사라지거나 서버가 발송을 막으면 제출하지 않는다', async () => {
    const user = userEvent.setup();
    const view = render(<NoticeComposer studyId={1} groupId={1} compose={compose} />);
    await user.type(screen.getByLabelText('제목'), '제목');
    await user.type(screen.getByLabelText('본문'), '본문');
    await user.click(screen.getByRole('button', { name: '공지 보내기' }));
    view.rerender(<NoticeComposer studyId={1} groupId={1} compose={{ ...compose, canSend: false, recipients: [] }} />);
    await user.click(await screen.findByRole('button', { name: '보내기' }));
    expect(mutate).not.toHaveBeenCalled();
    expect(screen.getByLabelText('제목')).toHaveValue('제목');
  });
});
