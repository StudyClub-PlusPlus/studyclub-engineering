import { HttpResponse } from 'msw';

import {
  mockCancelRegistration,
  mockEventDetail,
  mockEventList,
  mockMyEvents,
  mockRegistrationMe,
  mockSubmitRegistration,
} from '../data/events';
import { mockClient, type MockResolveContext } from '../utils';

export const eventsHandlers = mockClient.createHandlerGroup('/api/events', [
  {
    method: 'GET',
    path: '',
    presets: [
      {
        label: '목록',
        status: 200,
        response: () => mockEventList(),
      },
    ],
  },
  {
    method: 'GET',
    path: '/:eventId',
    presets: [
      {
        label: '상세',
        status: 200,
        response: ({ params }: MockResolveContext) => {
          const id = Number(params.eventId);
          const detail = mockEventDetail(id);
          if (!detail) return HttpResponse.json({ errorCode: 'NOT_FOUND', errorMessage: 'Not found' }, { status: 404 });
          return detail;
        },
      },
    ],
  },
  {
    method: 'POST',
    path: '/:eventId/registrations',
    presets: [
      {
        label: '신청',
        status: 201,
        response: async ({ params, request }: MockResolveContext) => {
          const eventId = Number(params.eventId);
          const body = (await request.json()) as {
            channel: 'ONLINE' | 'OFFLINE';
            answers: Record<string, string[]>;
          };
          const id = mockSubmitRegistration(eventId, body.channel, body.answers);
          if (!id) return HttpResponse.json({ errorCode: 'NOT_FOUND', errorMessage: 'Not found' }, { status: 404 });
          const detail = mockRegistrationMe(eventId, id);
          return HttpResponse.json(detail, { status: 201, headers: { Location: `/api/events/${eventId}/registrations/me` } });
        },
      },
    ],
  },
  {
    method: 'GET',
    path: '/:eventId/registrations/me',
    presets: [
      {
        label: '내 신청서',
        status: 200,
        response: ({ params }: MockResolveContext) => {
          const eventId = Number(params.eventId);
          const detail = mockEventDetail(eventId);
          const reg = detail?.myRegistration;
          if (!reg) return HttpResponse.json({ errorCode: 'NOT_FOUND', errorMessage: 'Not found' }, { status: 404 });
          return mockRegistrationMe(eventId, reg.registrationId);
        },
      },
    ],
  },
  {
    method: 'DELETE',
    path: '/:eventId/registrations/me',
    presets: [
      {
        label: '본인 취소',
        status: 200,
        response: ({ params, request }: MockResolveContext) => {
          const eventId = Number(params.eventId);
          const url = new URL(request.url);
          const registrationId = Number(url.searchParams.get('registrationId'));
          if (!mockCancelRegistration(registrationId)) {
            return HttpResponse.json({ errorCode: 'NOT_FOUND', errorMessage: 'Not found' }, { status: 404 });
          }
          return mockRegistrationMe(eventId, registrationId);
        },
      },
    ],
  },
]);

export const myEventsHandlers = mockClient.createHandlerGroup('/api/me', [
  {
    method: 'GET',
    path: '/events',
    presets: [{ label: '내 행사', status: 200, response: () => mockMyEvents() }],
  },
]);