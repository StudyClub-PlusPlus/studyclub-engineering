import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { ApiError, http } from './http';
import { apiAttendanceSchema } from '@/features/attendance/response-schema';
import { apiDashboardSummarySchema } from '@/features/dashboard/response-schema';
import { apiNotificationPageSchema } from '@/features/notifications/response-schema';

afterEach(() => vi.unstubAllGlobals());
const reply = (body: unknown) => vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(body)));

describe('HTTP response contracts', () => {
  it('rejects a malformed nested attendance status before returning data', async () => {
    reply({
      study: { id: 1, title: '스터디', participantCount: 1, totalMeetings: 1, avgAttendanceRate: null },
      meetings: [],
      participants: [
        {
          participantId: 1,
          displayName: '크루',
          participantRole: 'MEMBER',
          captain: false,
          participantStatus: 'ACTIVE',
          leftAt: null,
          attendanceRate: null,
          attendances: [{ meetingId: 1, status: 'TYPO' }],
        },
      ],
    });
    await expect(http('/attendance', apiAttendanceSchema)).rejects.toMatchObject({
      name: 'ApiResponseError',
      cause: expect.any(z.ZodError),
      message: '서버 응답 형식이 올바르지 않습니다. 잠시 후 다시 시도해 주세요.',
    });
  });
  it('rejects a wrong required field type', async () => {
    reply({ items: [], total: '4', offset: 0, limit: 20 });
    await expect(http('/notifications', apiNotificationPageSchema)).rejects.toMatchObject({
      name: 'ApiResponseError',
      cause: expect.any(z.ZodError),
      message: '서버 응답 형식이 올바르지 않습니다. 잠시 후 다시 시도해 주세요.',
    });
  });
  it('accepts optional aggregate values and nullable rates', async () => {
    const body = {
      asOf: '2026-10-31',
      timeZone: 'Asia/Seoul',
      attendanceRate: null,
      errors: { participation: { errorCode: 'UNAVAILABLE', errorMessage: '잠시 후 다시 시도' } },
    };
    reply(body);
    await expect(http('/summary', apiDashboardSummarySchema)).resolves.toEqual(body);
  });
  it('accepts future notification statuses while validating the row', async () => {
    const body = {
      items: [
        {
          id: 1,
          eventType: 'USER_REGISTERED',
          recipientType: 'EMAIL',
          recipientValue: 'a***',
          status: 'CANCELLED',
          templateId: 1,
          sentAt: null,
          createdAt: '2026-10-31',
          canResend: false,
        },
      ],
      total: 1,
      offset: 0,
      limit: 20,
    };
    reply(body);
    await expect(http('/notifications', apiNotificationPageSchema)).resolves.toEqual(body);
  });
  it('accepts an empty mutation response but rejects empty required data', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async () => new Response(null, { status: 204 })),
    );
    await expect(http('/mutation', z.null())).resolves.toBeNull();
    await expect(http('/list', apiNotificationPageSchema)).rejects.toMatchObject({
      name: 'ApiResponseError',
      cause: expect.any(z.ZodError),
      message: '서버 응답 형식이 올바르지 않습니다. 잠시 후 다시 시도해 주세요.',
    });
  });
  it('rejects malformed nonempty JSON even for an empty mutation contract', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{bad')));
    await expect(http('/mutation', z.null())).rejects.toMatchObject({
      name: 'ApiResponseError',
      cause: expect.any(SyntaxError),
    });
  });
  it('preserves non-JSON HTTP error status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Bad gateway', { status: 502 })));
    await expect(http('/list', apiNotificationPageSchema)).rejects.toBeInstanceOf(ApiError);
  });
  it('keeps the backend errorCode so screens can branch on it', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ errorCode: 'EVENT_VERSION_CONFLICT', errorMessage: '버전' }), { status: 409 }),
      ),
    );
    await expect(http('/list', apiNotificationPageSchema)).rejects.toMatchObject({
      status: 409,
      code: 'EVENT_VERSION_CONFLICT',
      message: '버전',
    });
  });
});

describe('갱신 장애와 인증 만료 구분', () => {
  it('액세스 만료 후 갱신되면 원래 요청을 한 번만 다시 보낸다', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({}, { status: 401 }))
      .mockResolvedValueOnce(Response.json({ ok: true }))
      .mockResolvedValueOnce(Response.json({ saved: true }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      http('/api/admin/studies', z.object({ saved: z.boolean() }), { method: 'PATCH', body: '{}' }),
    ).resolves.toEqual({ saved: true });
    expect(fetchMock.mock.calls[2]).toEqual(fetchMock.mock.calls[0]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('refresh가 무효하면 원래 401을 전달하고 무한 재시도하지 않는다', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => Response.json({ message: 'expired' }, { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(http('/api/admin/studies', z.null())).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([429, 500, 502, 503, 504])('갱신의 %i 오류를 인증 만료 401로 바꾸지 않는다', async (status) => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ message: 'expired access' }, { status: 401 }))
      .mockResolvedValueOnce(Response.json({ message: '잠시 후 다시 시도해 주세요.' }, { status }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(http('/api/admin/studies', z.null())).rejects.toMatchObject({
      status,
      message: '잠시 후 다시 시도해 주세요.',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
