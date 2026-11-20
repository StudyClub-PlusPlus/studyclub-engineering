import type { ReactElement } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PublishSwitch } from '@/features/studies/PublishSwitch';
import type { ApiStudyDetail } from '@/features/studies/types';

const routerRefresh = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: routerRefresh }) }));

function renderWithClient(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const detail = (patch: Partial<ApiStudyDetail>) =>
  ({ id: 7, title: '데일리 리트코드', status: 'DRAFT', ...patch }) as ApiStudyDetail;

/** 신청 폼 조회 · 공개 호출을 나눠 응답한다. */
function mockApi(questions: number, publishStatus = 204) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    if (url.endsWith('/application-form')) {
      return new Response(
        JSON.stringify({
          studyId: 7,
          title: '',
          description: null,
          questions: Array.from({ length: questions }, (_, i) => ({
            id: `q${i}`,
            label: '질문',
            type: 'TEXT',
            required: false,
          })),
        }),
        {
          status: 200,
        },
      );
    }
    return new Response(null, { status: publishStatus });
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  routerRefresh.mockReset();
});

describe('상세 머리 「사이트 공개」 스위치', () => {
  it('미공개 + 폼 있음 → 켜면 확인 팝업, 「공개」를 눌러야 publish 를 부르고 다시 받는다', async () => {
    const fetchMock = mockApi(1);
    renderWithClient(<PublishSwitch detail={detail({ status: 'DRAFT' })} />);

    const toggle = screen.getByRole('switch', { name: /사이트 공개/ });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    await waitFor(() => expect(toggle).not.toHaveAttribute('aria-disabled'));

    fireEvent.click(toggle);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('‘데일리 리트코드’ 스터디를 공개하시겠습니까?')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: '공개' }));

    await waitFor(() => expect(routerRefresh).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/admin\/studies\/7\/publish$/),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('미공개 + 질문 없는 폼 → 막혀 있고 이유가 아래에 보인다', async () => {
    mockApi(0);
    renderWithClient(<PublishSwitch detail={detail({ status: 'DRAFT' })} />);

    expect(await screen.findByText('신청 폼을 먼저 연결하세요.')).toBeInTheDocument();
    const toggle = screen.getByRole('switch', { name: /사이트 공개/ });
    expect(toggle).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(toggle);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('개설(OPEN) → 켜져 있고, 끄면 비공개 확인 후 unpublish', async () => {
    const fetchMock = mockApi(1);
    renderWithClient(<PublishSwitch detail={detail({ status: 'OPEN' })} />);

    const toggle = screen.getByRole('switch', { name: /사이트 공개/ });
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(toggle);
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '비공개로 전환' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/admin\/studies\/7\/unpublish$/),
        expect.objectContaining({ method: 'POST' }),
      ),
    );
  });

  it('진행 중 → 켜져 있지만 바꿀 수 없고 이유를 알려 준다', () => {
    mockApi(1);
    renderWithClient(<PublishSwitch detail={detail({ status: 'ONGOING' })} />);

    expect(screen.getByRole('switch', { name: /사이트 공개/ })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText('진행 중이거나 종료된 스터디는 비공개로 돌릴 수 없습니다.')).toBeInTheDocument();
  });
});
