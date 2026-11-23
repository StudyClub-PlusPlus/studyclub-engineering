import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EventConsole } from '@/features/events/EventConsole';
import { EventCreateDialog } from '@/features/events/EventCreateDialog';
import { useIdempotencyKey } from '@/features/events/queries';
import type { EventDetail, EventRegistrationPage } from '@/features/events/types';
import { ApiError, http } from '@/lib/http';

vi.mock('@/lib/http', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/http')>()),
  http: vi.fn(),
}));

const memoryUrl = vi.hoisted(() => {
  let search = '';
  const listeners = new Set<() => void>();
  return {
    get: () => search,
    set: (next: string) => {
      search = next;
      listeners.forEach((l) => l());
    },
    subscribe: (l: () => void) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
});

vi.mock('next/navigation', async () => {
  const { useMemo, useSyncExternalStore } = await import('react');
  const router = { push: vi.fn(), replace: (url: string) => memoryUrl.set(url.includes('?') ? url.slice(url.indexOf('?') + 1) : '') };
  return {
    useSearchParams: () => {
      const search = useSyncExternalStore(memoryUrl.subscribe, memoryUrl.get);
      return useMemo(() => new URLSearchParams(search), [search]);
    },
    useRouter: () => router,
    usePathname: () => '/events/7',
  };
});

const httpMock = vi.mocked(http);

function detail(patch: Partial<EventDetail> = {}): EventDetail {
  return {
    eventId: 7,
    version: 3,
    title: '연말 네트워킹 밋업',
    summary: '소개',
    description: '본문',
    timeZone: 'Asia/Seoul',
    startsAt: '2026-12-05T10:00:00Z',
    endsAt: null,
    effectiveEndsAt: '2026-12-05T15:00:00Z',
    deadlineAt: '2026-12-03T14:59:00Z',
    format: 'ONLINE',
    offline: null,
    online: { capacity: 100, url: null },
    confirmation: 'REVIEW',
    status: 'PUBLISHED',
    displayStatus: 'RECRUITING',
    publishedAt: '2026-11-18T05:00:00Z',
    questions: [],
    seats: [{ channel: 'ONLINE', capacity: 100, pending: 1, confirmed: 2, remaining: 97 }],
    canEdit: true,
    canChangeConfirmation: true,
    canSetFutureStart: true,
    removableChannels: [],
    canClose: true,
    canReopen: false,
    reopenBlockedReason: null,
    canCancel: true,
    hasCancellationRecipients: true,
    cancellationRecipientCount: 3,
    createdAt: '2026-11-18T05:00:00Z',
    updatedAt: '2026-11-18T05:00:00Z',
    ...patch,
  };
}

const registrations: EventRegistrationPage = {
  canManageRegistrations: true,
  pendingCount: 1,
  total: 2,
  offset: 0,
  limit: 20,
  items: [
    {
      registrationId: 312,
      accountId: 48,
      nickname: '수현',
      accountDeleted: false,
      maskedEmail: 's***@naver.com',
      channel: 'ONLINE',
      status: 'PENDING',
      createdAt: '2026-11-20T03:14:00Z',
      canConfirm: true,
      canDecline: true,
      canCancel: true,
    },
    {
      registrationId: 251,
      accountId: 17,
      nickname: null,
      accountDeleted: true,
      maskedEmail: null,
      channel: 'ONLINE',
      status: 'CANCELLED',
      createdAt: '2026-11-18T09:40:00Z',
      canConfirm: false,
      canDecline: false,
      canCancel: false,
    },
  ],
};

function renderConsole(value: EventDetail, refetch = vi.fn().mockResolvedValue(undefined)) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <EventConsole detail={value} refetch={refetch} />
    </QueryClientProvider>,
  );
  return refetch;
}

function bodyOf(path: string) {
  const call = httpMock.mock.calls.find(([p]) => p === path);
  return call?.[2]?.body ? JSON.parse(String(call[2].body)) : undefined;
}

