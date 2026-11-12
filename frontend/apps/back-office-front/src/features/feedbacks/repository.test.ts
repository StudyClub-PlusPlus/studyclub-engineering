import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchFeedback, fetchFeedbacks, patchFeedback } from './repository';
import type { ApiAdminFeedback, ApiAdminFeedbackDetail } from './types';
import { ApiResponseError } from '@/lib/http';

const item: ApiAdminFeedback = {
  id: 241,
  createdAt: '2026-10-25T08:12:40Z',
  type: 'BUG',
  title: '출석 버튼 오류',
  submitter: { nickname: null },
  status: 'NEW',
  doneBy: null,
};

const detail: ApiAdminFeedbackDetail = {
  ...item,
  selectableStatuses: ['NEW', 'SEEN'],
  content: '출석 버튼을 눌러도 반응이 없어요.',
  images: [],
  browser: null,
  viewport: null,
  reply: null,
  adminMemo: null,
};

function respond(body: unknown) {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }));
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

afterEach(() => vi.unstubAllGlobals());

describe('문의 API 응답 검증', () => {
  it('미완료 문의와 완료 처리자가 탈퇴한 문의를 구분해 받는다', async () => {
    const page = {
      items: [item, { ...item, id: 242, status: 'DONE', doneBy: { nickname: null } }],
      total: 2,
      offset: 0,
      limit: 20,
    };
    respond(page);

    await expect(fetchFeedbacks({ offset: 0, limit: 20 })).resolves.toEqual(page);
  });

  it('회신·메모·환경 정보가 없는 상세도 받는다', async () => {
    respond(detail);

    await expect(fetchFeedback(241)).resolves.toEqual(detail);
  });

  it('회신을 PATCH 본문에 보내고 완료된 상세 응답을 받는다', async () => {
    const reply = '확인 후 출석 버튼 오류를 수정했습니다.';
    const answered: ApiAdminFeedbackDetail = {
      ...detail,
      status: 'DONE',
      selectableStatuses: [],
      doneBy: { nickname: null },
      reply: { content: reply, repliedAt: '2026-10-25T09:00:00Z' },
    };
    const fetch = respond(answered);

    await expect(patchFeedback(241, { reply })).resolves.toEqual(answered);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/admin\/feedbacks\/241$/),
      expect.objectContaining({
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reply }),
      }),
    );
  });

  it('사용자 화면의 상태가 운영 응답에 오면 잘못된 응답으로 처리한다', async () => {
    respond({ ...detail, status: 'ANSWERED' });

    await expect(fetchFeedback(241)).rejects.toBeInstanceOf(ApiResponseError);
  });
});
