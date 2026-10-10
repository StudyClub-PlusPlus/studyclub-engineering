import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApplicationFormTab } from './ApplicationFormTab';
import { applicationFormSchema, toFormValues, toPayload } from './schema';
import type { ApiStudyDetail } from '@/features/studies/types';

const study = { id: 106, title: '테스트 스터디', oneLineSummary: '함께 공부합니다.' } as ApiStudyDetail;
const response = { studyId: 106, title: study.title, description: study.oneLineSummary, questions: [] };
const onSavingChange = vi.fn();
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ApplicationFormTab study={study} onSavingChange={onSavingChange} />
    </QueryClientProvider>,
  );
}
function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('신청 폼', () => {
  it('조회 중이거나 실패하면 저장하지 못하고 다시 조회한다', async () => {
    let resolve!: (value: Response) => void;
    const fetch = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<Response>((done) => {
            resolve = done;
          }),
      )
      .mockResolvedValueOnce(reply(response));
    vi.stubGlobal('fetch', fetch);
    mount();
    expect(screen.getByRole('status')).toHaveTextContent('불러오는 중');
    expect(screen.queryByRole('button', { name: '저장' })).not.toBeInTheDocument();
    await act(async () => resolve(reply({}, 500)));
    expect(await screen.findByRole('alert')).toHaveTextContent('불러오지 못했습니다');
    expect(screen.queryByRole('button', { name: '저장' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(await screen.findByRole('button', { name: '저장' })).toBeEnabled();
  });

  it('추가 질문이 없어도 기본 문항을 제외한 빈 배열을 PUT으로 저장한다', async () => {
    const fetch = vi.fn().mockImplementation(() => Promise.resolve(reply(response)));
    vi.stubGlobal('fetch', fetch);
    mount();
    await userEvent.click(await screen.findByRole('button', { name: '저장' }));
    expect(await screen.findByRole('status')).toHaveTextContent('저장되었습니다.');
    const request = fetch.mock.calls.find(([, init]) => init?.method === 'PUT');
    expect(request?.[0]).toContain('/api/admin/studies/106/application-form');
    expect(JSON.parse(request?.[1].body).questions).toEqual([]);
    expect(request?.[1].credentials).toBe('include');
  });

  it('빈 질문을 저장하지 않고 오류가 난 카드를 연다', async () => {
    const fetch = vi.fn().mockImplementation(() => Promise.resolve(reply(response)));
    vi.stubGlobal('fetch', fetch);
    mount();
    await userEvent.click(await screen.findByRole('button', { name: '질문 추가' }));
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('button', { name: '저장' }));
    expect(await screen.findByText('질문 제목을 입력해 주세요.')).toBeVisible();
    expect(screen.getByRole('textbox', { name: '질문 제목' })).toHaveFocus();
    expect(fetch.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(false);
  });

  it('선택지를 Enter로 추가하고 타입을 바꾸면 옵션과 기타를 제거한다', async () => {
    const fetch = vi.fn().mockImplementation(() => Promise.resolve(reply(response)));
    vi.stubGlobal('fetch', fetch);
    mount();
    await userEvent.click(await screen.findByRole('button', { name: '질문 추가' }));
    await userEvent.type(screen.getByRole('textbox', { name: '질문 제목' }), '선호 시간');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: '질문 타입' }), 'radio');
    await userEvent.click(screen.getByRole('button', { name: '「기타」 추가' }));
    await userEvent.click(screen.getByRole('textbox', { name: '선택지 1' }));
    await userEvent.keyboard('{Enter}');
    expect(screen.getByRole('textbox', { name: '선택지 2' })).toHaveFocus();
    await userEvent.selectOptions(screen.getByRole('combobox', { name: '질문 타입' }), 'text');
    await userEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(fetch.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(true));
    const payload = JSON.parse(fetch.mock.calls.find(([, init]) => init?.method === 'PUT')?.[1].body);
    expect(payload.questions[0]).toMatchObject({ label: '선호 시간', type: 'TEXT', required: true });
    expect(payload.questions[0]).not.toHaveProperty('options');
    expect(payload.questions[0]).not.toHaveProperty('allowOther');
  });

  it.each([403, 409])('%s 저장 응답이면 편집 컨트롤을 제거한다', async (status) => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(reply(response))
      .mockResolvedValueOnce(reply({ errorMessage: '모집이 시작되어 신청 폼을 수정할 수 없습니다.' }, status));
    vi.stubGlobal('fetch', fetch);
    mount();
    await userEvent.click(await screen.findByRole('button', { name: '저장' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(status === 403 ? '권한이 없습니다' : '모집이 시작되어');
    expect(screen.queryByRole('button', { name: '저장' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '질문 추가' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '설문지 제목·설명 수정' })).not.toBeInTheDocument();
  });

  it('저장 중 중복 요청을 막고 실패한 내용을 유지해 재시도한다', async () => {
    let resolve!: (value: Response) => void;
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(reply(response))
      .mockImplementationOnce(
        () =>
          new Promise<Response>((done) => {
            resolve = done;
          }),
      )
      .mockImplementation(() => Promise.resolve(reply(response)));
    vi.stubGlobal('fetch', fetch);
    mount();
    await userEvent.click(await screen.findByRole('button', { name: '저장' }));
    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '질문 추가' })).toBeDisabled();
    expect(onSavingChange).toHaveBeenLastCalledWith(true);
    await act(async () => resolve(reply({}, 500)));
    await userEvent.click(await screen.findByRole('button', { name: '다시 시도' }));
    expect(await screen.findByRole('status')).toHaveTextContent('저장되었습니다.');
    const requests = fetch.mock.calls.filter(([, init]) => init?.method === 'PUT');
    expect(requests).toHaveLength(2);
    expect(requests[0][1].body).toBe(requests[1][1].body);
  });

  it('질문 순서를 바꾸고 마크다운의 실행 가능한 링크를 렌더하지 않는다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        reply({
          ...response,
          questions: [
            {
              id: 'a',
              label: '첫 질문',
              type: 'TEXT',
              required: true,
              description: '**굵게** [위험](javascript:alert(1)) <script>test</script>',
            },
            { id: 'b', label: '둘째 질문', type: 'TEXTAREA', required: false },
          ],
        }),
      ),
    );
    mount();
    await userEvent.click(await screen.findByRole('button', { name: '질문 2 위로' }));
    const first = screen.getByRole('region', { name: '질문 1' });
    expect(within(first).getByText('둘째 질문')).toBeVisible();
    expect(screen.queryByRole('link', { name: '위험' })).not.toBeInTheDocument();
    expect(document.querySelector('script')).toBeNull();
    fireEvent.dragStart(first);
    fireEvent.dragOver(screen.getByRole('region', { name: '질문 2' }));
    fireEvent.drop(screen.getByRole('region', { name: '질문 2' }));
    expect(within(screen.getByRole('region', { name: '질문 1' })).getByText('첫 질문')).toBeVisible();
  });
});

it('한 줄 문구를 정규화하고 빈 선택지·중복 ID를 거절한다', () => {
  const values = {
    title: ' 제목\n예시 ',
    description: '',
    questions: [{ id: 'a', label: ' 질문\t하나 ', type: 'radio' as const, required: true, options: [' A '] }],
  };
  expect(toPayload(values)).toMatchObject({
    title: '제목 예시',
    questions: [{ label: '질문 하나', options: ['A'], type: 'RADIO' }],
  });
  expect(
    applicationFormSchema.safeParse({ ...values, questions: [{ ...values.questions[0], options: ['  '] }] }).success,
  ).toBe(false);
  expect(
    applicationFormSchema.safeParse({ ...values, questions: [values.questions[0], values.questions[0]] }).success,
  ).toBe(false);
});

it('API가 돌려준 스터디 기본 문구는 빈 폼 값으로 복원한다', () => {
  expect(
    toFormValues(
      { studyId: 106, title: '테스트 스터디', description: '함께 공부합니다.', questions: [] },
      { title: '테스트 스터디', description: '함께 공부합니다.' },
    ),
  ).toMatchObject({ title: '', description: '' });
});