beforeEach(() => {
  memoryUrl.set('');
  httpMock.mockReset();
  httpMock.mockImplementation(async (path: string) => {
    if (path.startsWith('/api/admin/events/7/registrations?')) return registrations;
    if (path.includes('/email-reveals')) return { registrationId: 312, accountId: 48, email: 'suhyeon@example.com' };
    return null as never;
  });
});

describe('행사 운영 상세', () => {
  it('버튼은 서버의 can 판정대로만 보인다', async () => {
    renderConsole(detail({ canClose: false, canCancel: false }));
    expect(screen.queryByRole('button', { name: '모집 마감' })).toBeNull();
    expect(screen.queryByRole('button', { name: '행사 취소' })).toBeNull();
    expect(await screen.findByText('전체 신청 이력 2건')).toBeInTheDocument();
  });

  it('모집 마감은 확인창 뒤 상세의 version 과 함께 보낸다', async () => {
    const user = userEvent.setup();
    renderConsole(detail());
    await user.click(screen.getByRole('button', { name: '모집 마감' }));
    httpMock.mockImplementationOnce(async () => detail({ status: 'CLOSED', version: 4 }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '모집 마감' }));
    await waitFor(() => expect(bodyOf('/api/admin/events/7/status')).toEqual({ status: 'CLOSED', version: 3 }));
  });

  it('버전 충돌이면 이유를 알리고 상세를 다시 읽는다', async () => {
    const user = userEvent.setup();
    const refetch = renderConsole(detail());
    await user.click(screen.getByRole('button', { name: '행사 취소' }));
    httpMock.mockRejectedValueOnce(new ApiError(409, '버전', 'EVENT_VERSION_CONFLICT'));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '행사 취소' }));
    expect(await screen.findByText(/다른 캡틴이 먼저 저장했거나/)).toBeInTheDocument();
    expect(refetch).toHaveBeenCalled();
  });

  it('다시 열 수 없는 이유가 있으면 API 를 부르지 않고 이유를 안내한다', async () => {
    const user = userEvent.setup();
    renderConsole(detail({ status: 'CLOSED', canClose: false, reopenBlockedReason: 'DEADLINE_PASSED' }));
    await user.click(screen.getByRole('button', { name: '모집 다시 열기' }));
    expect(screen.getByText(/신청 마감 시간이 지났어요/)).toBeInTheDocument();
    expect(httpMock.mock.calls.some(([p]) => p === '/api/admin/events/7/status')).toBe(false);
  });

  it('이메일은 마스킹으로 시작하고 눈 아이콘을 누른 행만 펼친다. 탈퇴한 회원 행에는 아이콘이 없다', async () => {
    const user = userEvent.setup();
    renderConsole(detail());
    expect(await screen.findByText('s***@naver.com')).toBeInTheDocument();
    expect(screen.getByText('탈퇴한 회원')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /이메일/ })).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: '수현 이메일 보기' }));
    expect(await screen.findByText('suhyeon@example.com')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '수현 이메일 가리기' }));
    expect(screen.getByText('s***@naver.com')).toBeInTheDocument();
  });

  it('참가 확정은 바로, 참가 불가는 확인창 뒤에 처리한다', async () => {
    const user = userEvent.setup();
    renderConsole(detail());
    await screen.findByText('s***@naver.com');
    await user.click(screen.getByRole('button', { name: '참가 확정' }));
    await waitFor(() =>
      expect(bodyOf('/api/admin/events/7/registrations/312')).toEqual({ status: 'CONFIRMED' }),
    );
    httpMock.mockClear();
    await user.click(screen.getByRole('button', { name: '참가 불가' }));
    expect(httpMock.mock.calls.some(([, , init]) => init?.method === 'PATCH')).toBe(false);
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '참가 불가' }));
    await waitFor(() =>
      expect(bodyOf('/api/admin/events/7/registrations/312')).toEqual({ status: 'DECLINED' }),
    );
  });

  it('취소된 행사는 안내 대상이 있을 때만 취소 안내 메일 버튼을 보인다', async () => {
    const cancelled = detail({ status: 'CANCELLED', canClose: false, canCancel: false, canEdit: false });
    renderConsole({ ...cancelled, hasCancellationRecipients: false });
    await screen.findByText('전체 신청 이력 2건');
    expect(screen.queryByRole('button', { name: '취소 안내 메일 보내기' })).toBeNull();
  });

  it('취소된 행사에 안내 대상이 있으면 작성창을 열고, 멱등 키와 템플릿 ID 를 실어 보낸다', async () => {
    const user = userEvent.setup();
    renderConsole(detail({ status: 'CANCELLED', canClose: false, canCancel: false, canEdit: false }));
    httpMock.mockImplementation(async (path: string, _schema, init) => {
      if (path.startsWith('/api/admin/events/7/registrations?')) return registrations;
      if (path.endsWith('/mails/preview'))
        return {
          type: 'CANCELLATION',
          audience: 'CANCELLED_ACTIVE',
          templateId: 5,
          templateExists: true,
          subject: '[StudyClub] 행사 취소',
          body: '본문',
          format: 'TEXT',
          displayTimeZone: 'Asia/Seoul',
          recipientCount: 3,
          canSend: false,
          blockedReason: 'NOTICE_REQUIRED',
        };
      if (path === '/api/admin/events/7/mails' && init?.method === 'POST')
        return { mailId: 1, type: 'CANCELLATION', subject: 's', body: 'b', format: 'TEXT', audience: 'CANCELLED_ACTIVE', recipientCount: 3, maskedRecipients: [], createdAt: '2026-11-20T00:00:00Z' };
      return { items: [], total: 0, offset: 0, limit: 20 };
    });
    await user.click(await screen.findByRole('button', { name: '취소 안내 메일 보내기' }));
    expect(await screen.findByText('받는 사람 3명')).toBeInTheDocument();
    // 취소 안내의 기본 문구가 채워져 있어 바로 보낼 수 있다
    const send = within(screen.getByRole('dialog')).getByRole('button', { name: '취소 안내 메일 보내기' });
    await waitFor(() => expect(send).toBeEnabled());
    await user.click(send);
    await waitFor(() => {
      const call = httpMock.mock.calls.find(([p, , i]) => p === '/api/admin/events/7/mails' && i?.method === 'POST');
      expect(call?.[2]?.headers).toMatchObject({ 'Idempotency-Key': expect.stringMatching(/^[0-9a-f-]{36}$/) });
      expect(JSON.parse(String(call?.[2]?.body))).toMatchObject({ type: 'CANCELLATION', audience: 'CANCELLED_ACTIVE', templateId: 5 });
    });
  });
});

