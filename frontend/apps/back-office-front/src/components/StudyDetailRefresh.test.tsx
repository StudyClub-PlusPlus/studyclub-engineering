import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import StudyAdminDetail from '@/app/studies/[id]/page';
import { StudyInfoTab } from '@/components/StudyInfoTab';
import { studyKeys } from '@/features/studies/queries';
import type { ApiStudyDetail } from '@/features/studies/types';

vi.mock('next/navigation', () => ({ useParams: () => ({ id: '7' }), useRouter: () => ({}) }));
vi.mock('@/components/StudyConsole', () => ({
  StudyConsole: ({ detail }: { detail: ApiStudyDetail }) => <StudyInfoTab detail={detail} />,
}));

const detail: ApiStudyDetail = {
  id: 7,
  programId: 3,
  programTitle: '프로그램',
  title: '스터디',
  oneLineSummary: '소개',
  description: null,
  category: 'AI_ML',
  studyKind: 'STUDY',
  thumbnailUrl: null,
  status: 'DRAFT',
  recruitStatus: null,
  curriculum: null,
  capacity: null,
  schedule: null,
  timezone: null,
  recruitDeadlineAt: null,
  startAt: null,
  endAt: null,
  discordLinked: false,
  discordChannelUrl: null,
  driveUrl: null,
};
let client: QueryClient;
const fetchMock = vi.fn();
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  cleanup();
  client.clear();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

it('연결 성공 후 GET이 실패해도 연결됨을 유지하고 조회만 재시도한다', async () => {
  let linked = false;
  let unavailable = true;
  fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
    if (init?.method === 'POST') {
      linked = true;
      return Response.json(
        { discordStudyId: '1327394882193883136', discordRoleId: '1327394882193883140' },
        { status: 201 },
      );
    }
    if (linked && unavailable) return Response.json({ errorMessage: '일시적 오류' }, { status: 503 });
    return Response.json({ ...detail, discordLinked: linked });
  });
  render(
    <QueryClientProvider client={client}>
      <StudyAdminDetail />
    </QueryClientProvider>,
  );
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: '다시 연결' }));
  await user.click(screen.getByRole('button', { name: '연결하기' }));
  await screen.findByText('연결됨');
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(screen.getByRole('alert')).toHaveTextContent('최신 정보를 불러오지 못했습니다.');
  expect(client.getQueryData(studyKeys.detail(7))).toMatchObject({ discordLinked: true });
  expect(screen.queryByRole('button', { name: '다시 연결' })).not.toBeInTheDocument();
  unavailable = false;
  await user.click(screen.getByRole('button', { name: '다시 조회' }));
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1);
});

it.each([401, 403, 404])('캐시가 있어도 %i 응답이면 상세를 숨긴다', async (status) => {
  client.setQueryData(studyKeys.detail(7), detail);
  fetchMock.mockResolvedValue(Response.json({ errorMessage: '접근 불가' }, { status }));
  render(
    <QueryClientProvider client={client}>
      <StudyAdminDetail />
    </QueryClientProvider>,
  );
  await screen.findByRole('link', { name: '스터디 관리로 돌아가기' });
  expect(screen.queryByLabelText('스터디 정보')).not.toBeInTheDocument();
});

it('연결 전에 시작한 GET 응답이 늦게 와도 성공한 연결 상태를 덮어쓰지 않는다', async () => {
  let gets = 0;
  let finishOld!: (response: Response) => void;
  fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
    if (init?.method === 'POST')
      return Response.json(
        { discordStudyId: '1327394882193883136', discordRoleId: '1327394882193883140' },
        { status: 201 },
      );
    gets++;
    if (gets === 2)
      return new Promise<Response>((resolve) => {
        finishOld = resolve;
      });
    if (gets > 2) return Response.json({ errorMessage: '일시적 오류' }, { status: 503 });
    return Response.json(detail);
  });
  render(
    <QueryClientProvider client={client}>
      <StudyAdminDetail />
    </QueryClientProvider>,
  );
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: '다시 연결' }));
  const oldFetch = client.refetchQueries({ queryKey: studyKeys.detail(7) });
  await waitFor(() => expect(gets).toBe(2));
  await user.click(screen.getByRole('button', { name: '연결하기' }));
  await screen.findByText('연결됨');
  await screen.findByRole('alert');
  finishOld(Response.json(detail));
  await oldFetch;
  expect(client.getQueryData(studyKeys.detail(7))).toMatchObject({ discordLinked: true });
  expect(screen.getByText('연결됨')).toBeInTheDocument();
});
