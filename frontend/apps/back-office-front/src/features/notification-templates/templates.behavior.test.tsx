import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import NotificationTemplatesPage from '@/app/notification-templates/page';
import type { NotificationTemplate } from '@/features/notification-templates/types';
import { ApiError, http } from '@/lib/http';

// 서버는 http 한 곳으로 막는다 — 경로·메서드·바디까지 함께 확인한다.
vi.mock('@/lib/http', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/http')>()),
  http: vi.fn(),
}));

vi.mock('next/navigation', () => ({ usePathname: () => '/notification-templates' }));

const httpMock = vi.mocked(http);
const BASE = '/api/admin/notification-templates';

const BODY = '안녕하세요, {{nickname}}님.\n\n가입을 환영합니다!';

function tpl(patch: Partial<NotificationTemplate> = {}): NotificationTemplate {
  return {
    id: 1,
    eventType: 'USER_REGISTERED',
    channel: 'EMAIL',
    subject: '[StudyClub] 회원가입을 환영합니다',
    body: BODY,
    updatedAt: '2026-10-10T00:00:00Z',
    updatedByAdminId: null,
    ...patch,
  };
}

/** 서버 흉내 — 목록은 저장·삭제를 반영하고, 호출은 httpMock.mock.calls 로 확인한다. */
function fakeServer(initial: NotificationTemplate[], failWith?: { method: string; status: number; message?: string }) {
  let db = initial.map((t) => ({ ...t }));
  let nextId = Math.max(0, ...db.map((t) => t.id)) + 1;
  httpMock.mockImplementation(async (path, init) => {
    const method = init?.method ?? 'GET';
    if (failWith && failWith.method === method) throw new ApiError(failWith.status, failWith.message ?? '실패');
    if (method === 'GET') return db;
    const id = Number(String(path).split('/').pop());
    if (method === 'DELETE') {
      db = db.filter((t) => t.id !== id);
      return null;
    }
    const draft = JSON.parse(String(init?.body));
    if (method === 'POST') {
      const created = tpl({ id: nextId++, ...draft, updatedAt: '2026-10-19T00:00:00Z' });
      db = [...db, created];
      return created;
    }
    db = db.map((t) => (t.id === id ? { ...t, ...draft, updatedAt: '2026-10-19T00:00:00Z' } : t));
    return db.find((t) => t.id === id);
  });
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, staleTime: 60_000, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <NotificationTemplatesPage />
    </QueryClientProvider>,
  );
}

const callsOf = (method: string) => httpMock.mock.calls.filter(([, init]) => (init?.method ?? 'GET') === method);

