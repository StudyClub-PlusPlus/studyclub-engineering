import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ScheduleTab } from './ScheduleTab';
import type { Participant, ParticipantsResponse } from '@/features/participants/types';
import type { ApiStudyDetail } from '@/features/studies/types';

const detail = {
  id: 107,
  title: 'DDIA 2판',
  discordChannelUrl: 'https://discord.com/channels/1/2',
  driveUrl: null,
} as ApiStudyDetail;

const participant = (id: number, nickname: string, status: Participant['status']): Participant => ({
  participantId: id,
  accountId: id,
  nickname,
  discordNickname: null,
  email: `${id}@example.com`,
  regionGroup: 'KR',
  groupId: 1,
  participantRole: 'MEMBER',
  status,
  captain: false,
  joinedAt: '2026-10-08T23:30:00Z',
});

const participants: ParticipantsResponse = {
  studyId: 107,
  participantCount: 2,
  recruitmentCapacity: null,
  groups: [{ groupId: 1, name: '기본반', isDefault: true, canDelete: false }],
  participants: [
    participant(1, '김크루', 'ACTIVE'),
    participant(2, '이크루', 'PAUSED'),
    participant(3, '박중단', 'WITHDRAWN'),
  ],
};

function mount(onDirtyChange = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ScheduleTab detail={detail} groupId='' onGroup={vi.fn()} onDirtyChange={onDirtyChange} guard={(go) => go()} />
    </QueryClientProvider>,
  );
  return { onDirtyChange };
}

/** 노드 내장 localStorage 가 jsdom 것을 가린다 — 테스트마다 빈 메모리 저장소를 둔다. */
function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, String(v)),
  };
}

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(participants))));
});
afterEach(() => vi.unstubAllGlobals());

async function setTimeAndAddMeetings() {
  await userEvent.click(screen.getByRole('button', { name: '스터디 시간 정하기' }));
  const timeDialog = screen.getByRole('dialog');
  await userEvent.click(within(timeDialog).getByRole('button', { name: '수' }));
  await userEvent.type(within(timeDialog).getByLabelText('스터디 시간'), '20:30');
  await userEvent.click(within(timeDialog).getByRole('button', { name: '저장' }));

  await userEvent.click(screen.getByRole('button', { name: '회차 추가' }));
  const addDialog = screen.getByRole('dialog');
  // 회차가 없는 반은 반의 요일 매주 반복 · 4주로 채워 연다
  expect(within(addDialog).getByRole('button', { name: '매주' })).toHaveAttribute('aria-pressed', 'true');
  expect(within(addDialog).getByRole('button', { name: '수요일' })).toHaveAttribute('aria-pressed', 'true');
  await userEvent.click(within(addDialog).getByRole('button', { name: '회차 5개 추가' }));
}

