import { studies } from '@studyclub/mock';
import { fireEvent, render, screen, waitFor, within, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ScheduleTab } from './ScheduleTab';
import { setUser } from '@/features/auth/auth';
import { createStudyMeetings, updateStudyMeeting } from '@/features/schedule/repository';
import { type ApiMeetingList } from '@/features/schedule/types';

vi.mock('@/features/schedule/repository', () => ({
  createStudyMeetings: vi.fn().mockResolvedValue(undefined),
  updateStudyMeeting: vi.fn().mockResolvedValue(undefined),
  deleteStudyMeetings: vi.fn().mockResolvedValue(undefined),
  registerPresenter: vi.fn().mockResolvedValue(undefined),
  unregisterPresenter: vi.fn().mockResolvedValue(undefined),
}));
const group = { id: '10', name: '수요일반', timeZone: 'Asia/Seoul', startAt: '20:30' };
const data: ApiMeetingList = {
  study: { id: 20, title: 'DDIA', discordChannelUrl: null, driveUrl: null },
  studyGroup: {
    id: 10,
    name: group.name,
    timezone: group.timeZone,
    startTime: group.startAt,
    navigatorName: '홍길동',
    rules: null,
  },
  me: { participantId: 1, canEdit: true },
  participants: [],
  meetings: [4, 11, 18].map((day, index) => ({
    id: index + 1,
    type: 'REGULAR',
    number: index + 1,
    scheduledAt: `2026-11-${String(day).padStart(2, '0')}T11:30:00Z`,
    title: '',
    presenter1: null,
    presenter2: null,
    started: false,
  })),
};
type Scope = Pick<typeof screen, 'getByRole'>;
function timeInput(name: string | RegExp, scope: Scope) {
  return scope.getByRole('textbox', { name }) as HTMLInputElement;
}
function timeValue(name: string | RegExp, scope: Scope = screen) {
  return timeInput(name, scope).value;
}
function setTime(name: string | RegExp, value: string, scope: Scope = screen) {
  fireEvent.change(timeInput(name, scope), { target: { value } });
}
function setup(canEdit = true, meetingData = data, inputGroup = group) {
  return render(
    <ScheduleTab
      study={{ ...studies[0], id: '20' }}
      group={inputGroup}
      groupId={10}
      meetingData={meetingData}
      refetchMeetings={vi.fn().mockResolvedValue(undefined)}
      canEdit={canEdit}
      onDirty={vi.fn()}
    />,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-30T12:00:00Z'));
  setUser({
    id: 1,
    nickname: '테스트',
    email: 'test@example.com',
    picture: null,
    role: 'MEMBER',
    timeZone: 'America/New_York',
  });
});
/** 표 위 시간대 고르기 — 열고 그 지역 줄을 누른다. */
function pickZone(zone: string) {
  const place: Record<string, string> = { 'Asia/Seoul': '한국 · 서울', 'America/Los_Angeles': '미국 · 로스앤젤레스' };
  fireEvent.click(screen.getByLabelText('시간대'));
  fireEvent.click(screen.getByRole('option', { name: new RegExp(place[zone]!) }));
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.useRealTimers();
});

