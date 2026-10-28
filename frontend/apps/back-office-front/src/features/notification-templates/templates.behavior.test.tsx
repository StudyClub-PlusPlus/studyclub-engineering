import { toast } from '@studyclub/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import NotificationTemplatesPage from '@/app/notification-templates/page';
import { clampToUtf8Bytes, utf8Bytes, type NotificationTemplate } from '@/features/notification-templates/types';
import { ApiError, http } from '@/lib/http';

// 서버는 http 한 곳으로 막는다 — 경로·메서드·바디까지 함께 확인한다.
vi.mock('@/lib/http', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/http')>()),
  http: vi.fn(),
}));

vi.mock('next/navigation', () => ({ usePathname: () => '/notification-templates' }));

// 토스트는 DOM 이 아니라 호출로 확인한다 (Toaster 를 마운트하지 않는다).
vi.mock('@studyclub/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@studyclub/ui')>();
  return { ...actual, toast: Object.assign(vi.fn(), { error: vi.fn() }) };
});

const httpMock = vi.mocked(http);
const toastErrorMock = vi.mocked(toast.error);
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
    toastErrorMock.mockClear();
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
    fireEvent.change(within(dialog).getByRole('textbox', { name: /본문/ }), { target: { value: '본문' } });
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
    fireEvent.change(within(dialog).getByRole('textbox', { name: /본문/ }), { target: { value: BODY } });
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
    expect((within(dialog).getByRole('textbox', { name: /본문/ }) as HTMLTextAreaElement).value).toBe(BODY);
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

  it('저장 전 HTML과 모든 변수를 미리 보고, 미리보기에서 저장해도 입력 원문을 보낸다', async () => {
    fakeServer([tpl()]);
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: '회원가입' }));
    await screen.findByLabelText(/제목/);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('tab', { name: '본문 편집' })).toHaveAttribute('aria-selected', 'true');

    const subject = '[StudyClub] {{studyTitle}} 안내';
    const body =
      '  <!DOCTYPE html><html><body><h1>안녕하세요, {{nickname}}님</h1>\n<p>{{newVariable}}</p></body></html>';
    fireEvent.change(within(dialog).getByLabelText(/제목/), { target: { value: subject } });
    fireEvent.change(within(dialog).getByRole('textbox', { name: /본문/ }), { target: { value: body } });
    const reads = callsOf('GET').length;
    fireEvent.click(within(dialog).getByRole('tab', { name: '미리보기' }));

    const preview = within(dialog).getByRole('tabpanel', { name: '미리보기' });
    expect(within(preview).getByText(subject)).toBeTruthy();
    const frame = within(preview).getByTitle('메일 본문 미리보기');
    expect(frame).toHaveAttribute('srcdoc', body);
    expect(frame).toHaveAttribute('sandbox', '');
    expect(callsOf('GET')).toHaveLength(reads);
    expect(callsOf('PUT')).toHaveLength(0);

    fireEvent.click(within(dialog).getByRole('button', { name: '저장' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(JSON.parse(String(callsOf('PUT')[0]![1]?.body))).toEqual({ eventType: 'USER_REGISTERED', subject, body });
  });

  it('일반 텍스트의 태그 모양 글자를 실행하지 않고 줄바꿈과 변수 원문을 표시한다', async () => {
    const body = '안녕하세요, {{nickname}}님.\n\n<img src="x" onerror="alert(1)"> & \'{{unknown}}\'';
    fakeServer([tpl({ subject: '<b>{{nickname}}</b>', body })]);
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: '회원가입' }));
    await screen.findByLabelText(/제목/);
    fireEvent.click(screen.getByRole('tab', { name: '미리보기' }));

    const preview = screen.getByRole('tabpanel', { name: '미리보기' });
    const subject = within(preview).getByText('<b>{{nickname}}</b>');
    expect(subject.querySelector('b')).toBeNull();
    const frame = within(preview).getByTitle('메일 본문 미리보기') as HTMLIFrameElement;
    const document = new DOMParser().parseFromString(frame.srcdoc, 'text/html');
    expect(document.body.textContent).toBe(body);
    expect(document.body.style.whiteSpace).toBe('pre-wrap');
    expect(document.querySelector('img')).toBeNull();
  });

  it('탭 전환과 삭제 취소는 작성값을 유지하고, 다시 열면 본문 편집부터 시작한다', async () => {
    fakeServer([tpl()]);
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: '회원가입' }));
    await screen.findByLabelText(/제목/);
    const dialog = screen.getByRole('dialog');
    const body = '<p>{{newVariable}} 수정 중</p>';
    fireEvent.change(within(dialog).getByRole('textbox', { name: /본문/ }), { target: { value: body } });
    fireEvent.click(within(dialog).getByRole('tab', { name: '미리보기' }));
    fireEvent.click(within(dialog).getByRole('button', { name: '템플릿 삭제' }));
    fireEvent.click(within(dialog).getByRole('button', { name: '취소' }));
    expect(within(dialog).getByTitle('메일 본문 미리보기')).toHaveAttribute('srcdoc', body);
    fireEvent.click(within(dialog).getByRole('tab', { name: '본문 편집' }));
    expect(within(dialog).getByRole('textbox', { name: /본문/ })).toHaveValue(body);
    fireEvent.click(within(dialog).getByRole('tab', { name: '미리보기' }));
    fireEvent.click(within(dialog).getByRole('button', { name: '닫기' }));

    fireEvent.click(screen.getByRole('button', { name: '회원가입' }));
    await screen.findByLabelText(/제목/);
    expect(screen.getByRole('tab', { name: '본문 편집' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('textbox', { name: /본문/ })).toHaveValue(BODY);
    expect(callsOf('PUT')).toHaveLength(0);
    expect(callsOf('DELETE')).toHaveLength(0);
  });

  it('추가 팝업의 빈 미리보기는 입력 안내를 보여주고, 돌아오면 작성한 내용이 남는다', async () => {
    fakeServer([]);
    renderPage();
    await screen.findByText('등록된 템플릿이 없습니다.');
    fireEvent.click(screen.getByRole('button', { name: /템플릿 추가/ }));
    fireEvent.click(screen.getByRole('tab', { name: '미리보기' }));
    expect(screen.getByText('제목을 입력해 주세요.')).toBeTruthy();
    expect(screen.getByText('본문을 입력하면 여기에 미리보기가 표시됩니다.')).toBeTruthy();
    expect(screen.queryByTitle('메일 본문 미리보기')).toBeNull();
    expect(screen.getByRole('button', { name: '추가' })).toBeDisabled();
    fireEvent.click(screen.getByRole('tab', { name: '본문 편집' }));
    fireEvent.change(screen.getByRole('textbox', { name: /본문/ }), { target: { value: BODY } });
    fireEvent.click(screen.getByRole('tab', { name: '미리보기' }));
    fireEvent.click(screen.getByRole('tab', { name: '본문 편집' }));
    expect(screen.getByRole('textbox', { name: /본문/ })).toHaveValue(BODY);
    expect(callsOf('POST')).toHaveLength(0);
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
    fireEvent.change(within(dialog).getByRole('textbox', { name: /본문/ }), { target: { value: '본문' } });
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

  it('제목은 255자까지만 쓸 수 있고 글자 수를 보여 준다', async () => {
    fakeServer([tpl()]);
    renderPage();
    await screen.findByRole('button', { name: '회원가입' });
    fireEvent.click(screen.getByRole('button', { name: /템플릿 추가/ }));

    await screen.findByLabelText(/제목/);
    const dialog = screen.getByRole('dialog');
    const subject = within(dialog).getByLabelText(/제목/) as HTMLInputElement;
    expect(subject.maxLength).toBe(255);
    fireEvent.change(subject, { target: { value: '가나다' } });
    expect(within(dialog).getByText('3 / 255자')).toBeTruthy();
  });

  it('본문은 UTF-8 65,535바이트까지만 받고 바이트 수를 보여 준다 — 글자 수가 아니다', async () => {
    fakeServer([tpl()]);
    renderPage();
    await screen.findByRole('button', { name: '회원가입' });
    fireEvent.click(screen.getByRole('button', { name: /템플릿 추가/ }));

    await screen.findByLabelText(/제목/);
    const dialog = screen.getByRole('dialog');
    const body = within(dialog).getByRole('textbox', { name: /본문/ }) as HTMLTextAreaElement;

    fireEvent.change(body, { target: { value: '가나다' } });
    expect(within(dialog).getByText('9 / 65,535바이트')).toBeTruthy();

    // 한글 3바이트 × 21,845 = 65,535바이트 — 한도까지는 그대로 들어간다
    const atLimit = '가'.repeat(21_845);
    fireEvent.change(body, { target: { value: atLimit } });
    expect(body.value).toBe(atLimit);
    expect(within(dialog).getByText('65,535 / 65,535바이트')).toBeTruthy();

    // 1바이트만 더해도 받지 않는다
    fireEvent.change(body, { target: { value: atLimit + 'a' } });
    expect(body.value).toBe(atLimit);

    // 붙여 넣은 긴 글은 한도까지만 남고, 글자 한가운데서 잘리지 않는다
    fireEvent.change(body, { target: { value: '가'.repeat(30_000) } });
    expect(body.value).toBe(atLimit);
  });

  it('clampToUtf8Bytes 는 4바이트 글자(이모지)도 반으로 자르지 않는다', () => {
    expect(clampToUtf8Bytes('ab😀', 5)).toBe('ab');
    expect(clampToUtf8Bytes('ab😀', 6)).toBe('ab😀');
    expect(utf8Bytes('가😀a')).toBe(8);
  });

  it('이미 있는 조건(409)은 토스트로 알리고, 팝업 안에는 오류를 띄우지 않고 입력을 유지한다', async () => {
    const message = '이미 이 알림 조건의 템플릿이 있습니다. 기존 템플릿을 수정하세요.';
    fakeServer([tpl()], { method: 'POST', status: 409, message });
    renderPage();
    await screen.findByRole('button', { name: '회원가입' });
    fireEvent.click(screen.getByRole('button', { name: /템플릿 추가/ }));

    await screen.findByLabelText(/제목/);
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/제목/), { target: { value: '중복 제목' } });
    fireEvent.change(within(dialog).getByRole('textbox', { name: /본문/ }), { target: { value: '중복 본문' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '추가' }));

    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith(message));
    // 팝업은 열린 채 값이 남고, 인라인 오류는 없다. 다시 눌러 볼 수 있다
    expect(within(dialog).queryByRole('alert')).toBeNull();
    expect((within(dialog).getByLabelText(/제목/) as HTMLInputElement).value).toBe('중복 제목');
    expect((within(dialog).getByRole('button', { name: '추가' }) as HTMLButtonElement).disabled).toBe(false);
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
    await waitFor(() => expect(screen.getByLabelText(/제목/)).toHaveValue('B'));
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
    expect((screen.getByRole('textbox', { name: /본문/ }) as HTMLTextAreaElement).disabled).toBe(true);
    reject(new ApiError(500, '저장 실패'));
    await screen.findByRole('alert');
    expect(subject.disabled).toBe(false);
    expect(subject.value).toBe('작성 중');
    expect((screen.getByLabelText(/알림 조건/) as HTMLSelectElement).disabled).toBe(false);
    expect((screen.getByRole('textbox', { name: /본문/ }) as HTMLTextAreaElement).disabled).toBe(false);
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
    fireEvent.change(screen.getByRole('textbox', { name: /본문/ }), { target: { value: BODY } });
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