describe('일정 탭', () => {
  it('스터디 시간이 없는 반은 안내부터 보이고, 정하면 정보 카드와 빈 일정 표가 나온다', async () => {
    mount();
    expect(screen.getByText('아직 이 반의 스터디 시간이 없습니다.')).toBeVisible();

    await userEvent.click(screen.getByRole('button', { name: '스터디 시간 정하기' }));
    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: '저장' }));
    expect(within(dialog).getByText('요일을 하나 이상 골라 주세요.')).toBeVisible();
    await userEvent.click(within(dialog).getByRole('button', { name: '금' }));
    await userEvent.type(within(dialog).getByLabelText('스터디 시간'), '19:00');
    await userEvent.click(within(dialog).getByRole('button', { name: '저장' }));

    expect(screen.getByText('매주 금요일 19:00 KST')).toBeVisible();
    expect(screen.getByText('미지정')).toBeVisible();
    expect(screen.getByRole('link', { name: '디스코드' })).toHaveAttribute('href', detail.discordChannelUrl);
    expect(screen.queryByRole('link', { name: '자료실' })).not.toBeInTheDocument();
    expect(screen.getByText('아직 회차가 없습니다. 「회차 추가」로 만드세요.')).toBeVisible();
  });

  it('회차 추가는 킥오프를 만들지 않고, 정규 회차만 센다', async () => {
    mount();
    await setTimeAndAddMeetings();

    expect(screen.getByText('전체 5 · 예정 5')).toBeVisible();
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows).toHaveLength(5);
    expect(within(rows[0]).getByText('1')).toBeVisible();
    expect(screen.getByRole('button', { name: '킥오프 정하기' })).toBeVisible();
  });

  it('킥오프는 「킥오프 정하기」로만 정한다 — 1회차보다 앞이어야 하고, 표에서는 고치지 않는다', async () => {
    mount();
    await setTimeAndAddMeetings();
    const first = (screen.getByLabelText('1회차 일자 (KST)') as HTMLInputElement).value;

    await userEvent.click(screen.getByRole('button', { name: '킥오프 정하기' }));
    let dialog = screen.getByRole('dialog', { name: '킥오프 정하기' });
    // 처음 값은 1회차 한 주 전 · 반의 스터디 시각
    expect(within(dialog).getByLabelText(/일자/)).not.toHaveValue(first);
    expect(within(dialog).getByLabelText(/시작 시각/)).toHaveValue('20:30');

    const date = within(dialog).getByLabelText(/일자/);
    await userEvent.clear(date);
    await userEvent.type(date, first);
    await userEvent.click(within(dialog).getByRole('button', { name: '저장' }));
    expect(within(dialog).getByText('이 날에는 이미 1회차가 있습니다.')).toBeVisible();

    await userEvent.clear(date);
    await userEvent.type(date, '2020-01-01');
    await userEvent.click(within(dialog).getByRole('button', { name: '저장' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // 지난 날도 받는다. 킥오프는 맨 위 0회차 — 지울 수 없고, 칸을 고치지 않고, 발표자가 없다
    const kickoff = screen.getAllByRole('row')[1];
    expect(within(kickoff).getByText('0')).toBeVisible();
    expect(within(kickoff).queryByRole('checkbox')).not.toBeInTheDocument();
    expect(within(kickoff).queryByRole('textbox')).not.toBeInTheDocument();
    expect(within(kickoff).queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.getByText('전체 5 · 예정 5')).toBeVisible();

    await userEvent.click(screen.getByRole('button', { name: '킥오프 수정' }));
    dialog = screen.getByRole('dialog', { name: '킥오프 수정' });
    expect(within(dialog).getByLabelText(/일자/)).toHaveValue('2020-01-01');
  });

  it('발표자는 참여 명단의 활동 · 휴식 중인 사람 중에서 고르고, 같은 사람을 두 칸에 넣으면 저장이 막힌다', async () => {
    const { onDirtyChange } = mount();
    await setTimeAndAddMeetings();

    const p1 = await screen.findByRole('combobox', { name: '1회차 발표자1' });
    await waitFor(() => expect(within(p1).getAllByRole('option')).toHaveLength(3));
    expect(within(p1).queryByRole('option', { name: '박중단' })).not.toBeInTheDocument();

    await userEvent.selectOptions(p1, '김크루');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: '1회차 발표자2' }), '김크루');
    expect(screen.getByText('발표자1과 다른 사람을 골라 주세요.')).toBeVisible();
    expect(screen.getByText('고칠 칸 1개')).toBeVisible();
    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);

    await userEvent.selectOptions(screen.getByRole('combobox', { name: '1회차 발표자2' }), '이크루');
    await userEvent.click(screen.getByRole('button', { name: '저장' }));
    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    expect(screen.getByRole('combobox', { name: '1회차 발표자2' })).toHaveValue('p2');
  });

  it('칸 아래 오류 문구를 스크린리더가 그 칸의 설명으로 읽는다', async () => {
    mount();
    await setTimeAndAddMeetings();

    const date1 = screen.getByLabelText('1회차 일자 (KST)') as HTMLInputElement;
    const date2 = screen.getByLabelText('2회차 일자 (KST)');
    await userEvent.clear(date2);
    await userEvent.type(date2, date1.value);

    expect(date2).toHaveAttribute('aria-invalid', 'true');
    expect(date2).toHaveAccessibleDescription('이 날에는 이미 1회차가 있습니다.');
  });

  it('시간대 탭 묶음에 이름이 있다', async () => {
    mount();
    await setTimeAndAddMeetings();
    expect(screen.getByRole('tablist', { name: '일정 표시 시간대' })).toBeVisible();
  });

  it('체크박스로 고른 회차를 확인 모달을 거쳐 지운다 — 기본 포커스는 취소', async () => {
    mount();
    await setTimeAndAddMeetings();

    expect(screen.getByRole('button', { name: '삭제' })).toBeDisabled();
    await userEvent.click(screen.getByRole('checkbox', { name: '2회차 선택' }));
    await userEvent.click(screen.getByRole('checkbox', { name: '3회차 선택' }));
    await userEvent.click(screen.getByRole('button', { name: '삭제' }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/회차 2개\(2회차, 3회차\)를 지울까요\?/)).toBeVisible();
    await waitFor(() => expect(within(dialog).getByRole('button', { name: '취소' })).toHaveFocus());
    await userEvent.click(within(dialog).getByRole('button', { name: '삭제' }));

    expect(screen.getByText('전체 3 · 예정 3')).toBeVisible();
  });

  it('신청자 탭의 서버 반이 둘이면 반 칩이 서고, 발표자는 그 반 사람만 고른다', async () => {
    const twoGroups: ParticipantsResponse = {
      ...participants,
      groups: [
        { groupId: 1, name: '목요일반', isDefault: true, canDelete: false },
        { groupId: 2, name: '금요일반', isDefault: false, canDelete: false },
      ],
      participants: [participant(1, '김크루', 'ACTIVE'), { ...participant(2, '이크루', 'ACTIVE'), groupId: 2 }],
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(twoGroups))));
    const onGroup = vi.fn();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <ScheduleTab detail={detail} groupId='' onGroup={onGroup} onDirtyChange={vi.fn()} guard={(go) => go()} />
      </QueryClientProvider>,
    );

    // 처음엔 첫 반(목요일반) — 고른 칩이 채워진다
    const thu = await screen.findByRole('button', { name: '목요일반' });
    expect(thu).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: '금요일반' }));
    expect(onGroup).toHaveBeenCalledWith('2');

    await setTimeAndAddMeetings();
    const p1 = screen.getByRole('combobox', { name: '1회차 발표자1' });
    await waitFor(() => expect(within(p1).getAllByRole('option')).toHaveLength(2));
    expect(within(p1).getByRole('option', { name: '김크루' })).toBeInTheDocument();
    expect(within(p1).queryByRole('option', { name: '이크루' })).not.toBeInTheDocument();
  });
});
