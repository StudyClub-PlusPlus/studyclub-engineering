import { isValidElement, type ReactNode } from 'react';

import { toast } from '@studyclub/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SEND_FAILED_MESSAGE, SENT_MESSAGE, TOO_MANY_MESSAGE } from './feedback';
import { FeedbackDialog } from './FeedbackDialog';
import { feedbackKeys, type MyFeedbackPage } from './queries';
import { API_BASE } from '../../lib/http';

function respond(status: number, body: unknown) {
  return vi
    .fn()
    .mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
      text: async () => JSON.stringify(body),
    });
}

const created = { id: 241, type: 'BUG', title: '출석 버튼', status: 'RECEIVED', createdAt: '2026-10-25T08:12:40Z' };

function setup(queryClient = new QueryClient({ defaultOptions: { queries: { retry: 0 }, mutations: { retry: 0 } } })) {
  const onClose = vi.fn();
  const onSent = vi.fn();
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={queryClient}>
      <FeedbackDialog open accountId={7} onClose={onClose} onSent={onSent} />
    </QueryClientProvider>,
  );
  return { user, onClose, onSent, queryClient };
}

async function fillValid(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByLabelText('오류 신고'));
  await user.type(screen.getByRole('textbox', { name: /제목/ }), '  출석 버튼  ');
  await user.type(screen.getByRole('textbox', { name: /내용/ }), '아이폰에서 출석 버튼이 안 눌려요.');
}

/** toast.error 첫 인자 — 문자열이거나, 다시 시도 버튼이 붙은 요소 */
function errorToastText(): string {
  const content = vi.mocked(toast.error).mock.calls[0][0] as ReactNode;
  if (typeof content === 'string') return content;
  if (!isValidElement(content)) throw new Error('unexpected toast content');
  const { container } = render(<>{content}</>);
  return container.textContent ?? '';
}

beforeEach(() => {
  vi.spyOn(toast, 'success').mockReturnValue('ok');
  vi.spyOn(toast, 'error').mockReturnValue('err');
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('FeedbackDialog — 입력 검증', () => {
  it('비어 있으면 보내지 않고 칸마다 사유를 보인다', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const { user } = setup();

    // 처음에는 사유가 없다
    expect(screen.queryByText('유형을 선택해 주세요.')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '전송' }));

    expect(await screen.findByText('유형을 선택해 주세요.')).toBeInTheDocument();
    expect(screen.getByText('제목을 2자 이상 입력해 주세요.')).toBeInTheDocument();
    expect(screen.getByText('내용을 10자 이상 입력해 주세요.')).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('공백만으로는 길이를 채우지 못한다 · 글자 수는 자른 길이로 센다', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const { user } = setup();
    await user.type(screen.getByRole('textbox', { name: /내용/ }), '   123456789   ');
    await user.click(screen.getByRole('button', { name: '전송' }));
    expect(await screen.findByText('내용을 10자 이상 입력해 주세요.')).toBeInTheDocument();
    expect(screen.getByText('9/2000')).toBeInTheDocument();
  });

  it('넘는 입력은 칸이 막는다', () => {
    vi.stubGlobal('fetch', vi.fn());
    setup();
    expect(screen.getByRole('textbox', { name: /제목/ })).toHaveAttribute('maxLength', '100');
    expect(screen.getByRole('textbox', { name: /내용/ })).toHaveAttribute('maxLength', '2000');
  });
});

describe('FeedbackDialog — 전송', () => {
  it('201 이면 닫고, 감사 알림을 띄우고, 받은 건을 첫 페이지 맨 위에 넣는다', async () => {
    const fetch = respond(201, created);
    vi.stubGlobal('fetch', fetch);
    const queryClient = new QueryClient();
    const older = { id: 1, type: 'IDEA', title: '예전 것', status: 'ANSWERED', createdAt: '2026-10-01T00:00:00Z' };
    queryClient.setQueryData<MyFeedbackPage>(feedbackKeys.list(7, 1), {
      items: [older] as MyFeedbackPage['items'],
      total: 1,
      offset: 0,
      limit: 20,
    });
    const { user, onClose, onSent } = setup(queryClient);

    await fillValid(user);
    await user.click(screen.getByRole('button', { name: '전송' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onSent).toHaveBeenCalledWith(created);
    expect(toast.success).toHaveBeenCalledWith(SENT_MESSAGE);
    expect(toast.error).not.toHaveBeenCalled();

    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe(`${API_BASE}/api/feedbacks`);
    expect(JSON.parse(init.body)).toEqual({
      type: 'BUG',
      title: '출석 버튼',
      content: '아이폰에서 출석 버튼이 안 눌려요.',
      imageFileIds: [],
      viewport: { width: window.innerWidth, height: window.innerHeight },
    });

    const page = queryClient.getQueryData<MyFeedbackPage>(feedbackKeys.list(7, 1));
    expect(page?.items.map((i) => i.id)).toEqual([241, 1]);
    expect(page?.total).toBe(2);
  });

  it('429 이면 팝업을 두고 「잠시 후 다시 시도해 주세요.」', async () => {
    vi.stubGlobal(
      'fetch',
      respond(429, { errorCode: 'TOO_MANY_REQUESTS', errorMessage: '잠시 후 다시 시도해 주세요.' }),
    );
    const { user, onClose, onSent } = setup();

    await fillValid(user);
    await user.click(screen.getByRole('button', { name: '전송' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(errorToastText()).toBe(TOO_MANY_MESSAGE);
    expect(onClose).not.toHaveBeenCalled();
    expect(onSent).not.toHaveBeenCalled();
    // 입력은 남아 있다
    expect(screen.getByRole('textbox', { name: /제목/ })).toHaveValue('  출석 버튼  ');
  });

  it.each([
    ['400', () => respond(400, { errorCode: 'INVALID_INPUT', errorMessage: '입력값이 올바르지 않습니다.' })],
    ['500', () => respond(500, { errorCode: 'INTERNAL_ERROR', errorMessage: 'boom' })],
    ['네트워크 오류', () => vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))],
  ])('%s 이면 팝업을 두고 「의견을 보내지 못했습니다.」와 다시 시도', async (_label, makeFetch) => {
    vi.stubGlobal('fetch', makeFetch());
    const { user, onClose } = setup();

    await fillValid(user);
    await user.click(screen.getByRole('button', { name: '전송' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(errorToastText()).toBe(`${SEND_FAILED_MESSAGE}다시 시도`);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('보내는 동안 버튼이 잠긴다', async () => {
    let finish: (value: unknown) => void = () => {};
    vi.stubGlobal(
      'fetch',
      vi.fn().mockReturnValue(
        new Promise((resolve) => {
          finish = resolve;
        }),
      ),
    );
    const { user, onClose } = setup();

    await fillValid(user);
    await user.click(screen.getByRole('button', { name: '전송' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '전송' })).toBeDisabled());

    finish({ ok: true, status: 201, json: async () => created, text: async () => JSON.stringify(created) });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
