import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AttendanceTab } from './AttendanceTab';
import type { Participant, ParticipantsResponse } from '@/features/participants/types';
import type { ApiStudyDetail } from '@/features/studies/types';

const detail = { id: 107, title: 'DDIA 2판', discordChannelUrl: null, driveUrl: null } as ApiStudyDetail;

const participant = (
  id: number,
  nickname: string,
  status: Participant['status'],
  discordNickname: string | null = null,
  participantRole: Participant['participantRole'] = 'MEMBER',
): Participant => ({
  participantId: id,
  accountId: id,
  nickname,
  discordNickname,
  email: `${id}@example.com`,
  regionGroup: 'KR',
  groupId: 1,
  participantRole,
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
    participant(1, '김크루', 'ACTIVE', 'kim_dev'),
    participant(2, '이크루', 'PAUSED', null, 'LEADER'),
    participant(3, '박중단', 'WITHDRAWN'),
  ],
};

const KEY = `bo_schedule:${detail.id}`;

/** 킥오프 · 지난 1회차 · 아직 오지 않은 2회차(발표자 김크루). */
function seedMeetings() {
  localStorage.setItem(
    KEY,
    JSON.stringify({
      groups: [{ id: '1', title: '기본반', time: { weekdays: [3], time: '20:00', tz: 'Asia/Seoul' } }],
      meetings: {
        '1': [
          { id: 'k', kind: 'kickoff', scheduledAt: '2026-01-01T11:00:00.000Z', title: '킥오프' },
          { id: 'm1', scheduledAt: '2026-01-08T11:00:00.000Z' },
          { id: 'm2', scheduledAt: '2099-01-08T11:00:00.000Z', presenter1: 'p1' },
        ],
      },
      rules: {},
    }),
  );
}

function mount() {
  const onDirtyChange = vi.fn();
  const onAddMeeting = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <AttendanceTab
        detail={detail}
        groupId=''
        onGroup={vi.fn()}
        onDirtyChange={onDirtyChange}
        guard={(go) => go()}
        zone='Asia/Seoul'
        onZone={vi.fn()}
        onGoCrew={vi.fn()}
        onAddMeeting={onAddMeeting}
      />
    </QueryClientProvider>,
  );
  return { onDirtyChange, onAddMeeting };
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

/** 출석부에서 그 사람의 줄. */
async function rowOf(name: string) {
  // 명단은 신청 결과 응답이 온 뒤에 채워진다
  const row = (await screen.findByTitle(name)).closest('tr');
  if (!row) throw new Error(`${name} 줄이 없다`);
  return row;
}

/** 줄의 출석 칸 — 킥오프 · 1회 · 2회 순. */
function cellsOf(row: HTMLElement) {
  return within(row).getAllByRole('button', { name: /^(미체크|출석|지각|결석|휴가)/ });
}

