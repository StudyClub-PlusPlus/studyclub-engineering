import { z } from 'zod';

const registrationStatusSchema = z.enum(['PENDING', 'CONFIRMED', 'DECLINED', 'CANCELLED']);
const displayStatusSchema = z.enum(['RECRUITING', 'FULL', 'RECRUITMENT_CLOSED', 'ENDED', 'CANCELLED']);
const listGroupSchema = z.enum(['UPCOMING', 'PAST']);
const formatSchema = z.enum(['ONLINE', 'OFFLINE', 'HYBRID']);
const channelSchema = z.enum(['ONLINE', 'OFFLINE']);
const confirmationSchema = z.enum(['AUTO', 'REVIEW']);
const questionTypeSchema = z.enum(['TEXT', 'TEXTAREA', 'RADIO', 'CHECKBOX']);

export const eventListRegistrationSchema = z.object({
  status: registrationStatusSchema,
  channel: channelSchema,
});

export const eventListItemSchema = z.object({
  eventId: z.number(),
  title: z.string(),
  summary: z.string(),
  startsAt: z.string(),
  endsAt: z.string().nullable(),
  effectiveEndsAt: z.string(),
  timeZone: z.string(),
  format: formatSchema,
  displayStatus: displayStatusSchema,
  listGroup: listGroupSchema,
  myRegistration: eventListRegistrationSchema.nullable(),
});

export const eventListSchema = z.array(eventListItemSchema);

export const eventSeatSchema = z.object({
  channel: channelSchema,
  capacity: z.number(),
  remaining: z.number(),
});

export const eventQuestionSchema = z.object({
  questionId: z.string(),
  label: z.string(),
  type: questionTypeSchema,
  required: z.boolean(),
  options: z.array(z.string()),
});

export const applyBlockedReasonSchema = z.enum([
  'LOGIN_REQUIRED',
  'ONBOARDING_REQUIRED',
  'EVENT_CANCELLED',
  'EVENT_ENDED',
  'RECRUITMENT_CLOSED',
  'ACCOUNT_EMAIL_INVALID',
  'ALREADY_REGISTERED',
  'DECLINED_BEFORE',
  'FULL',
]);

export const myRegistrationDetailSchema = z.object({
  registrationId: z.number(),
  status: registrationStatusSchema,
  channel: channelSchema,
  createdAt: z.string(),
  canCancel: z.boolean(),
  cancelBlockedReason: z.enum(['NOT_ACTIVE', 'DEADLINE_PASSED']).nullable(),
  onlineLinkVisible: z.boolean(),
  onlineUrl: z.string().nullable(),
});

export const eventDetailSchema = z.object({
  eventId: z.number(),
  title: z.string(),
  summary: z.string(),
  description: z.string(),
  timeZone: z.string(),
  startsAt: z.string(),
  endsAt: z.string().nullable(),
  effectiveEndsAt: z.string(),
  deadlineAt: z.string(),
  format: formatSchema,
  offline: z.object({ location: z.string() }).nullable(),
  online: z.object({}).nullable(),
  confirmation: confirmationSchema,
  displayStatus: displayStatusSchema,
  seats: z.array(eventSeatSchema),
  questions: z.array(eventQuestionSchema),
  questionVersion: z.string(),
  canApply: z.boolean(),
  applyBlockedReason: applyBlockedReasonSchema.nullable(),
  myRegistration: myRegistrationDetailSchema.nullable(),
});

export const eventRegistrationAnswerSchema = z.object({
  questionId: z.string(),
  label: z.string(),
  type: questionTypeSchema,
  required: z.boolean(),
  options: z.array(z.string()),
  answer: z.array(z.string()),
});

export const eventRegistrationSchema = z.object({
  registrationId: z.number(),
  eventId: z.number(),
  status: registrationStatusSchema,
  channel: channelSchema,
  createdAt: z.string(),
  canCancel: z.boolean(),
  cancelBlockedReason: z.enum(['NOT_ACTIVE', 'DEADLINE_PASSED']).nullable(),
  questions: z.array(eventRegistrationAnswerSchema),
});

export const myEventSchema = z.object({
  eventId: z.number(),
  title: z.string(),
  startsAt: z.string(),
  timeZone: z.string(),
  registration: z.object({
    registrationId: z.number(),
    status: registrationStatusSchema,
    channel: channelSchema,
    createdAt: z.string(),
  }),
});

export const myEventsSchema = z.array(myEventSchema);

export type ApiEventListItem = z.infer<typeof eventListItemSchema>;
export type ApiEventDetail = z.infer<typeof eventDetailSchema>;
export type ApiEventQuestion = z.infer<typeof eventQuestionSchema>;
export type ApiEventRegistration = z.infer<typeof eventRegistrationSchema>;
export type ApiMyEvent = z.infer<typeof myEventSchema>;
export type ApplyBlockedReason = z.infer<typeof applyBlockedReasonSchema>;