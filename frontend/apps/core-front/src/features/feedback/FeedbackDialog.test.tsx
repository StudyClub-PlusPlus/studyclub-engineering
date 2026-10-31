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

function response(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

function respond(status: number, body: unknown) {
  return vi.fn().mockResolvedValue(response(status, body));
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

    finish(response(201, created));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});

describe('FeedbackDialog — 첨부', () => {
  type Reply = ReturnType<typeof response>;
  const uploaded = (fileId: number): Reply => response(201, { fileId, url: `https://cdn.test/${fileId}.png` });
  const uploadFailed = response(400, { errorCode: 'INVALID_INPUT', errorMessage: '올릴 수 없는 파일입니다.' });
  const sendFailed = response(500, { errorCode: 'INTERNAL_ERROR', errorMessage: 'boom' });
  const sent = response(201, created);

  /** 파일 이름마다 응답을 손으로 푼다 — 업로드가 끝나는 순서를 테스트가 정한다 */
  function stubServer(sendReplies: Reply[]) {
    const pending = new Map<string, (reply: Reply) => void>();
    const submits: { imageFileIds: number[] }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init: RequestInit) => {
        if (url.endsWith('/api/uploads/images')) {
          const { name } = (init.body as FormData).get('file') as File;
          return new Promise<Reply>((resolve) => pending.set(name, resolve));
        }
        submits.push(JSON.parse(init.body as string));
        return Promise.resolve(sendReplies.shift());
      }),
    );
    return { pending, submits };
  }

  const png = (name: string) => new File(['x'], name, { type: 'image/png' });
  const input = () => screen.getByTestId('feedback-image-input') as HTMLInputElement;
  const finishUpload = async (pending: Map<string, (reply: Reply) => void>, name: string, reply: Reply) => {
    await waitFor(() => expect(pending.has(name)).toBe(true));
    pending.get(name)!(reply);
  };
  const sendEnabled = () => waitFor(() => expect(screen.getByRole('button', { name: '전송' })).toBeEnabled());

  /** 오류 알림의 「다시 시도」 — 실제 알림처럼 실패 당시 만들어진 그 요소를 그대로 그려 누른다 */
  async function clickToastRetry(user: ReturnType<typeof userEvent.setup>) {
    const content = vi.mocked(toast.error).mock.calls.at(-1)![0] as ReactNode;
    const { getByRole, unmount } = render(<>{content}</>);
    await user.click(getByRole('button', { name: '다시 시도' }));
    unmount();
  }

  beforeEach(() => {
    let n = 0;
    URL.createObjectURL = vi.fn(() => `blob:preview-${n++}`);
    URL.revokeObjectURL = vi.fn();
  });

  it('다시 시도는 지금 화면의 첨부를 보낸다 — 실패 뒤 사진을 바꾸면 바뀐 사진이 간다', async () => {
    const { pending, submits } = stubServer([sendFailed, sent]);
    const { user, onClose } = setup();
    await fillValid(user);

    await user.upload(input(), png('a.png'));
    await finishUpload(pending, 'a.png', uploaded(11));
    await sendEnabled();
    await user.click(screen.getByRole('button', { name: '전송' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(submits[0].imageFileIds).toEqual([11]);

    await user.click(screen.getByRole('button', { name: '첨부 이미지 1 빼기' }));
    await user.upload(input(), png('b.png'));
    await finishUpload(pending, 'b.png', uploaded(22));
    await sendEnabled();

    await clickToastRetry(user);

    await waitFor(() => expect(submits).toHaveLength(2));
    expect(submits[1].imageFileIds).toEqual([22]);
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('새 사진이 올라가는 중이면 다시 시도가 보내지 않는다 — 다 올라간 뒤 누르면 함께 간다', async () => {
    const { pending, submits } = stubServer([sendFailed, sent]);
    const { user } = setup();
    await fillValid(user);

    await user.click(screen.getByRole('button', { name: '전송' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    await user.upload(input(), png('b.png'));

    await clickToastRetry(user);
    expect(submits).toHaveLength(1);

    await finishUpload(pending, 'b.png', uploaded(22));
    await sendEnabled();
    await clickToastRetry(user);

    await waitFor(() => expect(submits).toHaveLength(2));
    expect(submits[1].imageFileIds).toEqual([22]);
  });

  it('올리는 중에 뺀 사진이 뒤늦게 실패해도 장수가 틀어지지 않는다 — 3장을 넘지 않고 오류도 띄우지 않는다', async () => {
    const { pending, submits } = stubServer([sent]);
    const { user } = setup();
    await fillValid(user);

    await user.upload(input(), [png('a.png'), png('b.png'), png('c.png')]);
    await user.click(screen.getByRole('button', { name: '첨부 이미지 1 빼기' }));
    await finishUpload(pending, 'a.png', uploadFailed);
    await finishUpload(pending, 'b.png', uploaded(22));
    await finishUpload(pending, 'c.png', uploaded(33));
    await waitFor(() => expect(screen.getByText('2/3')).toBeInTheDocument());
    expect(screen.queryByText('올릴 수 없는 파일입니다.')).not.toBeInTheDocument();

    // 한 자리만 남았으니 둘 중 하나만 받는다
    await user.upload(input(), [png('d.png'), png('e.png')]);
    expect(await screen.findByText('이미지는 최대 3장까지 첨부할 수 있습니다.')).toBeInTheDocument();
    expect(screen.getByText('3/3')).toBeInTheDocument();
    await finishUpload(pending, 'd.png', uploaded(44));
    expect(pending.has('e.png')).toBe(false);
    await sendEnabled();

    await user.click(screen.getByRole('button', { name: '전송' }));
    await waitFor(() => expect(submits).toHaveLength(1));
    expect(submits[0].imageFileIds).toEqual([22, 33, 44]);
  });

  it('아직 첨부에 남아 있는 사진이 실패하면 빼고 사유를 띄운다', async () => {
    const { pending } = stubServer([]);
    const { user } = setup();

    await user.upload(input(), png('a.png'));
    await finishUpload(pending, 'a.png', uploadFailed);

    expect(await screen.findByText('올릴 수 없는 파일입니다.')).toBeInTheDocument();
    expect(screen.getByText('0/3')).toBeInTheDocument();
  });
});