describe('멱등 키', () => {
  it('같은 내용의 재시도만 같은 키를 쓰고, 내용이 바뀌거나 비우면 새 키다', () => {
    const { result } = renderHook(() => useIdempotencyKey());
    const first = result.current.current('a');
    expect(result.current.current('a')).toBe(first);
    const changed = result.current.current('b');
    expect(changed).not.toBe(first);
    result.current.clear();
    expect(result.current.current('b')).not.toBe(changed);
  });
});

describe('행사 정보 수정', () => {
  const putOf = () => httpMock.mock.calls.find(([, , init]) => init?.method === 'PUT');

  beforeEach(() => memoryUrl.set('tab=info'));

  it('신청이 없는 단일 방식 행사는 다른 방식으로 바꿔 저장할 수 있다', async () => {
    const user = userEvent.setup();
    renderConsole(detail({ seats: [{ channel: 'ONLINE', capacity: 100, pending: 0, confirmed: 0, remaining: 100 }] }));
    await user.selectOptions(screen.getByLabelText('참여 방식'), 'OFFLINE');
    await user.type(screen.getByLabelText(/오프라인 장소/), '강남');
    httpMock.mockImplementationOnce(async () => detail({ version: 4 }));
    await user.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(putOf()).toBeDefined());
    expect(JSON.parse(String(putOf()![2]!.body))).toMatchObject({
      version: 3,
      format: 'OFFLINE',
      online: null,
      offline: { capacity: 20, location: '강남' },
    });
  });

  it('신청자가 남은 참여 방식은 없앨 수 없다고 알리고 보내지 않는다', async () => {
    const user = userEvent.setup();
    renderConsole(detail());
    await user.selectOptions(screen.getByLabelText('참여 방식'), 'OFFLINE');
    await user.type(screen.getByLabelText(/오프라인 장소/), '강남');
    await user.click(screen.getByRole('button', { name: '저장' }));
    expect(await screen.findByText(/참여 방식은 없앨 수 없어요/)).toBeInTheDocument();
    expect(putOf()).toBeUndefined();
  });

  it('버전 충돌이면 입력을 유지한 채 다시 불러오기를 안내하고, 탭을 다녀오면 알림은 사라진다', async () => {
    const user = userEvent.setup();
    const refetch = renderConsole(detail());
    await user.type(screen.getByLabelText(/행사명/), ' 수정');
    httpMock.mockRejectedValueOnce(new ApiError(409, '충돌', 'EVENT_VERSION_CONFLICT'));
    await user.click(screen.getByRole('button', { name: '저장' }));
    expect(await screen.findByText(/다른 캡틴이 먼저 저장했거나/)).toBeInTheDocument();
    expect(screen.getByLabelText(/행사명/)).toHaveValue('연말 네트워킹 밋업 수정');
    await user.click(screen.getByRole('button', { name: '최신 정보 다시 불러오기' }));
    expect(refetch).toHaveBeenCalled();

    httpMock.mockRejectedValueOnce(new ApiError(409, '충돌', 'EVENT_VERSION_CONFLICT'));
    await user.click(screen.getByRole('button', { name: '저장' }));
    await screen.findByText(/다른 캡틴이 먼저 저장했거나/);
    await user.click(screen.getByRole('tab', { name: /^참가자/ }));
    await user.click(screen.getByRole('tab', { name: '행사 정보·신청폼' }));
    expect(screen.queryByText(/다른 캡틴이 먼저 저장했거나/)).toBeNull();
  });
});

