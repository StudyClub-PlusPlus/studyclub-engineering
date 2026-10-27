import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { StudyInfoTab } from '@/components/StudyInfoTab';
import { useStudyDetail } from '@/features/studies/queries';
import type { ApiStudyDetail } from '@/features/studies/types';

const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

const original: ApiStudyDetail = {
  id: 7, programId: 3, programTitle: '테스트 프로그램', title: '기존 제목',
  oneLineSummary: '소개', description: null, category: 'AI_ML', studyKind: 'STUDY',
  thumbnailUrl: null, status: 'DRAFT', recruitStatus: 'RECRUIT_CLOSED', curriculum: null,
  capacity: null, schedule: null, timezone: null, recruitDeadlineAt: '2020-01-01T14:59:59Z',
  startAt: null, endAt: null, discordChannelUrl: null, driveUrl: null,
};

function Detail() {
  const { data } = useStudyDetail(7);
  return data ? <StudyInfoTab detail={data} /> : null;
}

let detail: ApiStudyDetail;
let mutationResponse: () => Promise<Response>;
const fetchMock = vi.fn();
let client: QueryClient;

beforeEach(() => {
  vi.clearAllMocks();
  detail = { ...original };
  mutationResponse = async () => new Response(null, { status: 204 });
  fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
    if (init?.method === 'PATCH' || init?.method === 'DELETE') {
      const response = await mutationResponse();
      if (response.ok && init.method === 'PATCH') {
        detail = { ...detail, ...JSON.parse(init.body as string) };
      }
      return response;
    }
    return Response.json(detail);
  });
  vi.stubGlobal('fetch', fetchMock);
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
});

afterEach(() => {
  cleanup();
  client.clear();
  vi.unstubAllGlobals();
});

async function open() {
  render(<QueryClientProvider client={client}><Detail /></QueryClientProvider>);
  await screen.findByDisplayValue('기존 제목');
  return userEvent.setup();
}

const mutations = () => fetchMock.mock.calls.filter(([, init]) => ['PATCH', 'DELETE'].includes(init?.method));

describe('스터디 수정·삭제 API 연결', () => {
  it('썸네일 업로드가 끝나야 저장할 수 있고 업로드 번호를 PATCH에 포함한다', async () => {
    const user = await open();
    await user.type(screen.getByDisplayValue('기존 제목'), ' 변경');
    let finish!: (response: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    await user.upload(screen.getByLabelText('썸네일 파일'), new File(['image'], 'image.png', { type: 'image/png' }));
    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '스터디 삭제' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: '저장' }));
    expect(mutations()).toHaveLength(0);
    finish(Response.json({ fileId: 42, url: 'https://example.com/thumbnail.png' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '저장' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(mutations()).toHaveLength(1));
    expect(JSON.parse(mutations()[0][1].body)).toEqual({ title: '기존 제목 변경', thumbnailFileId: 42 });
  });

  it('썸네일 업로드 실패 후 잠금을 해제하고 오류를 표시한다', async () => {
    const user = await open();
    await user.type(screen.getByDisplayValue('기존 제목'), ' 변경');
    let finish!: (response: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    await user.upload(screen.getByLabelText('썸네일 파일'), new File(['image'], 'image.png', { type: 'image/png' }));
    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
    finish(Response.json({ errorMessage: '업로드 실패' }, { status: 500 }));
    await screen.findByText('업로드 실패');
    await waitFor(() => expect(screen.getByRole('button', { name: '저장' })).toBeEnabled());
    expect(screen.getByRole('button', { name: '이미지 업로드' })).toBeEnabled();
    expect(mutations()).toHaveLength(0);
  });

  it('바뀐 제목만 PATCH하고 상세를 다시 읽으며 서버 목록도 갱신한다', async () => {
    const user = await open();
    const title = screen.getByDisplayValue('기존 제목');
    await user.clear(title);
    await user.type(title, '새 제목');
    await user.click(screen.getByRole('button', { name: '저장' }));
    await screen.findByText('저장되었습니다.');
    expect(mutations()).toHaveLength(1);
    const [url, init] = mutations()[0];
    expect(url).toMatch(/\/api\/admin\/studies\/7$/);
    expect(init).toMatchObject({ method: 'PATCH', credentials: 'include' });
    expect(JSON.parse(init.body)).toEqual({ title: '새 제목' });
    expect(client.getQueryData(['studies', 'detail', 7])).toMatchObject({ title: '새 제목' });
    expect(router.refresh).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
  });

  it('저장된 시간대를 골라 둔 채 열고, 바꾼 시간대만 PATCH 한다', async () => {
    detail = { ...original, timezone: 'PST' };
    const user = await open();
    expect(screen.getByRole('radio', { name: 'PST' })).toHaveAttribute('aria-checked', 'true');
    await user.click(screen.getByRole('radio', { name: '동시 진행(KST·PST)' }));
    await user.click(screen.getByRole('button', { name: '저장' }));
    await screen.findByText('저장되었습니다.');
    expect(JSON.parse(mutations()[0][1].body)).toEqual({ timezone: 'BOTH' });
  });

  it('수정 실패 시 입력을 유지하고 성공 안내나 목록 갱신을 하지 않는다', async () => {
    mutationResponse = async () => Response.json({ errorMessage: '스터디 수정 권한이 없습니다.' }, { status: 403 });
    const user = await open();
    await user.type(screen.getByDisplayValue('기존 제목'), ' 변경');
    await user.click(screen.getByRole('button', { name: '저장' }));
    await screen.findByText('스터디 수정 권한이 없습니다.');
    expect(screen.getByDisplayValue('기존 제목 변경')).toBeInTheDocument();
    expect(screen.queryByText('저장되었습니다.')).not.toBeInTheDocument();
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it('삭제 확인 취소는 요청하지 않고, 확인한 경우에만 DELETE 후 목록으로 이동한다', async () => {
    const user = await open();
    await user.click(screen.getByRole('button', { name: '스터디 삭제' }));
    expect(screen.getByText('‘기존 제목’ 스터디를 삭제합니다.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '취소' }));
    expect(mutations()).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: '스터디 삭제' }));
    await user.click(screen.getByRole('button', { name: '삭제' }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/studies'));
    expect(mutations()).toHaveLength(1);
    expect(mutations()[0][0]).toMatch(/\/api\/admin\/studies\/7$/);
    expect(mutations()[0][1]).toMatchObject({ method: 'DELETE', credentials: 'include' });
    expect(router.refresh).toHaveBeenCalledOnce();
  });

  it('삭제 실패 시 확인 창에 오류를 표시하고 현재 화면에 남는다', async () => {
    mutationResponse = async () => Response.json({ errorMessage: '삭제에 실패했습니다.' }, { status: 500 });
    const user = await open();
    await user.click(screen.getByRole('button', { name: '스터디 삭제' }));
    await user.click(screen.getByRole('button', { name: '삭제' }));
    await screen.findByText('삭제에 실패했습니다.');
    expect(router.replace).not.toHaveBeenCalled();
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it('저장 처리 중에는 입력과 삭제를 잠근다', async () => {
    let finish!: (response: Response) => void;
    mutationResponse = () => new Promise((resolve) => { finish = resolve; });
    const user = await open();
    await user.type(screen.getByDisplayValue('기존 제목'), ' 변경');
    await user.click(screen.getByRole('button', { name: '저장' }));
    expect(screen.getByDisplayValue('기존 제목 변경')).toBeDisabled();
    expect(screen.getByRole('button', { name: '스터디 삭제' })).toBeDisabled();
    finish(new Response(null, { status: 204 }));
    await screen.findByText('저장되었습니다.');
  });
});
