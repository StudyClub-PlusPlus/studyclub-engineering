import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RetroTab } from '@/features/meeting-retro/RetroTab';
import type { ApiRetroList, ApiRetroStatus } from '@/features/meeting-retro/types';
import type { ParticipantsResponse } from '@/features/participants/types';
import type { ApiGroupMeetings, ApiMeeting } from '@/features/schedule/repository';
import type { ApiStudyDetail } from '@/features/studies/types';

const detail = { id: 107, title: 'DDIA 2판', discordChannelUrl: null, driveUrl: null } as ApiStudyDetail;

const participants = (groups: { groupId: number; name: string }[]): ParticipantsResponse => ({
  studyId: 107,
  participantCount: 0,
  recruitmentCapacity: null,
  ownerCaptain: null,
  groups: groups.map((g, i) => ({ ...g, isDefault: i === 0, canDelete: i > 0 })),
  participants: [],
});

const meeting = (id: number, number: number, scheduledAt: string): ApiMeeting => ({
  id,
  type: number === 0 ? 'KICKOFF' : 'REGULAR',
  number,
  scheduledAt,
  title: null,
  presenter1: null,
  presenter2: null,
  started: true,
});

const groupMeetings = (groupId: number, meetings: ApiMeeting[]): ApiGroupMeetings => ({
  studyGroup: {
    id: groupId,
    name: `반 ${groupId}`,
    timezone: 'Asia/Seoul',
    startTime: '20:00',
    navigatorName: null,
    rules: null,
    daysOfWeek: null,
  },
  me: { participantId: null, canEdit: true },
  participants: [],
  meetings,
});

const ended = (meetingId: number, endAt: string, deadline: string, open: boolean) => ({
  meetingId,
  meetingEndAt: endAt,
  retroDeadline: deadline,
  retroOpen: open,
  retroMine: null,
});

/** 반 1: 킥오프 · 끝난 1 · 2회차 · 아직 안 한 3회차. 반 2: 끝난 1회차. */
const server = {
  participants: participants([
    { groupId: 1, name: 'A반' },
    { groupId: 2, name: 'B반' },
  ]),
  meetings: {
    1: groupMeetings(1, [
      meeting(10, 0, '2026-01-01T11:00:00Z'),
      meeting(11, 1, '2026-01-08T11:00:00Z'),
      meeting(12, 2, '2026-01-15T11:00:00Z'),
      meeting(13, 3, '2099-01-22T11:00:00Z'),
    ]),
    2: groupMeetings(2, [meeting(21, 1, '2026-01-09T11:00:00Z')]),
  } as Record<number, ApiGroupMeetings>,
  status: {
    1: {
      meetings: [
        { meetingId: 10, meetingEndAt: null, retroDeadline: null, retroOpen: null, retroMine: null },
        ended(11, '2026-01-08T13:00:00Z', '2026-01-15T11:00:00Z', false),
        ended(12, '2026-01-15T13:00:00Z', '2099-01-22T11:00:00Z', true),
        { meetingId: 13, meetingEndAt: '2099-01-22T13:00:00Z', retroDeadline: '2099-01-29T13:00:00Z', retroOpen: false, retroMine: null },
      ],
    },
    2: { meetings: [ended(21, '2026-01-09T13:00:00Z', '2026-01-16T13:00:00Z', false)] },
  } as Record<number, ApiRetroStatus>,
  lists: {} as Record<number, ApiRetroList>,
};

const list = (meetingId: number, patch: Partial<ApiRetroList> = {}): ApiRetroList => ({
  meetingId,
  deadline: '2099-01-22T11:00:00Z',
  open: true,
  targets: 3,
  retros: [
    {
      retroId: meetingId * 10 + 1,
      author: { participantId: 1, displayName: '민호', role: 'MEMBER' },
      good: `${meetingId} 예제가 좋았어요`,
      improve: '시간이 부족했어요',
      feeling: '',
      writtenAt: '2026-01-15T13:10:00Z',
      likes: { GOOD: 1, IMPROVE: 0, FEELING: 0 },
    },
    {
      retroId: meetingId * 10 + 2,
      author: { participantId: 2, displayName: '하늘', role: 'LEADER' },
      good: '발표가 깔끔했어요',
      improve: '자료를 미리 주세요',
      feeling: '뿌듯해요',
      writtenAt: '2026-01-15T14:00:00Z',
      likes: { GOOD: 4, IMPROVE: 2, FEELING: 1 },
    },
  ],
  missing: [{ participantId: 3, displayName: '지우' }],
  ...patch,
});

let paths: string[];

beforeEach(() => {
  paths = [];
  server.lists = { 11: list(11), 12: list(12), 21: list(21, { retros: [], targets: 2, missing: [] }) };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const path = url.pathname + url.search;
      paths.push(path);
      let m: RegExpMatchArray | null;
      const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
      if (url.pathname === '/api/admin/studies/107/participants') return json(server.participants);
      if ((m = url.pathname.match(/^\/api\/admin\/studies\/107\/groups\/(\d+)\/meetings$/)))
        return json(server.meetings[Number(m[1])]);
      if (url.pathname === '/api/me/studies/107/retros/status')
        return json(server.status[Number(url.searchParams.get('studyGroupId'))]);
      if ((m = url.pathname.match(/^\/api\/studies\/107\/meetings\/(\d+)\/retros$/)))
        return json(server.lists[Number(m[1])]);
      return new Response(JSON.stringify({ errorMessage: 'not found' }), { status: 404 });
    }),
  );
});