describe('참가자 탭', () => {
  it('이메일 보기를 두 행에 연달아 눌러도 두 행 모두 펼쳐진다', async () => {
    const user = userEvent.setup();
    const second = { ...registrations.items[0]!, registrationId: 313, nickname: '민지', maskedEmail: 'm***@naver.com' };
    const resolvers: Record<number, () => void> = {};
    httpMock.mockImplementation(async (path: string) => {
      if (path.startsWith('/api/admin/events/7/registrations?')) return { ...registrations, items: [registrations.items[0]!, second] };
      const id = Number(/registrations\/(\d+)\/email-reveals/.exec(path)?.[1]);
      await new Promise<void>((resolve) => (resolvers[id] = resolve));
      return { registrationId: id, accountId: 1, email: `${id}@example.com` };
    });
    renderConsole(detail());
    await user.click(await screen.findByRole('button', { name: '수현 이메일 보기' }));
    await user.click(screen.getByRole('button', { name: '민지 이메일 보기' }));
    resolvers[312]!();
    resolvers[313]!();
    expect(await screen.findByText('312@example.com')).toBeInTheDocument();
    expect(await screen.findByText('313@example.com')).toBeInTheDocument();
    expect(screen.queryByText('확인 중…')).toBeNull();
  });

  it('범위 밖 페이지 주소는 마지막 페이지로 돌려보낸다', async () => {
    memoryUrl.set('page=9');
    httpMock.mockImplementation(async (path: string) =>
      path.startsWith('/api/admin/events/7/registrations?') ? { ...registrations, items: [], offset: 160 } : (null as never),
    );
    renderConsole(detail());
    await waitFor(() => expect(memoryUrl.get()).not.toContain('page=9'));
  });
});

