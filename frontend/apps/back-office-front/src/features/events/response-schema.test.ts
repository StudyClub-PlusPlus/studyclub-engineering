import { describe, expect, it } from 'vitest';

import { eventDetailSchema, eventMailPreviewSchema, eventRegistrationPageSchema } from '@/features/events/response-schema';

// specs/event · event-status · event-participant · event-mail 의 응답 예시 모양이 그대로 통과해야 한다.
describe('행사 API 응답 스키마', () => {
  it('운영 상세 예시를 받는다', () => {
    const body = {
      eventId: 7,
      version: 3,
      title: '연말 네트워킹 밋업',
      summary: '한 줄',
      description: '본문',
      timeZone: 'Asia/Seoul',
      startsAt: '2026-12-05T10:00:00Z',
      endsAt: '2026-12-05T13:00:00Z',
      effectiveEndsAt: '2026-12-05T13:00:00Z',
      deadlineAt: '2026-12-03T14:59:00Z',
      format: 'HYBRID',
      offline: { capacity: 40, location: '서울' },
      online: { capacity: 100, url: 'https://meet.example.com/abc' },
      confirmation: 'REVIEW',
      status: 'PUBLISHED',
      displayStatus: 'RECRUITING',
      publishedAt: '2026-11-18T05:00:00Z',
      questions: [{ questionId: 'q_7f3a', label: '동기', type: 'TEXTAREA', required: true, options: [] }],
      seats: [{ channel: 'ONLINE', capacity: 100, pending: 3, confirmed: 41, remaining: 56 }],
      canEdit: true,
      canChangeConfirmation: true,
      canSetFutureStart: true,
      removableChannels: [],
      canClose: true,
      canReopen: false,
      reopenBlockedReason: null,
      canCancel: true,
      hasCancellationRecipients: true,
      cancellationRecipientCount: 84,
      createdAt: '2026-11-18T05:00:00Z',
      updatedAt: '2026-11-21T08:12:00Z',
    };
    expect(eventDetailSchema.safeParse(body).success).toBe(true);
    expect(eventDetailSchema.safeParse({ ...body, displayStatus: '진행 중' }).success).toBe(false);
  });

  it('탈퇴한 회원 행은 닉네임·이메일이 null 이다', () => {
    const result = eventRegistrationPageSchema.safeParse({
      canManageRegistrations: false,
      pendingCount: 0,
      items: [
        { registrationId: 251, accountId: 17, nickname: null, accountDeleted: true, maskedEmail: null, channel: 'OFFLINE', status: 'CANCELLED', createdAt: '2026-11-18T09:40:00Z', canConfirm: false, canDecline: false, canCancel: false },
      ],
      total: 1,
      offset: 0,
      limit: 20,
    });
    expect(result.success).toBe(true);
  });

  it('템플릿이 없는 메일 미리보기는 제목·본문이 null 이다', () => {
    expect(
      eventMailPreviewSchema.safeParse({
        type: 'ANNOUNCEMENT',
        audience: 'ALL',
        templateId: null,
        templateExists: false,
        subject: null,
        body: null,
        format: null,
        displayTimeZone: 'Asia/Seoul',
        recipientCount: 0,
        canSend: false,
        blockedReason: 'TEMPLATE_MISSING',
      }).success,
    ).toBe(true);
  });
});