describe('schedule timezone interaction', () => {
  it('starts from the profile, lets editors switch regions without saving, and preserves UTC on title-only edits', async () => {
    setup();
    expect(timeValue('1회차 시작 시각 (EST)', screen)).toBe('06:30');
    pickZone('America/Los_Angeles');
    expect(timeValue('1회차 시작 시각 (PST)', screen)).toBe('03:30');
    expect(updateStudyMeeting).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('1회차 제목'), { target: { value: '새 제목' } });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() =>
      expect(updateStudyMeeting).toHaveBeenCalledWith(
        20,
        1,
        expect.objectContaining({ scheduledAt: '2026-11-04T11:30:00Z', title: '새 제목' }),
      ),
    );
  });

  it('opens additions in the profile zone independently of the table selection and sends UTC', async () => {
    setup();
    pickZone('America/Los_Angeles');
    fireEvent.click(screen.getByRole('button', { name: '회차 추가' }));
    const modal = within(screen.getByRole('dialog'));
    expect(timeValue(/시작 시각/, modal)).toBe('06:30');
    expect(modal.getByText(/밴쿠버\(PCT\).*04:30/)).toBeInTheDocument();
    expect(modal.getByText(/LA\(PST\).*03:30/)).toBeInTheDocument();
    fireEvent.click(modal.getByRole('button', { name: '추가' }));
    fireEvent.click(await screen.findByRole('button', { name: '저장' }));
    await waitFor(() =>
      expect(createStudyMeetings).toHaveBeenCalledWith(
        20,
        expect.objectContaining({ studyGroupId: 10, scheduledAts: ['2026-11-25T11:30:00.000Z'] }),
      ),
    );
  });

  it('converts an edited profile time into the UTC request', async () => {
    setup();
    setTime('1회차 시작 시각 (EST)', '07:30', screen);
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() =>
      expect(updateStudyMeeting).toHaveBeenCalledWith(
        20,
        1,
        expect.objectContaining({ scheduledAt: '2026-11-04T12:30:00.000Z' }),
      ),
    );
  });

  it('preserves the second occurrence of a repeated autumn hour on title-only edits', async () => {
    setup(
      true,
      { ...data, meetings: [{ ...data.meetings[0], scheduledAt: '2026-11-01T09:30:00Z' }] },
      { ...group, timeZone: 'America/Los_Angeles', startAt: '01:30' },
    );
    fireEvent.change(screen.getByLabelText('1회차 제목'), { target: { value: '시각 그대로' } });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() =>
      expect(updateStudyMeeting).toHaveBeenCalledWith(
        20,
        1,
        expect.objectContaining({ scheduledAt: '2026-11-01T09:30:00Z' }),
      ),
    );
  });

  it('keeps an empty wall time visible and prevents saving or switching until it is valid', () => {
    setup();
    setTime('1회차 시작 시각 (EST)', '', screen);
    expect(timeValue('1회차 시작 시각 (EST)', screen)).toBe('');
    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
    expect(screen.getByLabelText('시간대')).toBeDisabled();
  });

  it('shows participant schedules in the profile timezone without a selector', () => {
    setup(false);
    expect(screen.queryByLabelText('시간대')).not.toBeInTheDocument();
    expect(screen.getByText('내 시간대: 뉴욕·토론토(ET)')).toBeInTheDocument();
    expect(screen.getAllByText('06:30')).toHaveLength(3);
  });
});

describe('google calendar link', () => {
  it('다음 회차를 구글 캘린더 일정 만들기 화면으로 새 탭에 연다', () => {
    setup(false);
    const link = screen.getByRole('link', { name: '다음 회차 구글 캘린더에 추가' });
    expect(link).toHaveAttribute('target', '_blank');
    const url = new URL(link.getAttribute('href')!);
    expect(url.searchParams.get('text')).toBe('DDIA 1회차');
    expect(url.searchParams.get('dates')).toBe('20261104T113000Z/20261104T123000Z');
  });

  it('남은 회차가 없으면 링크를 두지 않는다', () => {
    vi.setSystemTime(new Date('2026-12-01T00:00:00Z'));
    setup(false);
    expect(screen.queryByRole('link', { name: '다음 회차 구글 캘린더에 추가' })).not.toBeInTheDocument();
  });
});

