import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useStudyDetail } from '@/features/studies/queries';
import { StudyInfoTab } from '@/features/studies/StudyInfoTab';
import type { ApiStudyDetail } from '@/features/studies/types';

const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

const original: ApiStudyDetail = {
  id: 7,
  programId: 3,
  programTitle: '테스트 프로그램',
  title: '기존 제목',
  oneLineSummary: '소개',
  description: null,
  category: 'AI_ML',
  studyKind: 'STUDY',
  thumbnailUrl: null,
  status: 'DRAFT',
  recruitStatus: 'RECRUIT_CLOSED',
  curriculum: null,
  capacity: null,
  schedule: null,
  timezone: null,
  recruitDeadlineAt: '2020-01-01T14:59:59Z',
  startAt: null,
  endAt: null,
  discordLinked: false,
  discordChannelUrl: null,
  driveUrl: null,
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
  render(
    <QueryClientProvider client={client}>
      <Detail />
    </QueryClientProvider>,
  );
  await screen.findByDisplayValue('기존 제목');
  return userEvent.setup();
}

const mutations = () => fetchMock.mock.calls.filter(([, init]) => ['PATCH', 'DELETE'].includes(init?.method));

describe('스터디 수정·삭제 API 연결', () => {
  it('썸네일 업로드가 끝나야 저장할 수 있고 업로드 번호를 PATCH에 포함한다', async () => {
    const user = await open();
    await user.type(screen.getByDisplayValue('기존 제목'), ' 변경');
    let finish!: (response: Response) => void;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
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
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
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
    mutationResponse = () =>
      new Promise((resolve) => {
        finish = resolve;
      });
    const user = await open();
    await user.type(screen.getByDisplayValue('기존 제목'), ' 변경');
    await user.click(screen.getByRole('button', { name: '저장' }));
    expect(screen.getByDisplayValue('기존 제목 변경')).toBeDisabled();
    expect(screen.getByRole('button', { name: '스터디 삭제' })).toBeDisabled();
    finish(new Response(null, { status: 204 }));
    await screen.findByText('저장되었습니다.');
  });
});

