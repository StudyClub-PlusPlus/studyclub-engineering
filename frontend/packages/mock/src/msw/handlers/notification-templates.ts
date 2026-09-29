import { mockClient } from '../utils';

export type ApiNotificationTemplate = {
  id: number;
  eventType: string;
  channel: string;
  subject: string;
  body: string;
  updatedAt: string | null;
  updatedByAdminId: number | null;
};

export const mockNotificationTemplates: ApiNotificationTemplate[] = [
  {
    id: 1,
    eventType: 'USER_REGISTERED',
    channel: 'EMAIL',
    subject: '[StudyClub++] 가입을 환영합니다!',
    body: '안녕하세요, StudyClub++에 오신 것을 환영합니다.',
    updatedAt: '2024-01-01T00:00:00Z',
    updatedByAdminId: 1,
  },
];

export const notificationTemplatesHandlers = mockClient.createHandlerGroup(
  '/api/admin/notification-templates',
  [
    {
      method: 'GET',
      path: '/',
      presets: [
        { label: '정상', status: 200, response: mockNotificationTemplates },
        { label: '빈 목록', status: 200, response: [] },
        { label: '서버 오류', status: 500, response: { errorMessage: '서버 오류가 발생했습니다.' } },
      ],
    },
  ],
);
