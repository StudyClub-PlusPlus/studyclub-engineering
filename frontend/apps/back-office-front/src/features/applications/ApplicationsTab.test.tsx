import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApplicationsTab } from './ApplicationsTab';
import type { ApplicationsResponse } from './types';

const response: ApplicationsResponse = {
  respondentCount: 1,
  capacity: 10,
  canApprove: true,
  approvalBlockedReason: null,
  announcementUrl: 'https://example.com/studies/107',
  questions: [{ id: 'topics', label: '관심 주제', type: 'CHECKBOX', options: ['React', 'Java'], allowOther: true }],
  applications: [
    {
      id: 1,
      recruitmentId: 3,
      status: 'PENDING',
      applicantName: '김크루',
      discordNickname: '크루/서울',
      email: 'crew@example.com',
      submittedAt: '2026-10-08T23:30:00Z',
      previousParticipationCount: 0,
      completionRate: null,
      availableDays: ['mon', 'wed'],
      scheduleAgreed: null,
      answers: { topics: ['React', 'Java'] },
    },
  ],
};
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ApplicationsTab studyId={107} />
    </QueryClientProvider>,
  );
}
function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}
afterEach(() => vi.unstubAllGlobals());

describe('신청자 심사', () => {
  it('대기 목록에서 이력·답변을 함께 보고 신청서를 펼친다', async () => {
    const fetch = vi.fn().mockResolvedValue(reply(response));
    vi.stubGlobal('fetch', fetch);
    mount();
    expect(await screen.findByRole('tab', { name: '대기 1' })).toHaveAttribute('aria-selected', 'true');
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/admin/studies/107/applications'),
      expect.objectContaining({ credentials: 'include', signal: expect.any(AbortSignal) }),
    );
    expect(screen.getByText('첫 참여')).toBeVisible();
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
    expect(screen.getByText('관심 주제 — React, Java')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: '김크루 신청서 펼치기' }));
    expect(screen.getByText('월, 수')).toBeVisible();
    expect(screen.getByText('해당 없음')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: '김크루 신청서 접기' }));
    expect(screen.queryByText('월, 수')).not.toBeInTheDocument();
  });

  it('승인·거절 목록을 분리하고 탭 전환 시 선택을 해제한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        reply({
          ...response,
          applications: [
            ...response.applications,
            {
              ...response.applications[0],
              id: 2,
              applicantName: '승인회원',
              status: 'APPROVED',
              previousParticipationCount: 2,
              completionRate: 0,
            },
          ],
        }),
      ),
    );
    mount();
    await userEvent.click(await screen.findByRole('checkbox', { name: '김크루 선택' }));
    await userEvent.click(screen.getByRole('tab', { name: '승인 1' }));
    expect(screen.getByText('승인회원')).toBeVisible();
    expect(screen.getByText('2회')).toBeVisible();
    expect(screen.getByText('0%')).toBeVisible();
    expect(screen.queryByRole('button', { name: '승인회원 거절' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: '거절 0' }));
    expect(screen.getByText('거절 중인 신청이 없습니다.')).toBeVisible();
    await userEvent.click(screen.getByRole('tab', { name: '대기 1' }));
    expect(screen.getByRole('checkbox', { name: '김크루 선택' })).not.toBeChecked();
  });

  it.each(['APPROVED', 'REJECTED'] as const)('단건 %s 성공 후 서버 목록을 다시 조회한다', async (decision) => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(reply(response))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValue(reply({ ...response, applications: [{ ...response.applications[0], status: decision }] }));
    vi.stubGlobal('fetch', fetch);
    mount();
    await userEvent.click(
      await screen.findByRole('button', { name: `김크루 ${decision === 'APPROVED' ? '승인' : '거절'}` }),
    );
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('1명의 신청을'));
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/applications/decisions'),
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ applicationIds: [1], decision }) }),
    );
    expect(screen.queryByText('김크루')).not.toBeInTheDocument();
  });

  it('전체 선택으로 일괄 승인하고 처리 중에는 중복 요청을 막는다', async () => {
    let resolve!: (value: Response) => void;
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        reply({
          ...response,
          applications: [...response.applications, { ...response.applications[0], id: 2, applicantName: '이크루' }],
        }),
      )
      .mockImplementationOnce(
        () =>
          new Promise<Response>((done) => {
            resolve = done;
          }),
      )
      .mockResolvedValue(reply(response));
    vi.stubGlobal('fetch', fetch);
    mount();
    await userEvent.click(await screen.findByRole('checkbox', { name: '대기 신청 전체 선택' }));
    await userEvent.click(screen.getByRole('button', { name: '일괄 승인' }));
    expect(screen.getByRole('button', { name: '김크루 승인' })).toBeDisabled();
    expect(fetch.mock.calls[1][1].body).toBe(JSON.stringify({ applicationIds: [1, 2], decision: 'APPROVED' }));
    resolve(new Response(null, { status: 204 }));
    expect(await screen.findByRole('status')).toHaveTextContent('2명의 신청을 승인했습니다.');
  });

  it('정원 도달 시 경고하고 서버가 승인을 금지하면 승인만 막는다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        reply({
          ...response,
          capacity: 1,
          canApprove: false,
          approvalBlockedReason: '추가 승인 불가',
          applications: [...response.applications, { ...response.applications[0], id: 2, status: 'APPROVED' }],
        }),
      ),
    );
    mount();
    expect(await screen.findByText('정원이 찼어요.')).toBeVisible();
    expect(screen.getByRole('button', { name: '김크루 승인' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '김크루 거절' })).toBeEnabled();
  });

  it('정원 충돌을 성공으로 표시하지 않고 최신 목록을 조회한다', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(reply(response))
      .mockResolvedValueOnce(reply({}, 409))
      .mockResolvedValue(reply({ ...response, canApprove: false }));
    vi.stubGlobal('fetch', fetch);
    mount();
    await userEvent.click(await screen.findByRole('button', { name: '김크루 승인' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('신청 상태 또는 정원이 변경되었습니다');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(3));
  });

  it('신청자가 없으면 공고 링크를 복사할 수 있다', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply({ ...response, respondentCount: 0, applications: [] })));
    mount();
    expect(await screen.findByText('아직 신청한 사람이 없어요.')).toBeVisible();
    await user.click(screen.getByRole('button', { name: '공고 링크 복사' }));
    expect(writeText).toHaveBeenCalledWith(response.announcementUrl);
    expect(screen.getByRole('status')).toHaveTextContent('공고 링크를 복사했습니다');
    writeText.mockRestore();
  });

  it('조회 실패 후 재시도로 복구한다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(reply({}, 500)).mockResolvedValueOnce(reply(response)));
    mount();
    expect(screen.getByRole('status')).toHaveTextContent('불러오는 중');
    expect(await screen.findByRole('alert')).toHaveTextContent('불러오지 못했습니다');
    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(await screen.findByText('김크루')).toBeVisible();
  });

  it.each([401, 403, 404])('%s 오류에서는 신청 내용을 노출하지 않는다', async (status) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply({}, status)));
    mount();
    expect(await screen.findByRole('alert')).toBeVisible();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    if (status === 403) expect(screen.getByRole('alert')).toHaveTextContent('담당하는 스터디가 아니에요.');
  });
});
