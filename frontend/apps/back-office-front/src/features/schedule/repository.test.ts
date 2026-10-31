import { afterEach, describe, expect, it, vi } from 'vitest';

import repository from './repository';
import { ApiError } from '@/lib/http';

afterEach(() => vi.unstubAllGlobals());

describe('일정 API 전송', () => {
  it('조회에 취소 신호와 인증 쿠키를 전달한다', async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          studyGroup: {
            id: 3,
            name: '반',
            timezone: 'Asia/Seoul',
            startTime: null,
            navigatorName: null,
            rules: null,
          },
          me: { participantId: null, canEdit: true },
          participants: [],
          meetings: [],
        }),
      ),
    );
    vi.stubGlobal('fetch', fetch);
    const signal = new AbortController().signal;
    await expect(repository.fetchMeetings(10, 3, signal)).resolves.toEqual({
      studyGroup: { id: 3, name: '반', timezone: 'Asia/Seoul', startTime: null, navigatorName: null, rules: null },
      me: { participantId: null, canEdit: true },
      participants: [],
      meetings: [],
    });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/admin/studies/10/groups/3/meetings'),
      expect.objectContaining({ signal, credentials: 'include' }),
    );
  });

  it('회차·킥오프·규칙 쓰기의 메서드와 JSON 본문을 보존한다', async () => {
    const fetch = vi.fn().mockImplementation(async () => new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetch);
    const at = '2026-11-05T11:00:00Z';
    await expect(repository.setKickoff(10, 3, at)).resolves.toBeNull();
    await repository.createMeetings(10, 3, { scheduledAts: [at], title: null });
    await repository.updateMeeting(10, 3, 7, { scheduledAt: at, title: '제목', presenter1ParticipantId: null });
    await repository.deleteMeetings(10, 3, [7, 8]);
    await repository.saveRules(10, 3, null);
    expect(
      fetch.mock.calls.map(([url, init]) => ({
        path: new URL(url).pathname,
        method: init.method,
        body: JSON.parse(init.body),
      })),
    ).toEqual([
      { path: '/api/admin/studies/10/groups/3/kickoff', method: 'PUT', body: { scheduledAt: at } },
      { path: '/api/admin/studies/10/groups/3/meetings', method: 'POST', body: { scheduledAts: [at], title: null } },
      {
        path: '/api/admin/studies/10/groups/3/meetings/7',
        method: 'PUT',
        body: { scheduledAt: at, title: '제목', presenter1ParticipantId: null },
      },
      { path: '/api/admin/studies/10/groups/3/meetings', method: 'DELETE', body: { meetingIds: [7, 8] } },
      { path: '/api/admin/studies/10/groups/3/rules', method: 'PUT', body: { rules: null } },
    ]);
    for (const [, init] of fetch.mock.calls)
      expect(init).toMatchObject({ credentials: 'include', headers: { 'Content-Type': 'application/json' } });
  });

  it('서버 오류의 상태 코드와 메시지를 보존한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ errorCode: 'FORBIDDEN', errorMessage: '권한이 없습니다.' }), { status: 403 }),
        ),
    );
    await expect(repository.deleteMeetings(10, 3, [7])).rejects.toEqual(new ApiError(403, '권한이 없습니다.'));
  });
});