describe('상태 전환 실패', () => {
  it('신청 마감이 지나 다시 열 수 없으면 이유를 알리고 행사 정보 탭으로 보낸다', async () => {
    const user = userEvent.setup();
    const refetch = renderConsole(detail({ status: 'CLOSED', canClose: false, canReopen: true }));
    await user.click(screen.getByRole('button', { name: '모집 다시 열기' }));
    httpMock.mockRejectedValueOnce(new ApiError(409, '마감', 'EVENT_REOPEN_DEADLINE_PASSED'));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '모집 다시 열기' }));
    expect(await screen.findByText(/신청 마감 시간이 지났어요/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '기본 정보' })).toBeInTheDocument();
    expect(refetch).toHaveBeenCalled();
  });
});

describe('안내 메일 409', () => {
  it('받는 사람이 없어졌으면 미리보기를 다시 부른다', async () => {
    const user = userEvent.setup();
    renderConsole(detail());
    let previews = 0;
    httpMock.mockImplementation(async (path: string, _schema, init) => {
      if (path.startsWith('/api/admin/events/7/registrations?')) return registrations;
      if (path.endsWith('/mails/preview')) {
        previews += 1;
        return { type: 'ANNOUNCEMENT', audience: 'ALL', templateId: 3, templateExists: true, subject: 's', body: 'b', format: 'TEXT', displayTimeZone: 'Asia/Seoul', recipientCount: 2, canSend: false, blockedReason: 'NOTICE_REQUIRED' };
      }
      if (path === '/api/admin/events/7/mails' && init?.method === 'POST') throw new ApiError(409, '없음', 'EVENT_MAIL_NO_RECIPIENTS');
      return null as never;
    });
    await user.click(await screen.findByRole('button', { name: '안내 메일 보내기' }));
    await screen.findByText('받는 사람 2명');
    await user.type(screen.getByLabelText(/안내 내용/), '공지');
    const before = previews;
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '안내 메일 보내기' }));
    await waitFor(() => expect(previews).toBeGreaterThan(before));
    expect(await screen.findByText('없음')).toBeInTheDocument();
  });
});

describe('행사 등록', () => {
  function fill() {
    fireEvent.change(screen.getByLabelText(/행사명/), { target: { value: '새 행사' } });
    fireEvent.change(screen.getByLabelText(/한 줄 소개/), { target: { value: '소개' } });
    fireEvent.change(screen.getByLabelText(/모집 상세/), { target: { value: '본문' } });
    fireEvent.change(screen.getByLabelText(/행사 시작/), { target: { value: '2099-12-05T19:00' } });
    fireEvent.change(screen.getByLabelText(/신청 마감/), { target: { value: '2099-12-03T19:00' } });
  }
  const postKeys = () =>
    httpMock.mock.calls
      .filter(([p, , i]) => p === '/api/admin/events' && i?.method === 'POST')
      .map(([, , i]) => (i!.headers as Record<string, string>)['Idempotency-Key']);

  it('응답을 못 받은 같은 내용의 재시도만 같은 키를 쓰고, 내용을 고치거나 닫았다 열면 새 키를 쓴다', async () => {
    const user = userEvent.setup();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = (open: boolean) => (
      <QueryClientProvider client={client}>
        <EventCreateDialog open={open} onClose={() => view(false)} />
      </QueryClientProvider>
    );
    const { rerender } = render(view(true));
    httpMock.mockRejectedValue(new Error('network'));
    fill();
    await user.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(postKeys()).toHaveLength(1));
    await user.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(postKeys()).toHaveLength(2));
    const [first, second] = postKeys();
    expect(second).toBe(first);

    fireEvent.change(screen.getByLabelText(/행사명/), { target: { value: '고친 행사' } });
    await user.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(postKeys()).toHaveLength(3));
    expect(postKeys()[2]).not.toBe(first);

    // 닫았다 다시 열어 같은 내용을 넣어도 이전 시도의 키를 쓰지 않는다
    await user.click(screen.getByRole('button', { name: '취소' }));
    rerender(view(false));
    rerender(view(true));
    fill();
    fireEvent.change(screen.getByLabelText(/행사명/), { target: { value: '고친 행사' } });
    await user.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(postKeys()).toHaveLength(4));
    expect(postKeys()[3]).not.toBe(postKeys()[2]);
  });
});