describe('디스코드 연결 재시도', () => {
  it('연결된 스터디는 상태만 표시하고 재시도 버튼을 숨긴다', async () => {
    detail = { ...original, discordLinked: true };
    await open();
    expect(screen.getByText('연결됨')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '다시 연결' })).not.toBeInTheDocument();
  });

  it('미연결 스터디는 한 번 POST하고 상세를 다시 읽어 버튼을 숨긴다', async () => {
    let finish!: (response: Response) => void;
    const baseFetch = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === 'POST')
        return new Promise((resolve) => {
          finish = resolve;
        });
      return baseFetch(url, init);
    });
    const user = await open();
    await user.click(screen.getByRole('button', { name: '다시 연결' }));
    expect(screen.getByLabelText('디스코드 이름')).toHaveValue('기존 제목');
    await user.click(screen.getByRole('button', { name: '연결하기' }));
    expect(screen.getByRole('button', { name: '연결하기' })).toBeDisabled();
    expect(screen.getByLabelText('디스코드 이름')).toBeDisabled();
    const posts = fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST');
    expect(posts).toHaveLength(1);
    expect(posts[0][0]).toMatch(/\/api\/admin\/studies\/7\/discord-link$/);
    expect(posts[0][1]).toMatchObject({ method: 'POST', credentials: 'include' });
    expect(JSON.parse(posts[0][1].body)).toEqual({ studyName: '기존 제목' });
    detail = { ...detail, discordLinked: true };
    finish(
      Response.json({ discordStudyId: '1327394882193883136', discordRoleId: '1327394882193883140' }, { status: 201 }),
    );
    await screen.findByText('연결됨');
    expect(screen.queryByRole('button', { name: '다시 연결' })).not.toBeInTheDocument();
  });

  it('처리 중 연속 클릭과 Esc·닫기를 막고 96자 이름은 허용한다', async () => {
    let finish!: (response: Response) => void;
    const baseFetch = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation((url: string, init?: RequestInit) =>
      init?.method === 'POST'
        ? new Promise((resolve) => {
            finish = resolve;
          })
        : baseFetch(url, init),
    );
    const user = await open();
    await user.click(screen.getByRole('button', { name: '다시 연결' }));
    await user.clear(screen.getByLabelText('디스코드 이름'));
    await user.type(screen.getByLabelText('디스코드 이름'), '가'.repeat(96));
    await user.dblClick(screen.getByRole('button', { name: '연결하기' }));
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: '닫기' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '취소' })).toBeDisabled();
    const posts = fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST');
    expect(posts).toHaveLength(1);
    expect(JSON.parse(posts[0][1].body)).toEqual({ studyName: '가'.repeat(96) });
    detail = { ...detail, discordLinked: true };
    finish(
      Response.json({ discordStudyId: '1327394882193883136', discordRoleId: '1327394882193883140' }, { status: 201 }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('이름 중복이면 입력을 유지하고 다른 이름으로 재시도한다', async () => {
    const baseFetch = fetchMock.getMockImplementation()!;
    let count = 0;
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method !== 'POST') return baseFetch(url, init);
      if (++count === 1)
        return Promise.resolve(
          Response.json({ errorMessage: '디스코드에 같은 이름의 스터디가 이미 있습니다.' }, { status: 409 }),
        );
      detail = { ...detail, discordLinked: true };
      return Promise.resolve(
        Response.json({ discordStudyId: '1327394882193883136', discordRoleId: '1327394882193883140' }, { status: 201 }),
      );
    });
    const user = await open();
    await user.click(screen.getByRole('button', { name: '다시 연결' }));
    await user.click(screen.getByRole('button', { name: '연결하기' }));
    await screen.findByRole('alert');
    expect(screen.getByLabelText('디스코드 이름')).toHaveValue('기존 제목');
    await user.clear(screen.getByLabelText('디스코드 이름'));
    await user.type(screen.getByLabelText('디스코드 이름'), '  디스코드 2기  ');
    await user.click(screen.getByRole('button', { name: '연결하기' }));
    await screen.findByText('연결됨');
    const posts = fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST');
    expect(posts).toHaveLength(2);
    expect(JSON.parse(posts[1][1].body)).toEqual({ studyName: '디스코드 2기' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(detail.title).toBe('기존 제목');
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'PATCH')).toBe(false);
  });

  it('다른 운영자가 먼저 연결해 409가 오면 상세를 다시 확인하고 창을 닫는다', async () => {
    const baseFetch = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method !== 'POST') return baseFetch(url, init);
      detail = { ...detail, discordLinked: true };
      return Promise.resolve(Response.json({ errorMessage: '이미 디스코드에 연결된 스터디입니다.' }, { status: 409 }));
    });
    const user = await open();
    await user.click(screen.getByRole('button', { name: '다시 연결' }));
    await user.click(screen.getByRole('button', { name: '연결하기' }));
    await screen.findByText('연결됨');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '다시 연결' })).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1);
    // 연결 상태 변경으로 숨긴 뒤에도 열림 상태가 남아 창이 다시 나타나면 안 된다.
    await act(async () => {
      client.setQueryData(['studies', 'detail', 7], { ...detail, discordLinked: false });
    });
    await screen.findByRole('button', { name: '다시 연결' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('공백과 96자 초과를 막고 취소하면 요청하지 않는다', async () => {
    const user = await open();
    await user.click(screen.getByRole('button', { name: '다시 연결' }));
    const input = screen.getByLabelText('디스코드 이름');
    await user.clear(input);
    await user.type(input, '   ');
    await user.click(screen.getByRole('button', { name: '연결하기' }));
    await screen.findByText('디스코드 이름을 입력해 주세요.');
    await user.clear(input);
    await user.type(input, 'a'.repeat(97));
    await user.click(screen.getByRole('button', { name: '연결하기' }));
    await screen.findByText('디스코드 이름은 96자 이하로 입력해 주세요.');
    await user.click(screen.getByRole('button', { name: '취소' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(0);
  });

  it('실패하면 오류를 보여 주고 자동 재시도 없이 다시 누를 수 있다', async () => {
    const baseFetch = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation((url: string, init?: RequestInit) =>
      init?.method === 'POST'
        ? Promise.resolve(Response.json({ errorMessage: '디스코드 연결에 실패했습니다.' }, { status: 503 }))
        : baseFetch(url, init),
    );
    const user = await open();
    await user.click(screen.getByRole('button', { name: '다시 연결' }));
    await user.click(screen.getByRole('button', { name: '연결하기' }));
    await screen.findByRole('alert');
    expect(screen.getByRole('alert')).toHaveTextContent('디스코드 연결에 실패했습니다.');
    expect(screen.getByRole('button', { name: '연결하기' })).toBeEnabled();
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1);
  });
});
