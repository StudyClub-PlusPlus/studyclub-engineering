import { z } from 'zod';

const channel = z.enum(['ONLINE', 'OFFLINE']);
const questionType = z.enum(['TEXT', 'TEXTAREA', 'RADIO', 'CHECKBOX']);
const displayStatus = z.enum(['RECRUITING', 'FULL', 'RECRUITMENT_CLOSED', 'ENDED', 'CANCELLED']);
const storedStatus = z.enum(['PUBLISHED', 'CLOSED', 'CANCELLED']);
const registrationStatus = z.enum(['PENDING', 'CONFIRMED', 'DECLINED', 'CANCELLED']);

const pageMeta = { total: z.number(), offset: z.number(), limit: z.number() };

export const eventPageSchema = z.object({
  items: z.array(
    z.object({
      eventId: z.number(),
      title: z.string(),
      startsAt: z.string(),
      endsAt: z.string().nullable(),
      effectiveEndsAt: z.string(),
      timeZone: z.string(),
      status: storedStatus,
      displayStatus,
    }),
  ),
  ...pageMeta,
});

export const eventDetailSchema = z.object({
  eventId: z.number(),
  version: z.number(),
  title: z.string(),
  summary: z.string(),
  description: z.string(),
  timeZone: z.string(),
  startsAt: z.string(),
  endsAt: z.string().nullable(),
  effectiveEndsAt: z.string(),
  deadlineAt: z.string(),
  format: z.enum(['ONLINE', 'OFFLINE', 'HYBRID']),
  offline: z.object({ capacity: z.number(), location: z.string() }).nullable(),
  online: z.object({ capacity: z.number(), url: z.string().nullable() }).nullable(),
  confirmation: z.enum(['AUTO', 'REVIEW']),
  status: storedStatus,
  displayStatus,
  publishedAt: z.string(),
  questions: z.array(
    z.object({
      questionId: z.string(),
      label: z.string(),
      type: questionType,
      required: z.boolean(),
      options: z.array(z.string()),
    }),
  ),
  seats: z.array(
    z.object({
      channel,
      capacity: z.number(),
      pending: z.number(),
      confirmed: z.number(),
      remaining: z.number(),
    }),
  ),
  canEdit: z.boolean(),
  canChangeConfirmation: z.boolean(),
  canSetFutureStart: z.boolean(),
  removableChannels: z.array(channel),
  // event-status 스펙이 상세 응답에 더하는 판정 필드
  canClose: z.boolean(),
  canReopen: z.boolean(),
  reopenBlockedReason: z.enum(['DEADLINE_PASSED', 'STARTED']).nullable(),
  canCancel: z.boolean(),
  hasCancellationRecipients: z.boolean(),
  cancellationRecipientCount: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const eventRegistrationRowSchema = z.object({
  registrationId: z.number(),
  accountId: z.number(),
  nickname: z.string().nullable(),
  accountDeleted: z.boolean(),
  maskedEmail: z.string().nullable(),
  channel,
  status: registrationStatus,
  createdAt: z.string(),
  canConfirm: z.boolean(),
  canDecline: z.boolean(),
  canCancel: z.boolean(),
});

export const eventRegistrationPageSchema = z.object({
  canManageRegistrations: z.boolean(),
  pendingCount: z.number(),
  items: z.array(eventRegistrationRowSchema),
  ...pageMeta,
});

export const eventRegistrationDetailSchema = z.object({
  registrationId: z.number(),
  nickname: z.string().nullable(),
  accountDeleted: z.boolean(),
  channel,
  status: registrationStatus,
  createdAt: z.string(),
  questions: z.array(
    z.object({
      questionId: z.string(),
      label: z.string(),
      type: questionType,
      required: z.boolean(),
      options: z.array(z.string()),
      answer: z.array(z.string()),
    }),
  ),
});

export const emailRevealSchema = z.object({
  registrationId: z.number(),
  accountId: z.number(),
  email: z.string(),
});

const mailBlockedReason = z.enum([
  'EVENT_CANCELLED',
  'EVENT_NOT_CANCELLED',
  'TEMPLATE_MISSING',
  'NO_RECIPIENTS',
  'NOTICE_REQUIRED',
]);

export const eventMailPreviewSchema = z.object({
  type: z.enum(['ANNOUNCEMENT', 'CANCELLATION']),
  audience: z.enum(['ALL', 'ONLINE', 'OFFLINE', 'CANCELLED_ACTIVE']),
  templateId: z.number().nullable(),
  templateExists: z.boolean(),
  subject: z.string().nullable(),
  body: z.string().nullable(),
  format: z.enum(['HTML', 'TEXT']).nullable(),
  displayTimeZone: z.string(),
  recipientCount: z.number(),
  canSend: z.boolean(),
  blockedReason: mailBlockedReason.nullable(),
});

export const eventMailDetailSchema = z.object({
  mailId: z.number(),
  type: z.enum(['ANNOUNCEMENT', 'CANCELLATION']),
  subject: z.string(),
  body: z.string(),
  format: z.enum(['HTML', 'TEXT']),
  audience: z.enum(['ALL', 'ONLINE', 'OFFLINE', 'CANCELLED_ACTIVE']),
  recipientCount: z.number(),
  maskedRecipients: z.array(z.string()),
  createdAt: z.string(),
});

export const eventMailPageSchema = z.object({
  items: z.array(
    z.object({
      mailId: z.number(),
      subject: z.string(),
      audience: z.enum(['ALL', 'ONLINE', 'OFFLINE', 'CANCELLED_ACTIVE']),
      recipientCount: z.number(),
      createdAt: z.string(),
    }),
  ),
  ...pageMeta,
});