describe('DST review regressions', () => {
  it('retains the saved second occurrence after clearing and re-entering the same date and time', async () => {
    const original = '2026-11-01T06:30:00Z';
    setup(true, { ...data, meetings: [{ ...data.meetings[0], scheduledAt: original }] });
    setTime('1회차 시작 시각 (EST)', '', screen);
    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
    setTime('1회차 시작 시각 (EST)', '01:30', screen);
    fireEvent.change(screen.getByLabelText('1회차 일자 (EST)'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('1회차 일자 (EST)'), { target: { value: '2026-11-01' } });
    pickZone('Asia/Seoul');
    expect(timeValue('1회차 시작 시각 (KST)', screen)).toBe('15:30');
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() =>
      expect(updateStudyMeeting).toHaveBeenCalledWith(
        20,
        1,
        expect.objectContaining({ scheduledAt: '2026-11-01T06:30:00.000Z' }),
      ),
    );
  });

  it('asks before saving a newly entered ambiguous time and saves the selected occurrence', async () => {
    setup(true, { ...data, meetings: [{ ...data.meetings[0], scheduledAt: '2026-11-01T07:30:00Z' }] });
    setTime('1회차 시작 시각 (EST)', '01:30', screen);
    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
    expect(screen.getByLabelText('시간대')).toBeDisabled();
    expect(screen.getByLabelText('1회차 시각 구분')).toHaveValue('');
    fireEvent.change(screen.getByLabelText('1회차 시각 구분'), { target: { value: '2026-11-01T06:30:00.000Z' } });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() =>
      expect(updateStudyMeeting).toHaveBeenCalledWith(
        20,
        1,
        expect.objectContaining({ scheduledAt: '2026-11-01T06:30:00.000Z' }),
      ),
    );
  });

  it('shows the one-year group-calendar limit before adding and accepts the corrected end date', () => {
    setup(true, { ...data, meetings: [] });
    fireEvent.click(screen.getByRole('button', { name: '회차 추가' }));
    const modal = within(screen.getByRole('dialog'));
    fireEvent.change(modal.getByRole('textbox', { name: /일자/ }), { target: { value: '2027-11-05' } });
    setTime(/시작 시각/, '10:30', modal);
    fireEvent.click(modal.getByRole('button', { name: '매일' }));
    // 뉴욕 10:30 은 EDT 면 서울 같은 날, EST 면 서울 다음 날 — 입력 1년이 반 달력에서는 1년 하루가 된다
    fireEvent.change(modal.getByRole('textbox', { name: /종료일/ }), { target: { value: '2028-11-05' } });
    expect(modal.getByText(/서울\(KST\) 기준으로 1년 범위를 넘어요/)).toBeInTheDocument();
    expect(modal.getByRole('button', { name: '추가' })).toBeDisabled();
    expect(createStudyMeetings).not.toHaveBeenCalled();
    fireEvent.change(modal.getByRole('textbox', { name: /종료일/ }), { target: { value: '2028-11-04' } });
    // 봄 서머타임 시작 때 뉴욕 두 날이 서울 같은 날이 되어 하루를 건너뛴다 — 366일 중 365개
    expect(modal.getByRole('button', { name: '회차 365개 추가' })).toBeEnabled();
  });

  it('carries an explicitly selected recurring occurrence through preview, pending rows, and the API', async () => {
    setup(true, { ...data, meetings: [] });
    fireEvent.click(screen.getByRole('button', { name: '회차 추가' }));
    const modal = within(screen.getByRole('dialog'));
    fireEvent.change(modal.getByRole('textbox', { name: /일자/ }), { target: { value: '2026-11-01' } });
    setTime(/시작 시각/, '01:30', modal);
    fireEvent.click(modal.getByRole('button', { name: '매일' }));
    fireEvent.change(modal.getByRole('textbox', { name: /종료일/ }), { target: { value: '2026-11-02' } });
    expect(modal.getByRole('button', { name: '추가' })).toBeDisabled();
    fireEvent.change(modal.getByLabelText('2026-11-01 시각 구분'), { target: { value: '2026-11-01T06:30:00.000Z' } });
    expect(modal.getByText(/서울\(KST\) 15:30/)).toBeInTheDocument();
    fireEvent.click(modal.getByRole('button', { name: '회차 2개 추가' }));
    fireEvent.click(await screen.findByRole('button', { name: '저장' }));
    await waitFor(() =>
      expect(createStudyMeetings).toHaveBeenCalledWith(
        20,
        expect.objectContaining({ scheduledAts: ['2026-11-01T06:30:00.000Z', '2026-11-02T06:30:00.000Z'] }),
      ),
    );
  });
});
