import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ScheduleTab } from './ScheduleTab';
import type { ApplicationsResponse } from '@/features/applications/types';
import type { ApiStudyDetail } from '@/features/studies/types';

const detail = {
  id: 107,
  title: 'DDIA 2판',
  discordChannelUrl: 'https://discord.com/channels/1/2',
  driveUrl: null,
} as ApiStudyDetail;

const applicant = (id: number, name: string, status: 'APPROVED' | 'PENDING') => ({
  id,
  recruitmentId: 3,
  status,
  applicantName: name,
  discordNickname: null,
  email: null,
  submittedAt: '2026-10-08T23:30:00Z',
  previousParticipationCount: 0,
  completionRate: null,
  availableDays: [],
  scheduleAgreed: null,
  answers: {},
});

const applications: ApplicationsResponse = {
  respondentCount: 3,
  capacity: null,
  canApprove: true,
  approvalBlockedReason: null,
  announcementUrl: null,
  questions: [],
  applications: [
    applicant(1, '김크루', 'APPROVED'),
    applicant(2, '이크루', 'APPROVED'),
    applicant(3, '박대기', 'PENDING'),
  ],
};

function mount(onDirtyChange = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ScheduleTab detail={detail} onDirtyChange={onDirtyChange} guard={(go) => go()} />
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
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(applications))));
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

  it('반복으로 회차를 만들면 킥오프가 한 주 전에 함께 생기고, 정규 회차만 센다', async () => {
    mount();
    await setTimeAndAddMeetings();

    expect(screen.getByText('전체 5 · 예정 5')).toBeVisible();
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows).toHaveLength(6);
    expect(within(rows[0]).getByText('0')).toBeVisible();
    // 킥오프는 지울 수 없고 발표자가 없다
    expect(within(rows[0]).queryByRole('checkbox')).not.toBeInTheDocument();
    expect(within(rows[0]).queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('발표자는 승인된 신청자 중에서 고르고, 같은 사람을 두 칸에 넣으면 저장이 막힌다', async () => {
    const { onDirtyChange } = mount();
    await setTimeAndAddMeetings();

    const p1 = await screen.findByRole('combobox', { name: '1회차 발표자1' });
    await waitFor(() => expect(within(p1).getAllByRole('option')).toHaveLength(3));
    expect(within(p1).queryByRole('option', { name: '박대기' })).not.toBeInTheDocument();

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
    expect(screen.getByRole('combobox', { name: '1회차 발표자2' })).toHaveValue('a2');
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
});