afterEach(() => vi.unstubAllGlobals());

function mount(groupId = '') {
  const onGroup = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <RetroTab detail={detail} groupId={groupId} onGroup={onGroup} />
    </QueryClientProvider>,
  );
  const rerender = (next: string) =>
    view.rerender(
      <QueryClientProvider client={client}>
        <RetroTab detail={detail} groupId={next} onGroup={onGroup} />
      </QueryClientProvider>,
    );
  return { onGroup, rerender };
}

describe('스터디 상세 회고 탭', () => {
  it('끝난 회차만 칩으로 두고 가장 최근 회차를 먼저 연다', async () => {
    mount();
    const chips = within(await screen.findByRole('radiogroup', { name: '회차' })).getAllByRole('radio');
    expect(chips.map((c) => c.textContent)).toEqual(['1회차', '2회차']);
    expect(chips[1]).toHaveAttribute('aria-checked', 'true');
    expect(await screen.findByText('12 예제가 좋았어요')).toBeInTheDocument();
    expect(paths).toContain('/api/me/studies/107/retros/status?studyGroupId=1');
  });

  it('작성 현황 · 「n명 중 m명 작성」 · 마감 시각을 보이고, 작성 단추는 없다', async () => {
    mount();
    const status = await screen.findByRole('complementary', { name: '작성 현황' });
    expect(within(status).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      '민호작성',
      '하늘작성',
      '지우미작성',
    ]);
    expect(screen.getByText(/3명 중/)).toHaveTextContent('3명 중 2명 작성');
    expect(screen.getByText('01.22 20:00 KST까지')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /회고 작성|내 회고 수정/ })).not.toBeInTheDocument();
  });

  it('문항마다 👍 많은 순이고, 👍 는 누르는 단추가 아니다', async () => {
    mount();
    const good = await screen.findByRole('region', { name: '좋았던 점' });
    expect(within(good).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      '하늘발표가 깔끔했어요 4',
      '민호12 예제가 좋았어요 1',
    ]);
    expect(within(good).queryByRole('button')).not.toBeInTheDocument();
    // 비운 소감은 나오지 않는다
    const feeling = screen.getByRole('region', { name: '소감' });
    expect(within(feeling).getAllByRole('listitem')).toHaveLength(1);
  });

  it('회차 칩을 누르면 그 회차 회고를 연다', async () => {
    mount();
    await screen.findByText('12 예제가 좋았어요');
    await userEvent.click(screen.getByRole('radio', { name: '1회차' }));
    expect(await screen.findByText('11 예제가 좋았어요')).toBeInTheDocument();
    expect(screen.getByText('01.15 20:00 KST 마감')).toBeInTheDocument();
  });

  it('반 칩은 일정 · 출석 탭과 같은 값 — 고른 반의 회차와 회고를 본다', async () => {
    const { onGroup, rerender } = mount();
    await screen.findByText('12 예제가 좋았어요');
    await userEvent.click(screen.getByRole('button', { name: 'B반' }));
    expect(onGroup).toHaveBeenCalledWith('2');
    rerender('2');
    expect(await screen.findByText('아직 이 회차에 남긴 회고가 없습니다.')).toBeInTheDocument();
    expect(screen.getByText(/2명 중/)).toHaveTextContent('2명 중 0명 작성');
    expect(paths).toContain('/api/me/studies/107/retros/status?studyGroupId=2');
  });

  it('반이 하나면 반 칩이 없다', async () => {
    server.participants = participants([{ groupId: 1, name: 'A반' }]);
    mount();
    await screen.findByText('12 예제가 좋았어요');
    expect(screen.queryByRole('navigation', { name: '반' })).not.toBeInTheDocument();
    server.participants = participants([
      { groupId: 1, name: 'A반' },
      { groupId: 2, name: 'B반' },
    ]);
  });

  it('끝난 회차가 없으면 그렇다고 말한다', async () => {
    const saved = server.status[1];
    server.status[1] = { meetings: [saved.meetings[0], saved.meetings[3]] };
    mount();
    expect(await screen.findByText(/이 반은 아직 끝난 미팅이 없습니다/)).toBeInTheDocument();
    server.status[1] = saved;
  });

  it('회고 상태를 못 읽으면 서버 문구를 알린다', async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = new URL(String(input));
      if (url.pathname === '/api/admin/studies/107/participants')
        return new Response(JSON.stringify(server.participants), { status: 200 });
      if (url.pathname.endsWith('/meetings')) return new Response(JSON.stringify(server.meetings[1]), { status: 200 });
      return new Response(JSON.stringify({ errorMessage: '이 반 회고를 볼 수 없습니다.' }), { status: 403 });
    });
    mount();
    expect(await screen.findByRole('alert')).toHaveTextContent('이 반 회고를 볼 수 없습니다.');
  });
});
