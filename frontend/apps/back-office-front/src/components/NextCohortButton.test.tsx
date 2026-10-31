import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { NextCohortButton } from '@/components/NextCohortButton';
import { formToCreatePayload, nextCohortForm } from '@/components/StudyForm';
import type { ApiStudyDetail } from '@/features/studies/types';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

const cohort = (patch: Partial<ApiStudyDetail>) =>
  ({
    id: 3,
    programId: 70,
    programTitle: '아침 루틴 클럽',
    title: '아침 루틴 클럽 3기',
    oneLineSummary: '3기 소개',
    description: '3기 설명',
    category: 'LIFESTYLE',
    studyKind: 'CLUB',
    status: 'ENDED',
    timezone: 'KST',
    discordChannelUrl: 'https://discord.com/channels/1/2',
    driveUrl: null,
    capacity: 20,
    recruitDeadlineAt: '2026-09-01T14:59:59Z',
    startAt: '2026-09-10T00:00:00Z',
    schedule: '매주 화 07:00',
    ...patch,
  }) as ApiStudyDetail;

afterEach(() => vi.restoreAllMocks());

describe('클럽 「다음 기수 만들기」 (정보 탭 명세 1-2)', () => {
  it('프로그램은 이 클럽으로, 제목은 프로그램 제목, 소개 · 설명 · 카테고리 · 시간대 · 채널은 최신 기수 값. 마감 · 일정 · 정원은 비운다', () => {
    const form = nextCohortForm(cohort({}));
    expect(form).toMatchObject({
      programMode: 'existing',
      programId: '70',
      kind: 'CLUB',
      title: '아침 루틴 클럽',
      summary: '3기 소개',
      description: '3기 설명',
      category: 'LIFESTYLE',
      timezone: 'KST',
      discordUrl: 'https://discord.com/channels/1/2',
      deadline: '',
      schedule: '',
      startAt: '',
      unlimited: true,
    });
    // 기존 클럽에 붙인다 — 종류는 보내지 않는다(서버가 둘을 함께 받으면 400)
    const payload = formToCreatePayload({ ...form, deadline: '2026-12-01' });
    expect(payload).toMatchObject({ studyProgramId: 70 });
    expect(payload).not.toHaveProperty('studyKind');
  });

  it('누르면 최신 기수를 찾아 그 값으로 채운 등록 팝업이 열린다 — 프로그램은 고를 수 없다', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/api/admin/study-programs')) {
        return new Response(JSON.stringify({ items: [{ programId: 70, title: '아침 루틴 클럽', latestStudyId: 4 }] }));
      }
      return new Response(JSON.stringify(cohort({ id: 4, oneLineSummary: '4기 소개', status: 'OPEN' })));
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <NextCohortButton detail={cohort({})} />
      </QueryClientProvider>,
    );

    await userEvent.click(screen.getByRole('button', { name: '다음 기수 만들기' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('클럽의 새 기수')).toBeInTheDocument();
    expect(within(dialog).queryByRole('radio', { name: '새 프로그램' })).toBeNull();
    expect(within(dialog).getByDisplayValue('아침 루틴 클럽')).toBeInTheDocument();
    // 지금 보는 3기가 아니라 최신 4기의 값
    expect(within(dialog).getByDisplayValue('4기 소개')).toBeInTheDocument();
  });
});