describe('출석 탭', () => {
  it('회차가 없는 반은 일정 탭으로 보낸다 — 스터디 시간이 없으면 스터디 시간부터', async () => {
    const { onAddMeeting } = mount();
    expect(screen.getByText('이 반은 아직 스터디 시간이 없습니다.')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: '스터디 시간 정하러 가기' }));
    expect(onAddMeeting).toHaveBeenCalled();
  });

  it('참여 명단의 활동 · 휴식 중인 사람이 줄, 그 반 회차가 열이다 — 발표 횟수는 일정의 발표자에서 센다', async () => {
    seedMeetings();
    mount();

    const kim = await rowOf('김크루');
    expect(screen.getByText('전체 2')).toBeVisible();
    expect(screen.queryByText('박중단')).not.toBeInTheDocument();
    // 넓은 화면은 옆 열(가리키면 전체), 휴대폰은 닉네임 아래
    expect(within(kim).getByTitle('kim_dev')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /킥오프/ })).toBeVisible();
    expect(screen.getByRole('columnheader', { name: /2회/ })).toBeVisible();
    // 2회차 발표자 — 발표 횟수 1, 칸에 발표 표시
    expect(within(kim).getByText('1')).toBeVisible();
    expect(cellsOf(kim)[2]).toHaveAccessibleName('미체크 · 발표');
  });

  it('칸을 누르면 상태가 돌고, 출석률은 정규 회차만 센다 — 저장하면 남는다', async () => {
    seedMeetings();
    const { onDirtyChange } = mount();
    const kim = await rowOf('김크루');
    const [kickoff, first] = cellsOf(kim);

    // 킥오프는 출석률에 넣지 않는다
    await userEvent.click(kickoff);
    expect(kickoff).toHaveAccessibleName('출석 · 저장되지 않음');
    expect(within(kim).queryByText('100%')).not.toBeInTheDocument();

    await userEvent.click(first); // 출석
    await userEvent.click(first); // 지각
    expect(first).toHaveAccessibleName('지각 · 저장되지 않음');
    expect(within(kim).getByText('50%')).toBeVisible();
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);

    await userEvent.click(screen.getByRole('button', { name: '저장' }));
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    expect(cellsOf(await rowOf('김크루'))[1]).toHaveAccessibleName('지각');
    expect(JSON.parse(localStorage.getItem(KEY)!).attendance['1'].p1).toEqual({ k: 'present', m1: 'late' });
  });

  it('고른 사람의 한 회차를 한 번에 바꾼다 — 고르기 전에는 잠겨 있다', async () => {
    seedMeetings();
    mount();
    await rowOf('김크루');

    expect(screen.getByRole('combobox', { name: '바꿀 출석 상태' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '참여 중단' })).toBeDisabled();
    await userEvent.click(screen.getByRole('checkbox', { name: '전체 선택' }));
    expect(screen.getByText('2명 선택')).toBeVisible();

    await userEvent.selectOptions(screen.getByRole('combobox', { name: '바꿀 회차' }), '1회 · 1/08');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: '바꿀 출석 상태' }), '결석');
    expect(cellsOf(await rowOf('김크루'))[1]).toHaveAccessibleName('결석 · 저장되지 않음');
    expect(cellsOf(await rowOf('이크루'))[1]).toHaveAccessibleName('결석 · 저장되지 않음');
  });

  it('참여 중단은 확인 창을 거쳐 저장되고, 뒤 회차는 비고 그 회차 발표자에서 빠진다', async () => {
    seedMeetings();
    mount();
    await rowOf('김크루');

    await userEvent.click(screen.getByRole('checkbox', { name: '김크루 선택' }));
    await userEvent.click(screen.getByRole('button', { name: '참여 중단' }));
    expect(screen.getByText('중단 예정 1명')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: '저장' }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('김크루 님의 참여를 중단하고 저장할까요?')).toBeVisible();
    await waitFor(() => expect(within(dialog).getByRole('button', { name: '취소' })).toHaveFocus());
    await userEvent.click(within(dialog).getByRole('button', { name: '저장' }));

    const kim = await rowOf('김크루');
    expect(within(kim).getByText('참여 중단')).toBeInTheDocument();
    expect(within(kim).queryByRole('checkbox')).not.toBeInTheDocument();
    // 지난 회차 칸은 남고, 아직 오지 않은 2회차는 「-」
    expect(cellsOf(kim)).toHaveLength(2);
    const saved = JSON.parse(localStorage.getItem(KEY)!);
    expect(saved.withdrawn['1'].p1).toBeTruthy();
    expect(saved.meetings['1'].find((m: { id: string }) => m.id === 'm2').presenter1).toBeUndefined();
  });

  it('네비게이터는 역할 칩이 붙고, 고른 사람에 섞이면 참여 중단이 잠긴다 — 출석 일괄 변경은 된다', async () => {
    seedMeetings();
    mount();
    const lee = await rowOf('이크루');
    expect(within(lee).getByText('네비게이터')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('checkbox', { name: '김크루 선택' }));
    expect(screen.getByRole('button', { name: '참여 중단' })).toBeEnabled();
    await userEvent.click(screen.getByRole('checkbox', { name: '이크루 선택' }));
    expect(screen.getByRole('button', { name: '참여 중단' })).toBeDisabled();
    expect(screen.getByText('네비게이터는 참여 중단할 수 없습니다. 캡틴에게 문의하세요.')).toBeVisible();
    expect(screen.getByRole('combobox', { name: '바꿀 출석 상태' })).toBeEnabled();
  });
});
