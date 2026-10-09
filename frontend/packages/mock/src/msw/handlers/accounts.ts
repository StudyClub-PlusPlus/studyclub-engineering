import { studies as mockStudies } from '../..';
import { mockClient } from '../utils';

export type ApiAccount = {
  id: number;
  email: string;
  name: string | null;
  picture: string | null;
  role: string;
  createdAt: string | null;
};

export const mockUsers: ApiAccount[] = mockStudies.slice(0, 5).map((s, i) => ({
  id: i + 1,
  email: `user${i + 1}@studyclub.example`,
  name: `스터디원 ${i + 1}`,
  picture: null,
  role: i === 0 ? 'ADMIN' : 'USER',
  createdAt: '2024-01-01T00:00:00Z',
}));

export const accountsHandlers = mockClient.createHandlerGroup('/accounts', [
  {
    method: 'GET',
    path: '/',
    presets: [
      { label: '정상', status: 200, response: mockUsers },
      { label: '빈 목록', status: 200, response: [] },
      { label: '서버 오류', status: 500, response: { errorMessage: '서버 오류가 발생했습니다.' } },
    ],
  },
]);
