import { afterEach, describe, expect, it, vi } from 'vitest';

import repository from './repository';

afterEach(() => vi.unstubAllGlobals());

describe('출석 API 전송', () => {
  it('반 ID·중단자 포함 조건·취소 신호를 보존한다', async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          study: { id: 10, title: '스터디', participantCount: 0, totalMeetings: 0, avgAttendanceRate: null },
          meetings: [],
          participants: [],
        }),
      ),
    );
    vi.stubGlobal('fetch', fetch);
    const signal = new AbortController().signal;
    await expect(repository.fetchBook(10, 3, signal)).resolves.toEqual({
      study: { id: 10, title: '스터디', participantCount: 0, totalMeetings: 0, avgAttendanceRate: null },
      meetings: [],
      participants: [],
    });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/admin\/studies\/10\/attendances\?studyGroupId=3&includeWithdrawn=true$/),
      expect.objectContaining({ signal, credentials: 'include' }),
    );
  });
  it('출석과 참여 중단을 하나의 JSON 요청으로 저장한다', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetch);
    const payload = {
      studyGroupId: 3,
      updates: [{ meetingId: 2, participantId: 4, status: 'PRESENT' as const }],
      withdrawals: [5],
    };
    await expect(repository.save(10, payload)).resolves.toBeNull();
    expect(fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/admin\/studies\/10\/attendances$/),
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    );
  });
});
