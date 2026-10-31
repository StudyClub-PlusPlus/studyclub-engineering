import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  fetchMyFeedback,
  fetchMyFeedbacks,
  prependCreated,
  submitFeedback,
  uploadFeedbackImage,
  type MyFeedbackItem,
} from './queries';
import { API_BASE, ApiError } from '../../lib/http';

function respond(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const item = (id: number, over: Partial<MyFeedbackItem> = {}): MyFeedbackItem => ({
  id,
  type: 'BUG',
  title: `문의 ${id}`,
  status: 'RECEIVED',
  createdAt: '2026-10-25T08:12:40Z',
  ...over,
});

describe('fetchMyFeedbacks', () => {
  it('페이지를 offset · limit(20) 으로 바꿔 부르고 응답을 그대로 돌려준다', async () => {
    const page = {
      items: [item(241), item(198, { type: 'QUESTION', status: 'ANSWERED' })],
      total: 2,
      offset: 20,
      limit: 20,
    };
    const fetch = respond(200, page);
    vi.stubGlobal('fetch', fetch);

    await expect(fetchMyFeedbacks(2)).resolves.toEqual(page);
    expect(fetch).toHaveBeenCalledWith(
      `${API_BASE}/api/me/feedbacks?offset=20&limit=20`,
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('1 보다 작은 페이지는 첫 페이지로', async () => {
    const fetch = respond(200, { items: [], total: 0, offset: 0, limit: 20 });
    vi.stubGlobal('fetch', fetch);
    await fetchMyFeedbacks(0);
    expect(fetch.mock.calls[0][0]).toBe(`${API_BASE}/api/me/feedbacks?offset=0&limit=20`);
  });
});

describe('fetchMyFeedback', () => {
  it('상세 — 회신 · 이미지를 그대로 준다', async () => {
    const detail = {
      ...item(198, { status: 'ANSWERED' }),
      content: '<b>평문</b>\n둘째 줄',
      images: [{ url: 'https://cdn.example/a.webp' }],
      reply: { content: '답변', repliedAt: '2026-10-13T02:30:00Z' },
    };
    vi.stubGlobal('fetch', respond(200, detail));
    await expect(fetchMyFeedback(198)).resolves.toEqual(detail);
  });

  it('남의 것 · 없는 번호는 404 ApiError', async () => {
    vi.stubGlobal('fetch', respond(404, { errorCode: 'NOT_FOUND', errorMessage: '요청한 리소스를 찾을 수 없습니다.' }));
    const err = await fetchMyFeedback(1).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(404);
  });
});

describe('submitFeedback', () => {
  it('POST /api/feedbacks 에 JSON 본문을 싣고 201 응답(목록 한 줄)을 돌려준다', async () => {
    const created = item(241);
    const fetch = respond(201, created);
    vi.stubGlobal('fetch', fetch);
    const body = {
      type: 'BUG' as const,
      title: '출석 버튼',
      content: '아이폰에서 출석 버튼이 안 눌려요.',
      imageFileIds: [812],
      viewport: { width: 390, height: 844 },
    };

    await expect(submitFeedback(body)).resolves.toEqual(created);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe(`${API_BASE}/api/feedbacks`);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual(body);
    expect(new Headers(init.headers).get('Content-Type')).toBe('application/json');
  });

  it('429 는 상태를 그대로 던진다', async () => {
    vi.stubGlobal(
      'fetch',
      respond(429, { errorCode: 'TOO_MANY_REQUESTS', errorMessage: '잠시 후 다시 시도해 주세요.' }),
    );
    const err = await submitFeedback({
      type: 'IDEA',
      title: 'ab',
      content: '1234567890',
      imageFileIds: [],
      viewport: { width: 1, height: 1 },
    }).catch((e: unknown) => e);
    expect((err as ApiError).status).toBe(429);
  });
});

describe('uploadFeedbackImage', () => {
  it('공용 업로드에 purpose=FEEDBACK 으로 올린다', async () => {
    const fetch = respond(201, { fileId: 812, url: 'https://cdn.example/a.webp' });
    vi.stubGlobal('fetch', fetch);
    await expect(uploadFeedbackImage(new File(['x'], 'a.png', { type: 'image/png' }))).resolves.toEqual({
      fileId: 812,
      url: 'https://cdn.example/a.webp',
    });
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe(`${API_BASE}/api/uploads/images`);
    expect((init.body as FormData).get('purpose')).toBe('FEEDBACK');
  });
});

describe('prependCreated', () => {
  it('방금 보낸 건을 첫 페이지 맨 위에 넣고 총 건수를 늘린다', () => {
    const page = { items: [item(2), item(1)], total: 2, offset: 0, limit: 20 };
    expect(prependCreated(page, item(3))).toEqual({
      items: [item(3), item(2), item(1)],
      total: 3,
      offset: 0,
      limit: 20,
    });
  });

  it('한 페이지 크기를 넘지 않는다', () => {
    const items = Array.from({ length: 20 }, (_, i) => item(20 - i));
    const next = prependCreated({ items, total: 25, offset: 0, limit: 20 }, item(99));
    expect(next?.items).toHaveLength(20);
    expect(next?.items[0].id).toBe(99);
    expect(next?.items[19].id).toBe(2);
    expect(next?.total).toBe(26);
  });

  it('첫 페이지를 받은 적이 없으면 그대로 둔다', () => {
    expect(prependCreated(undefined, item(1))).toBeUndefined();
  });
});