describe('알림 템플릿 화면', () => {
  beforeEach(() => {
    httpMock.mockReset();
  });

  it('열은 알림 조건 · 채널 · 제목 · 마지막 수정이다', async () => {
    fakeServer([tpl()]);
    renderPage();
    await screen.findByRole('button', { name: '회원가입' });
    for (const name of ['알림 조건', '채널', '제목', '마지막 수정']) {
      expect(screen.getByRole('columnheader', { name })).toBeTruthy();
    }
    expect(screen.queryByRole('columnheader', { name: '이벤트' })).toBeNull();
  });

  it('같은 조건의 템플릿 여럿은 제목으로 구분되고 새 것이 위에 선다', async () => {
    fakeServer([tpl({ id: 1, subject: '첫 번째' }), tpl({ id: 2, subject: '두 번째' })]);
    renderPage();
    await screen.findAllByRole('button', { name: '회원가입' });
    expect(screen.getAllByRole('button', { name: '회원가입' })).toHaveLength(2);
    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1);
    expect(within(rows[0]!).getByText('두 번째')).toBeTruthy();
    expect(within(rows[1]!).getByText('첫 번째')).toBeTruthy();
  });

  it('빈 목록이어도 추가 버튼은 있다', async () => {
    fakeServer([]);
    renderPage();
    await screen.findByText('등록된 템플릿이 없습니다.');
    expect(screen.getByRole('button', { name: /템플릿 추가/ })).toBeTruthy();
  });

  it('추가: 빈 칸으로 열리고, 제목·본문이 비면 저장되지 않는다', async () => {
    fakeServer([tpl()]);
    renderPage();
    await screen.findByRole('button', { name: '회원가입' });
    fireEvent.click(screen.getByRole('button', { name: /템플릿 추가/ }));

    await screen.findByLabelText(/제목/);
    const dialog = screen.getByRole('dialog');
    const add = within(dialog).getByRole('button', { name: '추가' }) as HTMLButtonElement;
    expect(add.disabled).toBe(true);
    expect((within(dialog).getByLabelText(/제목/) as HTMLInputElement).value).toBe('');
    // 채널을 고르게 하지 않는다
    expect(within(dialog).queryByLabelText(/채널/)).toBeNull();
    expect(within(dialog).getByText(/\{\{nickname\}\} 으로 닉네임 삽입/)).toBeTruthy();

    fireEvent.change(within(dialog).getByLabelText(/제목/), { target: { value: '   ' } });
    fireEvent.change(within(dialog).getByLabelText(/본문/), { target: { value: '본문' } });
    expect(add.disabled).toBe(true);
    expect(callsOf('POST')).toHaveLength(0);
  });

  it('추가하면 POST 로 조건·제목·본문만 보내고 목록 맨 위에 선다', async () => {
    fakeServer([tpl({ id: 1, subject: '기존' })]);
    renderPage();
    await screen.findByRole('button', { name: '회원가입' });
    fireEvent.click(screen.getByRole('button', { name: /템플릿 추가/ }));

    await screen.findByLabelText(/제목/);
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/제목/), { target: { value: ' 새 문구 ' } });
    fireEvent.change(within(dialog).getByLabelText(/본문/), { target: { value: BODY } });
    fireEvent.click(within(dialog).getByRole('button', { name: '추가' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const [path, init] = callsOf('POST')[0]!;
    expect(path).toBe(BASE);
    expect(JSON.parse(String(init?.body))).toEqual({ eventType: 'USER_REGISTERED', subject: '새 문구', body: BODY });

    await waitFor(() => {
      const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1);
      expect(within(rows[0]!).getByText('새 문구')).toBeTruthy();
    });
  });

  it('수정: 조건을 누르면 값이 채워진 팝업이 열리고 치환 변수와 줄바꿈은 원문 그대로다', async () => {
    fakeServer([tpl()]);
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: '회원가입' }));

    await screen.findByLabelText(/제목/);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('템플릿 수정')).toBeTruthy();
    expect((within(dialog).getByLabelText(/제목/) as HTMLInputElement).value).toBe('[StudyClub] 회원가입을 환영합니다');
    expect((within(dialog).getByLabelText(/본문/) as HTMLTextAreaElement).value).toBe(BODY);
  });

  it('수정하고 저장하면 PUT 으로 보낸다 (채널 없음)', async () => {
    fakeServer([tpl()]);
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: '회원가입' }));

    await screen.findByLabelText(/제목/);
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/제목/), { target: { value: '바뀐 제목' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '저장' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const [path, init] = callsOf('PUT')[0]!;
    expect(path).toBe(`${BASE}/1`);
    expect(JSON.parse(String(init?.body))).toEqual({ eventType: 'USER_REGISTERED', subject: '바뀐 제목', body: BODY });
    await screen.findByText('바뀐 제목');
  });

  it('삭제: 확인 단계로 바뀌고 취소가 기본 포커스이며, 삭제하면 목록에서 빠진다', async () => {
    fakeServer([tpl({ id: 1, subject: '지울 문구' }), tpl({ id: 2, subject: '남을 문구' })]);
    renderPage();
    await screen.findByText('지울 문구');
    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1);
    // 목록 행에는 삭제 버튼이 없다
    expect(screen.queryByRole('button', { name: /삭제/ })).toBeNull();
    fireEvent.click(within(rows[1]!).getByRole('button', { name: '회원가입' }));

    await screen.findByLabelText(/제목/);
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: '템플릿 삭제' }));
    expect(within(dialog).getByText(/지난 발송 이력은 남습니다/)).toBeTruthy();
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: '취소' }));
    expect(callsOf('DELETE')).toHaveLength(0);

    // 기본 포커스에서 Enter를 누르면 삭제하지 않고 편집으로 돌아간다
    await userEvent.setup().keyboard('{Enter}');
    expect(callsOf('DELETE')).toHaveLength(0);
    expect(within(dialog).getByLabelText(/제목/)).toBeTruthy();

    fireEvent.click(within(dialog).getByRole('button', { name: '템플릿 삭제' }));
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: '취소' }));
    fireEvent.click(within(dialog).getByRole('button', { name: '삭제' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(callsOf('DELETE')[0]![0]).toBe(`${BASE}/1`);
    await waitFor(() => expect(screen.queryByText('지울 문구')).toBeNull());
    expect(screen.getByText('남을 문구')).toBeTruthy();
  });

  it('저장이 실패하면 팝업 안에 알리고 입력값을 유지한다', async () => {
    fakeServer([tpl()], { method: 'PUT', status: 500 });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: '회원가입' }));

    await screen.findByLabelText(/제목/);
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/제목/), { target: { value: '쓰던 제목' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '저장' }));

    expect(await within(dialog).findByRole('alert')).toBeTruthy();
    expect(within(dialog).getByRole('alert').textContent).toContain('저장하지 못했습니다');
    expect((within(dialog).getByLabelText(/제목/) as HTMLInputElement).value).toBe('쓰던 제목');
  });

  it('이미 삭제된 템플릿(404)이면 그렇게 알리고 목록을 다시 읽는다', async () => {
    fakeServer([tpl()], { method: 'PUT', status: 404 });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: '회원가입' }));

    await screen.findByLabelText(/제목/);
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: '저장' }));

    expect((await within(dialog).findByRole('alert')).textContent).toContain('이미 삭제된 템플릿');
    await waitFor(() => expect(callsOf('GET').length).toBeGreaterThanOrEqual(2));
    // 이미 없는 템플릿에는 같은 요청을 다시 보내지 않는다
    expect((within(dialog).getByRole('button', { name: '저장' }) as HTMLButtonElement).disabled).toBe(true);
    expect(callsOf('PUT')).toHaveLength(1);
  });

  it('삭제하려는 템플릿이 이미 없으면(404) 목록을 다시 읽고 팝업을 닫는다', async () => {
    fakeServer([tpl()], { method: 'DELETE', status: 404 });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: '회원가입' }));

    await screen.findByLabelText(/제목/);
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: '템플릿 삭제' }));
    fireEvent.click(within(dialog).getByRole('button', { name: '삭제' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(callsOf('GET').length).toBeGreaterThanOrEqual(2));
  });

  it('추가가 404 를 받아도 「이미 삭제됨」으로 읽지 않고 다시 저장할 수 있다', async () => {
    fakeServer([tpl()], { method: 'POST', status: 404, message: '요청에 실패했습니다 (404)' });
    renderPage();
    await screen.findByRole('button', { name: '회원가입' });
    fireEvent.click(screen.getByRole('button', { name: /템플릿 추가/ }));

    await screen.findByLabelText(/제목/);
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/제목/), { target: { value: '새 문구' } });
    fireEvent.change(within(dialog).getByLabelText(/본문/), { target: { value: '본문' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '추가' }));

    const alert = await within(dialog).findByRole('alert');
    expect(alert.textContent).not.toContain('이미 삭제된 템플릿');
    expect((within(dialog).getByRole('button', { name: '추가' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('저장하는 동안에는 Esc 로 닫히지 않는다', async () => {
    fakeServer([tpl()]);
    let release!: () => void;
    const base = httpMock.getMockImplementation()!;
    httpMock.mockImplementation(async (path, init) => {
      if (init?.method === 'PUT') await new Promise<void>((resolve) => (release = resolve));
      return base(path, init);
    });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: '회원가입' }));

    await screen.findByLabelText(/제목/);
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: '저장' }));
    await waitFor(() => expect(callsOf('PUT')).toHaveLength(1));

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeNull();

    release();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('저장·삭제 요청에는 제한 시간이 걸려 있다', async () => {
    fakeServer([tpl()]);
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: '회원가입' }));

    await screen.findByLabelText(/제목/);
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: '저장' }));
    await waitFor(() => expect(callsOf('PUT')).toHaveLength(1));
    expect(callsOf('PUT')[0]![1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it('요청 시간이 지나 끊기면 실패로 알리고 팝업을 닫을 수 있다', async () => {
    fakeServer([tpl()]);
    const base = httpMock.getMockImplementation()!;
    httpMock.mockImplementation(async (path, init) => {
      if (init?.method === 'PUT') throw new DOMException('요청 시간 초과', 'TimeoutError');
      return base(path, init);
    });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: '회원가입' }));

    await screen.findByLabelText(/제목/);
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: '저장' }));

    expect((await within(dialog).findByRole('alert')).textContent).toContain('저장하지 못했습니다');
    // 요청이 끝났으니 다시 닫을 수 있다
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('조건 선택지의 이름은 목록과 같은 곳에서 온다', async () => {
    fakeServer([tpl()]);
    renderPage();
    await screen.findByRole('button', { name: '회원가입' });
    fireEvent.click(screen.getByRole('button', { name: /템플릿 추가/ }));

    await screen.findByLabelText(/제목/);
    const dialog = screen.getByRole('dialog');
    const options = within(dialog)
      .getAllByRole('option')
      .map((o) => o.textContent);
    expect(options).toEqual(['회원가입']);
  });

  it('입력 오류(4xx)는 서버가 준 이유를 그대로 보여 준다', async () => {
    fakeServer([tpl()], { method: 'PUT', status: 400, message: '제목과 본문을 입력해 주세요.' });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: '회원가입' }));

    await screen.findByLabelText(/제목/);
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: '저장' }));

    expect((await within(dialog).findByRole('alert')).textContent).toBe('제목과 본문을 입력해 주세요.');
    // 다시 고쳐 보낼 수 있다
    expect((within(dialog).getByRole('button', { name: '저장' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('조회가 실패하면 0건이 아니라 오류를 보인다', async () => {
    httpMock.mockImplementation(async () => {
      throw new ApiError(500, '서버 오류');
    });
    renderPage();
    expect(await screen.findByText('서버 오류')).toBeTruthy();
    expect(screen.queryByText('등록된 템플릿이 없습니다.')).toBeNull();
  });

  it('편집 때마다 새로 조회하고 응답 전에는 이전 값으로 편집할 수 없다', async () => {
    let release!: (value: NotificationTemplate[]) => void;
    let gets = 0;
    httpMock.mockImplementation(async () => {
      if (++gets === 1) return [tpl({ subject: 'A' })];
      return new Promise<NotificationTemplate[]>((resolve) => {
        release = resolve;
      });
    });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: '회원가입' }));
    expect(await screen.findByText('최신 템플릿을 불러오는 중…')).toBeTruthy();
    expect(screen.queryByLabelText(/제목/)).toBeNull();
    release([tpl({ subject: 'B' })]);
    expect(((await screen.findByLabelText(/제목/)) as HTMLInputElement).value).toBe('B');
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: '회원가입' }));
    await waitFor(() => expect(gets).toBe(3));
    expect(screen.queryByLabelText(/제목/)).toBeNull();
    release([tpl({ subject: 'C' })]);
    expect(((await screen.findByLabelText(/제목/)) as HTMLInputElement).value).toBe('C');
  });

  it('편집 조회 실패 시 이전 데이터를 노출하지 않고 다시 조회한다', async () => {
    let gets = 0;
    httpMock.mockImplementation(async () => {
      if (++gets === 2) throw new ApiError(500, '조회 실패');
      return [tpl({ subject: gets === 1 ? 'A' : 'B' })];
    });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: '회원가입' }));
    expect(await screen.findByText('템플릿을 불러오지 못했습니다.')).toBeTruthy();
    expect(screen.queryByLabelText(/제목/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '다시 불러오기' }));
    expect(((await screen.findByLabelText(/제목/)) as HTMLInputElement).value).toBe('B');
  });

  it('저장 중 모든 입력을 막고 실패하면 작성값을 유지하며 다시 활성화한다', async () => {
    fakeServer([tpl()]);
    const base = httpMock.getMockImplementation()!;
    let reject!: (reason: Error) => void;
    httpMock.mockImplementation(async (path, init) =>
      init?.method === 'PUT'
        ? new Promise((_resolve, fail) => {
            reject = fail;
          })
        : base(path, init),
    );
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: '회원가입' }));
    const subject = (await screen.findByLabelText(/제목/)) as HTMLInputElement;
    fireEvent.change(subject, { target: { value: '작성 중' } });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(subject.disabled).toBe(true));
    expect((screen.getByLabelText(/알림 조건/) as HTMLSelectElement).disabled).toBe(true);
    expect((screen.getByLabelText(/본문/) as HTMLTextAreaElement).disabled).toBe(true);
    reject(new ApiError(500, '저장 실패'));
    await screen.findByRole('alert');
    expect(subject.disabled).toBe(false);
    expect(subject.value).toBe('작성 중');
    expect((screen.getByLabelText(/알림 조건/) as HTMLSelectElement).disabled).toBe(false);
    expect((screen.getByLabelText(/본문/) as HTMLTextAreaElement).disabled).toBe(false);
  });

  it('최초 조회보다 추가가 먼저 성공하면 이전 요청을 취소하고 새 목록을 기다리지 않고 닫는다', async () => {
    let first!: (value: NotificationTemplate[]) => void;
    let latest!: (value: NotificationTemplate[]) => void;
    let gets = 0;
    let oldSignal: AbortSignal | undefined;
    httpMock.mockImplementation(async (_path, init) => {
      if (init?.method === 'POST') return tpl({ subject: '새 문구' });
      if (++gets === 1) {
        oldSignal = init?.signal as AbortSignal;
        return new Promise<NotificationTemplate[]>((resolve) => {
          first = resolve;
        });
      }
      return new Promise<NotificationTemplate[]>((resolve) => {
        latest = resolve;
      });
    });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /템플릿 추가/ }));
    fireEvent.change(screen.getByLabelText(/제목/), { target: { value: '새 문구' } });
    fireEvent.change(screen.getByLabelText(/본문/), { target: { value: BODY } });
    fireEvent.click(screen.getByRole('button', { name: /^추가$/ }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(gets).toBe(2));
    expect(oldSignal?.aborted).toBe(true);
    latest([tpl({ subject: '새 문구' })]);
    await screen.findByText('새 문구');
    first([]);
    await waitFor(() => expect(screen.queryByText('등록된 템플릿이 없습니다.')).toBeNull());
    expect(screen.getByText('새 문구')).toBeTruthy();
  });

  it('저장 후 목록 갱신이 실패해도 팝업은 닫고 조회만 재시도한다', async () => {
    fakeServer([tpl()]);
    const base = httpMock.getMockImplementation()!;
    let gets = 0;
    httpMock.mockImplementation(async (path, init) => {
      if ((!init?.method || init.method === 'GET') && ++gets === 3) throw new ApiError(500, '목록 실패');
      return base(path, init);
    });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: '회원가입' }));
    fireEvent.change(await screen.findByLabelText(/제목/), { target: { value: '저장됨' } });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    fireEvent.click(await screen.findByRole('button', { name: '목록 다시 불러오기' }));
    await screen.findByText('저장됨');
    expect(callsOf('PUT')).toHaveLength(1);
  });
});
