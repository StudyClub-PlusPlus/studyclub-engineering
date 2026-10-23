import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApplicationResultsTab } from './ApplicationResultsTab';
import type { ApplicationResultsResponse } from './types';

const url = vi.hoisted(() => ({ search: '', replace: vi.fn() }));
vi.mock('next/navigation', () => ({
  usePathname: () => '/studies/20',
  useSearchParams: () => new URLSearchParams(url.search),
  useRouter: () => ({ replace: url.replace }),
}));

const data: ApplicationResultsResponse = {
  respondentCount: 2,
  questions: [
    { id: 'choice', label: '관심 분야', type: 'CHECKBOX', options: ['백엔드', '프론트'], allowOther: true },
    { id: 'text', label: '지원 사유', type: 'TEXTAREA' },
    { id: 'empty', label: '', type: 'TEXT' },
  ],
  applications: [
    {
      id: 1,
      recruitmentId: 7,
      discordNickname: '별명1',
      email: 'one@example.com',
      answers: { choice: ['백엔드', '프론트', '직접 쓴 답'], text: '첫 줄\n둘째 줄' },
    },
    { id: 2, recruitmentId: 7, discordNickname: '별명2', email: null, answers: { choice: ['백엔드'], empty: [] } },
  ],
};
function mount(response = data, status = 200, canEditForm = false) {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(response), { status }));
  vi.stubGlobal('fetch', fetch);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onEditForm = vi.fn();
  const view = render(
    <QueryClientProvider client={client}>
      <ApplicationResultsTab studyId={20} canEditForm={canEditForm} onEditForm={onEditForm} />
    </QueryClientProvider>,
  );
  return { fetch, client, onEditForm, ...view };
}
afterEach(() => {
  url.search = '';
  url.replace.mockReset();
  vi.unstubAllGlobals();
});

describe('신청 결과', () => {
  it.each(['abc', '-1', '0', '1.5', '9223372036854775808'])(
    '잘못된 회차 %s는 요청하지 않고 복구 버튼을 제공한다',
    async (id) => {
      url.search = `tab=results&recruitmentId=${id}`;
      const { fetch } = mount();
      expect(screen.getByRole('alert')).toHaveTextContent('모집 회차를 확인');
      expect(fetch).not.toHaveBeenCalled();
      await userEvent.click(screen.getByRole('button', { name: '현재 모집 회차 보기' }));
      expect(url.replace).toHaveBeenCalledWith('/studies/20?tab=results', { scroll: false });
    },
  );

  it('재조회가 실패해도 기존 표를 유지하고 다시 시도할 수 있다', async () => {
    url.search = 'resultsView=individual';
    const { fetch, client } = mount();
    await screen.findByText('one@example.com');
    fetch.mockImplementation(() => Promise.resolve(new Response('{}', { status: 500 })));
    await act(async () => {
      await client.invalidateQueries();
    });
    expect(screen.getByText('one@example.com')).toBeVisible();
    expect(await screen.findByRole('alert')).toHaveTextContent('이전 결과를 표시합니다');
    fetch.mockImplementation(() => Promise.resolve(new Response(JSON.stringify(data))));
    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });

  it('기타를 허용하지 않는 보기 밖 답변은 구분해서 표시한다', async () => {
    mount({ ...data, questions: [{ ...data.questions[0]!, allowOther: false }] });
    expect(await screen.findByText('현재 보기에 없는 답변')).toBeVisible();
    expect(screen.getByText('직접 쓴 답')).toBeVisible();
    expect(screen.queryByText('기타 답변')).not.toBeInTheDocument();
  });

  it('알 수 없는 질문 유형은 기본 라벨과 원래 답변을 표시한다', async () => {
    mount({ ...data, questions: [{ ...data.questions[1]!, type: 'DATE' as never }] });
    expect(await screen.findByText('질문 · 1명 응답')).toBeVisible();
    expect(screen.getByText('첫 줄 둘째 줄')).toBeVisible();
  });
  it('질문별 집계는 복수 선택과 기타 답을 세고 개인정보를 노출하지 않는다', async () => {
    mount();
    const section = await screen.findByRole('region', { name: '1. 관심 분야' });
    expect(within(section).getByText('체크박스 · 2명 응답')).toBeVisible();
    expect(within(section).getByText('백엔드').closest('li')).toHaveTextContent('2명');
    expect(within(section).getByText('프론트').closest('li')).toHaveTextContent('1명');
    expect(within(section).getByText('직접 쓴 답')).toBeVisible();
    expect(screen.queryByText('별명1')).not.toBeInTheDocument();
    expect(screen.queryByText('one@example.com')).not.toBeInTheDocument();
    expect(screen.getByText('아직 답이 없습니다.')).toBeVisible();
    expect(screen.getByText('첫 줄 둘째 줄')).toHaveTextContent('첫 줄 둘째 줄');
  });
  it('응답자별은 답 전체와 빈 답을 표시하고 URL 회차를 API로 보낸다', async () => {
    url.search = 'tab=results&resultsView=individual&recruitmentId=7';
    const { fetch } = mount();
    expect(await screen.findByText('별명1')).toBeVisible();
    expect(screen.getByText('백엔드, 프론트, 직접 쓴 답')).toBeVisible();
    expect(screen.getAllByText('-').length).toBeGreaterThan(0);
    expect(fetch.mock.calls[0][0]).toContain('/applications?recruitmentId=7');
    await userEvent.click(screen.getByRole('tab', { name: '질문별' }));
    expect(url.replace).toHaveBeenCalledWith('/studies/20?tab=results&recruitmentId=7', { scroll: false });
  });
  it.each([true, false])('추가 질문이 없으면 모집 전(%s)에만 질문 추가를 안내한다', async (canEdit) => {
    const { onEditForm } = mount({ ...data, questions: [] }, 200, canEdit);
    await screen.findByText('이 스터디는 신청 폼에 추가 질문이 없습니다.');
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    if (canEdit) {
      await userEvent.click(screen.getByRole('button', { name: '신청 폼에서 질문 추가' }));
      expect(onEditForm).toHaveBeenCalledOnce();
    } else expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
  it('신청이 없으면 빈 상태를 표시한다', async () => {
    mount({ ...data, respondentCount: 0, applications: [] });
    expect(await screen.findByText('아직 들어온 신청이 없습니다.')).toBeVisible();
  });
  it('조회 실패 시 서버 원문을 표시하지 않고 다시 조회한다', async () => {
    const { fetch } = mount({ errorMessage: 'private@example.com' } as unknown as ApplicationResultsResponse, 500);
    expect(await screen.findByRole('alert')).toHaveTextContent('결과를 불러오지 못했습니다.');
    expect(screen.queryByText('private@example.com')).not.toBeInTheDocument();
    fetch.mockResolvedValue(new Response(JSON.stringify(data)));
    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    await screen.findByRole('region', { name: '1. 관심 분야' });
  });
  it('재조회에서 권한이 회수되면 캐시된 응답자 표를 숨긴다', async () => {
    url.search = 'resultsView=individual';
    const { fetch, client } = mount();
    await screen.findByText('one@example.com');
    fetch.mockResolvedValue(new Response('{}', { status: 403 }));
    await act(async () => {
      await client.invalidateQueries();
    });
    await waitFor(() => expect(screen.queryByRole('table')).not.toBeInTheDocument());
    expect(screen.getByRole('alert')).toHaveTextContent('이 스터디의 신청 결과를 볼 권한이 없습니다.');
  });
});
