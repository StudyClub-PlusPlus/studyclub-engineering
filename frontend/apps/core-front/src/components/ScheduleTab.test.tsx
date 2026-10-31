import { studies } from '@studyclub/mock';
import { fireEvent, render, screen, waitFor, within, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ScheduleTab } from './ScheduleTab';
import { setUser } from '@/lib/auth';
import { createStudyMeetings, updateStudyMeeting, type ApiMeetingList } from '@/lib/joined-detail-api';

vi.mock('@/lib/joined-detail-api', () => ({
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
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.useRealTimers();
});

describe('schedule timezone interaction', () => {
  it('starts from the profile, lets editors switch regions without saving, and preserves UTC on title-only edits', async () => {
    setup();
    expect(screen.getByLabelText('1회차 시작 시각 (EST)')).toHaveValue('06:30');
    fireEvent.change(screen.getByLabelText('시간대'), { target: { value: 'America/Los_Angeles' } });
    expect(screen.getByLabelText('1회차 시작 시각 (PST)')).toHaveValue('03:30');
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
    fireEvent.change(screen.getByLabelText('시간대'), { target: { value: 'America/Los_Angeles' } });
    fireEvent.click(screen.getByRole('button', { name: '회차 추가' }));
    const modal = within(screen.getByRole('dialog'));
    expect(modal.getByLabelText(/시작 시각/)).toHaveValue('06:30');
    expect(modal.getByText(/밴쿠버\(PCT\).*04:30/)).toBeInTheDocument();
    expect(modal.getByText(/LA\(PST\).*03:30/)).toBeInTheDocument();
    fireEvent.click(modal.getByRole('button', { name: '추가' }));
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() =>
      expect(createStudyMeetings).toHaveBeenCalledWith(
        20,
        expect.objectContaining({ studyGroupId: 10, scheduledAts: ['2026-11-25T11:30:00.000Z'] }),
      ),
    );
  });

  it('converts an edited profile time into the UTC request', async () => {
    setup();
    fireEvent.change(screen.getByLabelText('1회차 시작 시각 (EST)'), { target: { value: '07:30' } });
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
    fireEvent.change(screen.getByLabelText('1회차 시작 시각 (EST)'), { target: { value: '' } });
    expect(screen.getByLabelText('1회차 시작 시각 (EST)')).toHaveValue('');
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
