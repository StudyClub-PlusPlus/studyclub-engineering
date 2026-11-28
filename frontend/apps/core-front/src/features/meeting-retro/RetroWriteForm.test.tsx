import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RetroWriteForm } from '@/features/meeting-retro/RetroWriteForm';
import type { ApiRetroStatus } from '@/features/meeting-retro/types';

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  status: vi.fn(),
  list: vi.fn(),
  save: vi.fn(),
  meetings: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push, replace: mocks.replace }) }));
vi.mock('@/features/schedule/StudyManageShell', () => ({
  useManage: () => ({ study: { id: '5' }, groupId: 1005, locale: 'ko', role: 'crew', setDirty: vi.fn() }),
}));
vi.mock('@/features/profile/use-display-timezone', () => ({ useDisplayTimeZone: () => 'Asia/Seoul' }));
vi.mock('@/lib/analytics', () => ({ track: vi.fn() }));
vi.mock('@/features/schedule/repository', () => ({ getStudyMeetings: mocks.meetings }));
vi.mock('@/features/meeting-retro/repository', () => ({
  getRetroStatus: mocks.status,
  getMeetingRetros: mocks.list,
  getRetroViewer: vi.fn(),
  saveMyRetro: mocks.save,
  setRetroLike: vi.fn(),
}));
vi.mock('@studyclub/ui', async (original) => ({
  ...(await original<typeof import('@studyclub/ui')>()),
  toast: { success: mocks.success, error: mocks.error },
}));

const status = (mine: boolean): ApiRetroStatus => ({
  meetings: [
    {
      meetingId: 303,
      meetingEndAt: '2026-11-24T13:00:00Z',
      retroDeadline: '2099-12-01T11:00:00Z',
      retroOpen: true,
      retroMine: mine,
    },
  ],
});

function renderForm() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <RetroWriteForm meetingId={303} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mocks.meetings.mockResolvedValue({
    me: { participantId: 1, canEdit: false },
    meetings: [
      {
        id: 303,
        type: 'REGULAR',
        number: 3,
        scheduledAt: '2026-11-24T11:00:00Z',
        title: '',
        presenter1: null,
        presenter2: null,
        started: true,
      },
    ],
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('RetroWriteForm', () => {
  it('반 명부에 없으면(명부에 없는 캡틴) 폼 없이 그 회차의 회고 탭으로 돌려보낸다', async () => {
    mocks.status.mockResolvedValue({ meetings: [{ ...status(false).meetings[0], retroMine: null }] });
    mocks.meetings.mockResolvedValue({ ...(await mocks.meetings()), me: { participantId: null, canEdit: false } });
    renderForm();

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/ko/my/joined/5/schedule/retro?meeting=303'));
    expect(screen.queryByRole('button', { name: '회고 제출' })).toBeNull();
  });

  it('회차 정보에 서버가 준 미팅 종료 시각을 프로필 시간대로 보인다', async () => {
    mocks.status.mockResolvedValue(status(false));
    renderForm();

    expect(await screen.findByText('미팅 종료 11.24 22:00 KST')).toBeTruthy();
  });

  it('처음 제출하면 상태가 「씀」으로 바뀌어도 완료 토스트를 띄우고 회고 탭으로 간다', async () => {
    mocks.status.mockResolvedValueOnce(status(false)).mockResolvedValue(status(true));
    // 저장 뒤 내 회고를 읽는 동안 폼이 내려간다
    mocks.list.mockReturnValue(new Promise(() => {}));
    mocks.save.mockResolvedValue(null);
    renderForm();

    fireEvent.change(await screen.findByLabelText(/좋았던 점/), { target: { value: '좋았어요' } });
    fireEvent.change(screen.getByLabelText(/개선할 점/), { target: { value: '늦었어요' } });
    fireEvent.click(screen.getByRole('button', { name: '회고 제출' }));

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/ko/my/joined/5/schedule/retro?meeting=303'));
    expect(mocks.success).toHaveBeenCalledWith('회고를 남겼어요.');
  });

  it('수정이면 내 participantId 의 회고로 폼을 채운다', async () => {
    mocks.status.mockResolvedValue(status(true));
    mocks.list.mockResolvedValue({
      meetingId: 303,
      deadline: '2099-12-01T11:00:00Z',
      open: true,
      targets: null,
      missing: [],
      retros: [
        {
          retroId: 8,
          author: { participantId: 2, displayName: '민호', role: 'MEMBER' },
          good: '남의 회고',
          improve: '남의 회고',
          feeling: '',
          writtenAt: '2026-11-24T13:00:00Z',
          likes: {},
        },
        {
          retroId: 9,
          author: { participantId: 1, displayName: '나', role: 'MEMBER' },
          good: '내가 쓴 좋았던 점',
          improve: '내가 쓴 개선할 점',
          feeling: '',
          writtenAt: '2026-11-24T14:00:00Z',
          likes: {},
        },
      ],
    });
    renderForm();

    expect(await screen.findByDisplayValue('내가 쓴 좋았던 점')).toBeTruthy();
    expect(screen.getByRole('button', { name: '수정 저장' })).toBeTruthy();
  });

  it('쓴 회고를 못 읽으면 빈 폼을 열지 않는다 — 제출하면 쓴 내용을 덮어쓴다', async () => {
    mocks.status.mockResolvedValue(status(true));
    mocks.list.mockRejectedValue(new Error('down'));
    renderForm();

    expect(await screen.findByText('내 회고를 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /회고 제출|수정 저장/ })).toBeNull();
  });
});
