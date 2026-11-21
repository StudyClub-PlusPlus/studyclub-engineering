import { toast } from '@studyclub/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

// 토스트는 DOM 이 아니라 호출로 확인한다 (Toaster 를 마운트하지 않는다).
vi.mock('@studyclub/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@studyclub/ui')>();
  return { ...actual, toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) };
});

import { ParticipantsTab } from '@/features/participants/ParticipantsTab';
import { participantKeys } from '@/features/participants/queries';
import type { ParticipantsResponse } from '@/features/participants/types';

const memoryUrl = vi.hoisted(() => {
  let search = '';
  const listeners = new Set<() => void>();
  return {
    get: () => search,
    set: (value: string) => {
      search = value;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    push: vi.fn(),
  };
});
vi.mock('next/navigation', async () => {
  const { useMemo, useSyncExternalStore } = await import('react');
  const router = { push: memoryUrl.push, replace: (url: string) => memoryUrl.set(url.split('?')[1] ?? '') };
  return {
    useRouter: () => router,
    usePathname: () => '/studies/20',
    useSearchParams: () => {
      const search = useSyncExternalStore(memoryUrl.subscribe, memoryUrl.get);
      return useMemo(() => new URLSearchParams(search), [search]);
    },
  };
});

const data: ParticipantsResponse = {
  studyId: 20,
  participantCount: 2,
  recruitmentCapacity: 10,
  ownerCaptain: null,
  groups: [
    { groupId: 1, name: '기본반', isDefault: true, canDelete: false },
    { groupId: 2, name: '목요일반', isDefault: false, canDelete: false },
    { groupId: 3, name: '빈반', isDefault: false, canDelete: true },
  ],
  participants: [
    {
      participantId: 41,
      accountId: 1,
      nickname: '한국크루',
      discordNickname: null,
      email: 'crew@example.com',
      timeZone: 'Asia/Seoul',
      availableDays: ['mon', 'thu'],
      groupId: 1,
      participantRole: 'MEMBER',
      status: 'ACTIVE',
      captain: false,
      joinedAt: '2026-10-01T00:00:00Z',
    },
    {
      participantId: 42,
      accountId: 2,
      nickname: '북미캡틴',
      discordNickname: 'captain',
      email: 'captain@example.com',
      timeZone: 'America/Vancouver',
      availableDays: ['mon'],
      groupId: 1,
      participantRole: 'LEADER',
      status: 'PAUSED',
      captain: true,
      joinedAt: '2026-10-01T00:00:00Z',
    },
  ],
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
function mount(
  response = data,
  write: (url: string, init: RequestInit) => Promise<Response> = async () => reply({ participants: [] }),
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }),
) {
  const fetch = vi.fn((url: string, init: RequestInit) =>
    init.method ? write(url, init) : Promise.resolve(reply(response)),
  );
  vi.stubGlobal('fetch', fetch);
  render(
    <QueryClientProvider client={client}>
      <ParticipantsTab studyId={20} />
    </QueryClientProvider>,
  );
  return fetch;
}
const toastSuccessMock = vi.mocked(toast.success);
afterEach(() => {
  act(() => memoryUrl.set(''));
  memoryUrl.push.mockClear();
  toastSuccessMock.mockClear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('참여자 반 편성', () => {
  it('백그라운드 재조회 중에도 반 편집을 유지하고 다른 스터디 캐시는 무효화하지 않는다', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const otherKey = participantKeys.list(99);
    client.setQueryData(otherKey, data);
    const fetch = mount(data, async () => reply({ participants: [] }), client);
    await screen.findByRole('combobox', { name: '한국크루 반' });
    let finish!: (response: Response) => void;
    fetch.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    );
    let refreshed!: Promise<void>;
    act(() => {
      refreshed = client.invalidateQueries({ queryKey: participantKeys.list(20) });
    });
    await userEvent.selectOptions(screen.getByRole('combobox', { name: '한국크루 반' }), '2');
    expect(screen.getByRole('button', { name: /저장/ })).toBeEnabled();
    await act(async () => {
      finish(reply(data));
      await refreshed;
    });
    await userEvent.click(screen.getByRole('button', { name: /저장/ }));
    await waitFor(() => expect(toastSuccessMock).toHaveBeenCalledWith('저장했습니다.'));
    expect(client.getQueryState(otherKey)?.isInvalidated).toBe(false);
  });
  it('서버 목록 순서와 무관하게 서버가 기본으로 표시한 반에 기본 배지를 표시한다', async () => {
    mount({ ...data, groups: [...data.groups].reverse() });
    const badge = await screen.findByText('기본');
    expect(badge.parentElement).toHaveTextContent('기본반');
  });

  it('반 삭제를 취소하면 요청하지 않는다', async () => {
    const fetch = mount();
    await userEvent.click(await screen.findByRole('button', { name: '빈반 삭제' }));
    await userEvent.click(screen.getByRole('button', { name: '취소' }));
    expect(fetch.mock.calls.filter(([, init]) => init.method)).toHaveLength(0);
  });

  it('오류 메시지의 HTTP 상태와 반 번호를 실패한 참여자로 오인하지 않는다', async () => {
    const response = structuredClone(data);
    response.participants[0]!.participantId = 500;
    response.participants[1]!.participantId = 7;
    mount(response, async () => reply({ errorMessage: '요청에 실패했습니다 (500), groupId 7' }, 500));
    await userEvent.selectOptions(await screen.findByRole('combobox', { name: '한국크루 반' }), '2');
    await userEvent.click(screen.getByRole('button', { name: /저장/ }));
    await screen.findByRole('alert');
    expect(screen.queryByText('저장 실패')).not.toBeInTheDocument();
  });

  it('저장 충돌 후 재조회된 비활성 크루의 변경을 제거한다', async () => {
    const response = structuredClone(data);
    mount(response, async () => {
      response.participants[0]!.status = 'WITHDRAWN';
      return reply({ errorMessage: 'participantId 41: 참여 상태가 변경되었습니다.' }, 409);
    });
    await userEvent.selectOptions(await screen.findByRole('combobox', { name: '한국크루 반' }), '2');
    await userEvent.click(screen.getByRole('button', { name: /저장/ }));
    await waitFor(() => expect(screen.getByRole('combobox', { name: '한국크루 반' })).toBeDisabled());
    expect(screen.getByRole('button', { name: /저장/ })).toBeDisabled();
    expect(screen.queryByRole('button', { name: '변경 취소' })).not.toBeInTheDocument();
  });

  it('필터 안 전체 선택과 해제가 다른 필터의 선택을 유지한다', async () => {
    mount();
    await userEvent.click(await screen.findByRole('checkbox', { name: '북미캡틴 선택' }));
    await userEvent.selectOptions(screen.getByRole('combobox', { name: '시간대 필터' }), 'Asia/Seoul');
    expect(screen.queryByRole('button', { name: '선택 해제' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('checkbox', { name: '보이는 크루 전체 선택' }));
    await userEvent.click(screen.getByRole('checkbox', { name: '보이는 크루 전체 선택' }));
    await userEvent.selectOptions(screen.getByRole('combobox', { name: '시간대 필터' }), 'all');
    expect(screen.getByRole('checkbox', { name: '북미캡틴 선택' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: '한국크루 선택' })).not.toBeChecked();
  });
  it('반 삭제 요청 중에는 삭제 대상 반으로 크루를 배정할 수 없다', async () => {
    let finish!: (response: Response) => void;
    mount(data, () => new Promise<Response>((resolve) => (finish = resolve)));
    await userEvent.click(await screen.findByRole('button', { name: '빈반 삭제' }));
    await userEvent.click(screen.getByRole('button', { name: '삭제하기' }));
    try {
      expect(screen.getByRole('combobox', { name: '한국크루 반' })).toBeDisabled();
      expect(screen.getByRole('checkbox', { name: '보이는 크루 전체 선택' })).toBeDisabled();
    } finally {
      await act(async () => finish(new Response(null, { status: 204 })));
    }
  });
  it.each(['배정', '반 생성', '반 삭제'])('%s 요청에서 권한이 회수되면 명단을 숨긴다', async (action) => {
    mount(data, async () => reply({ errorMessage: '권한이 없습니다.' }, 403));
    await screen.findByText('crew@example.com');
    if (action === '배정') {
      await userEvent.selectOptions(screen.getByRole('combobox', { name: '한국크루 반' }), '2');
      await userEvent.click(screen.getByRole('button', { name: /저장/ }));
    } else if (action === '반 생성') {
      await userEvent.click(screen.getByRole('button', { name: '반 추가' }));
      await userEvent.type(screen.getByRole('textbox', { name: '반 제목' }), '새반{Enter}');
    } else {
      await userEvent.click(screen.getByRole('button', { name: '빈반 삭제' }));
      await userEvent.click(screen.getByRole('button', { name: '삭제하기' }));
    }
    expect(await screen.findByRole('alert')).toHaveTextContent('권한이 없습니다');
    expect(screen.queryByText('crew@example.com')).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
  it('서버 삭제 판정을 사용하고 기본반·신청한 캡틴·역할을 표시한다', async () => {
    mount();
    expect(await screen.findByText('참여 크루 2명')).toBeVisible();
    expect(screen.getByText('캡틴')).toBeVisible();
    expect(screen.getByRole('combobox', { name: '북미캡틴 역할' })).toHaveValue('LEADER');
    expect(screen.getByRole('combobox', { name: '한국크루 역할' })).toHaveValue('MEMBER');
    expect(screen.getByRole('button', { name: '기본반 삭제' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '목요일반 삭제' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '빈반 삭제' })).toBeEnabled();
    expect(screen.queryByText('승인')).not.toBeInTheDocument();
  });

  it('변경을 모아 변경한 행만 한 요청으로 저장한다', async () => {
    const fetch = mount(data, async (_, init) => {
      const { changes } = JSON.parse(init.body as string);
      return reply({ participants: changes.map((c: object) => ({ ...c, participantRole: 'MEMBER' })) });
    });
    await userEvent.selectOptions(await screen.findByRole('combobox', { name: '한국크루 반' }), '2');
    expect(fetch.mock.calls.filter(([, init]) => init.method)).toHaveLength(0);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: '북미캡틴 반' }), '3');
    await userEvent.click(screen.getByRole('button', { name: /저장/ }));
    await waitFor(() => expect(toastSuccessMock).toHaveBeenCalledWith('저장했습니다.'));
    expect(fetch.mock.calls.filter(([, init]) => init.method)).toEqual([
      [
        expect.stringContaining('/studies/20/participants'),
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({
            changes: [
              { participantId: 41, groupId: 2 },
              { participantId: 42, groupId: 3 },
            ],
          }),
        }),
      ],
    ]);
  });

  it('행 역할 드롭다운 변경을 모았다가 저장 응답으로 화면을 맞춘다', async () => {
    const fetch = mount();
    await userEvent.selectOptions(await screen.findByRole('combobox', { name: '한국크루 역할' }), 'LEADER');
    // 저장 뒤 재조회가 실패해도 PATCH 응답만으로 화면이 맞아야 한다
    fetch.mockImplementation(async (_, init) =>
      init.method
        ? reply({ participants: [{ participantId: 41, groupId: 1, participantRole: 'LEADER' }] })
        : reply({ errorMessage: '서버 오류가 발생했습니다.' }, 500),
    );
    expect(fetch.mock.calls.filter(([, init]) => init.method)).toHaveLength(0);
    await userEvent.click(screen.getByRole('button', { name: /저장/ }));
    await waitFor(() => expect(toastSuccessMock).toHaveBeenCalledWith('저장했습니다.'));
    expect(fetch.mock.calls.filter(([, init]) => init.method)[0]?.[1]).toMatchObject({
      method: 'PATCH',
      body: JSON.stringify({ changes: [{ participantId: 41, participantRole: 'LEADER' }] }),
    });
    expect(screen.getByRole('combobox', { name: '한국크루 역할' })).toHaveValue('LEADER');
    expect(screen.getByRole('button', { name: /저장/ })).toBeDisabled();
  });

  it('고른 크루의 반과 역할을 이어서 일괄 변경하고 이미 같은 값인 칸은 보내지 않는다', async () => {
    const fetch = mount();
    await userEvent.click(await screen.findByRole('checkbox', { name: '보이는 크루 전체 선택' }));
    await userEvent.selectOptions(screen.getByRole('combobox', { name: '바꿀 역할' }), 'LEADER');
    expect(screen.getByRole('combobox', { name: '바꿀 역할' })).toHaveValue('');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: '바꿀 반' }), '2');
    expect(screen.getByRole('combobox', { name: '한국크루 역할' })).toHaveValue('LEADER');
    await userEvent.click(screen.getByRole('button', { name: /저장/ }));
    await waitFor(() =>
      expect(JSON.parse(fetch.mock.calls.filter(([, init]) => init.method)[0]?.[1].body as string)).toEqual({
        changes: [
          { participantId: 41, participantRole: 'LEADER', groupId: 2 },
          { participantId: 42, groupId: 2 },
        ],
      }),
    );
  });

  it('역할 변경을 취소하거나 원래 역할로 되돌리면 저장할 것이 없다', async () => {
    mount();
    const role = await screen.findByRole('combobox', { name: '북미캡틴 역할' });
    await userEvent.selectOptions(role, 'MEMBER');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: '북미캡틴 반' }), '2');
    await userEvent.click(screen.getByRole('button', { name: '변경 취소' }));
    expect(role).toHaveValue('LEADER');
    expect(screen.getByRole('combobox', { name: '북미캡틴 반' })).toHaveValue('1');
    expect(screen.getByRole('button', { name: /저장/ })).toBeDisabled();
    await userEvent.selectOptions(role, 'MEMBER');
    expect(screen.getByRole('button', { name: /저장/ })).toBeEnabled();
    await userEvent.selectOptions(role, 'LEADER');
    expect(screen.getByRole('button', { name: /저장/ })).toBeDisabled();
  });

  it('필터에 숨은 선택 행은 일괄 변경하지 않는다', async () => {
    const fetch = mount();
    await userEvent.click(await screen.findByRole('checkbox', { name: '보이는 크루 전체 선택' }));
    await userEvent.selectOptions(screen.getByRole('combobox', { name: '시간대 필터' }), 'Asia/Seoul');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: '바꿀 반' }), '2');
    await userEvent.click(screen.getByRole('button', { name: /저장/ }));
    await waitFor(() =>
      expect(fetch.mock.calls.filter(([, init]) => init.method)[0]?.[1].body).toBe(
        JSON.stringify({ changes: [{ participantId: 41, groupId: 2 }] }),
      ),
    );
  });

  it('저장 실패 시 입력을 유지하고 원래 반으로 되돌리면 저장을 잠근다', async () => {
    mount(data, async () => reply({ errorMessage: 'participantId 41: 참여 상태가 변경되었습니다.' }, 409));
    await userEvent.selectOptions(await screen.findByRole('combobox', { name: '한국크루 반' }), '2');
    await userEvent.click(screen.getByRole('button', { name: /저장/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('41');
    expect(screen.getByText('저장 실패')).toBeVisible();
    expect(screen.getByRole('combobox', { name: '한국크루 반' })).toHaveValue('2');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: '한국크루 반' }), '1');
    expect(screen.getByRole('button', { name: /저장/ })).toBeDisabled();
  });

  it('제목 검증·중복 오류는 카드 안에 남기고 Esc로 닫는다', async () => {
    const fetch = mount(data, async () => reply({ errorMessage: '같은 이름의 반이 있습니다.' }, 409));
    await userEvent.click(await screen.findByRole('button', { name: '반 추가' }));
    const section = within(screen.getByRole('region', { name: '반 편성' }));
    await userEvent.click(section.getByRole('button', { name: '저장' }));
    expect(await screen.findByText('반 제목을 입력해 주세요.')).toBeVisible();
    await userEvent.type(screen.getByRole('textbox', { name: '반 제목' }), '새반{Enter}');
    expect(await screen.findByText('같은 이름의 반이 있습니다.')).toBeVisible();
    expect(fetch.mock.calls.filter(([, init]) => init.method)[0]?.[1]).toMatchObject({
      method: 'POST',
      body: '{"name":"새반"}',
    });
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('생성·제목 수정·삭제 후 서버 목록을 다시 표시한다', async () => {
    const response = structuredClone(data);
    const fetch = mount(response, async (url, init) => {
      if (init.method === 'POST') {
        response.groups.push({
          groupId: 4,
          name: JSON.parse(init.body as string).name,
          isDefault: false,
          canDelete: true,
        });
        return reply({ groupId: 4, name: '새반' }, 201);
      }
      if (init.method === 'PATCH') {
        response.groups[3]!.name = JSON.parse(init.body as string).name;
        return reply({ groupId: 4, name: response.groups[3]!.name });
      }
      response.groups = response.groups.filter((group) => !url.endsWith(`/${group.groupId}`));
      return new Response(null, { status: 204 });
    });
    await userEvent.click(await screen.findByRole('button', { name: '반 추가' }));
    await userEvent.type(screen.getByRole('textbox', { name: '반 제목' }), '  새반  {Enter}');
    await userEvent.click(await screen.findByRole('button', { name: '새반 수정' }));
    await userEvent.clear(screen.getByRole('textbox', { name: '반 제목' }));
    await userEvent.type(screen.getByRole('textbox', { name: '반 제목' }), '금요일반{Enter}');
    await userEvent.click(await screen.findByRole('button', { name: '금요일반 삭제' }));
    await userEvent.click(screen.getByRole('button', { name: '삭제하기' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: '금요일반 삭제' })).not.toBeInTheDocument());
    expect(fetch.mock.calls.filter(([, init]) => init.method).map(([, init]) => init.method)).toEqual([
      'POST',
      'PATCH',
      'DELETE',
    ]);
    expect(fetch.mock.calls.find(([, init]) => init.method === 'POST')?.[1].body).toBe('{"name":"새반"}');
  });

  it('반 삭제가 409이면 서버 오류를 보여주고 명단을 갱신한다', async () => {
    const fetch = mount(data, async () => reply({ errorMessage: '출석 기록이 있는 반은 삭제할 수 없습니다.' }, 409));
    await userEvent.click(await screen.findByRole('button', { name: '빈반 삭제' }));
    await userEvent.click(screen.getByRole('button', { name: '삭제하기' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('출석 기록');
    expect(fetch.mock.calls.filter(([, init]) => !init.method).length).toBeGreaterThan(1);
  });

  it('반 하나면 반 선택을 숨긴다', async () => {
    mount({ ...data, groups: [data.groups[0]!] });
    await screen.findByText('참여 크루 2명');
    expect(screen.queryByRole('combobox', { name: '한국크루 반' })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: '바꿀 반' })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: '반 필터' })).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: '시간대 필터' })).toBeVisible();
  });

  it('일부 선택 상태는 보이는 크루를 기준으로 표시하고 전체 선택·해제로 전환한다', async () => {
    mount();
    const all = await screen.findByRole('checkbox', { name: '보이는 크루 전체 선택' });
    await userEvent.click(screen.getByRole('checkbox', { name: '한국크루 선택' }));
    expect(all).toBePartiallyChecked();
    await userEvent.selectOptions(screen.getByRole('combobox', { name: '시간대 필터' }), 'Asia/Seoul');
    expect(all).toBeChecked();
    expect(all).not.toBePartiallyChecked();
    await userEvent.selectOptions(screen.getByRole('combobox', { name: '시간대 필터' }), 'all');
    expect(all).toBePartiallyChecked();
    await userEvent.click(all);
    expect(all).toBeChecked();
    expect(all).not.toBePartiallyChecked();
    await userEvent.click(all);
    expect(all).not.toBeChecked();
    expect(all).not.toBePartiallyChecked();
  });

  it('URL 필터를 복원하고 변경할 때 기존 쿼리를 보존한다', async () => {
    memoryUrl.set('tab=crew&tz=Asia%2FSeoul&group=1');
    mount();
    await screen.findByRole('combobox', { name: '한국크루 반' });
    expect(screen.queryByRole('combobox', { name: '북미캡틴 반' })).not.toBeInTheDocument();
    await userEvent.selectOptions(screen.getByRole('combobox', { name: '시간대 필터' }), 'all');
    expect(memoryUrl.get()).toBe('tab=crew&group=1');
    expect(screen.getByRole('combobox', { name: '북미캡틴 반' })).toBeVisible();
    act(() => memoryUrl.set('tab=crew&tz=INVALID&group=999'));
    expect(screen.getByRole('combobox', { name: '시간대 필터' })).toHaveValue('all');
    expect(screen.getByRole('combobox', { name: '반 필터' })).toHaveValue('all');
  });

  it('참여 크루의 시간대를 약칭으로 보여 주고 시간대로 거른다', async () => {
    memoryUrl.set('');
    mount({
      ...data,
      participants: [
        ...data.participants,
        {
          ...data.participants[0],
          participantId: 43,
          accountId: 3,
          nickname: '시간대없음',
          discordNickname: 'tz-none',
          timeZone: null,
        },
      ],
    });
    const table = within(await screen.findByRole('table'));
    expect(table.getByRole('columnheader', { name: '시간대' })).toBeVisible();
    expect(table.queryByRole('columnheader', { name: '지역' })).not.toBeInTheDocument();
    const cellOf = (nickname: string) => table.getByText(nickname).closest('tr')!;
    expect(within(cellOf('한국크루')).getByText('KST')).toBeVisible();
    expect(within(cellOf('북미캡틴')).getByText('PCT')).toBeVisible();
    expect(within(cellOf('시간대없음')).getByText('-')).toBeVisible();

    await userEvent.selectOptions(screen.getByRole('combobox', { name: '시간대 필터' }), 'America/Vancouver');
    expect(memoryUrl.get()).toBe('tz=America%2FVancouver');
    expect(table.queryByText('한국크루')).not.toBeInTheDocument();
    expect(table.getByText('북미캡틴')).toBeVisible();
  });

  it('링크 이동을 공통 모달로 확인하고 계속 편집하면 변경을 유지한다', async () => {
    mount();
    await userEvent.selectOptions(await screen.findByRole('combobox', { name: '한국크루 반' }), '2');
    const link = document.createElement('a');
    link.href = '/studies';
    link.textContent = '목록으로';
    document.body.append(link);
    await userEvent.click(link);
    expect(screen.getByRole('dialog', { name: '변경을 취소하고 이동' })).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: '계속 편집' }));
    expect(memoryUrl.push).not.toHaveBeenCalled();
    expect(screen.getByRole('combobox', { name: '한국크루 반' })).toHaveValue('2');
    await userEvent.click(link);
    await userEvent.click(screen.getByRole('button', { name: '변경 취소 후 이동' }));
    expect(memoryUrl.push).toHaveBeenCalledWith('/studies');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    link.remove();
  });

  it('미저장 변경이 있으면 페이지 종료 경고를 등록하고 취소하면 해제한다', async () => {
    mount();
    await userEvent.selectOptions(await screen.findByRole('combobox', { name: '한국크루 반' }), '2');
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    await userEvent.click(screen.getByRole('button', { name: '변경 취소' }));
    const clean = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);
  });

  it('배정 변경 없이 반 제목을 저장하는 중에는 이동을 막지 않는다', async () => {
    let finish!: (response: Response) => void;
    mount(data, () => new Promise<Response>((resolve) => (finish = resolve)));
    await userEvent.click(await screen.findByRole('button', { name: '반 추가' }));
    await userEvent.type(screen.getByRole('textbox', { name: '반 제목' }), '새반{Enter}');
    try {
      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
    } finally {
      await act(async () => finish(reply({ groupId: 4, name: '새반' }, 201)));
    }
  });

  it('배정 저장 중 링크를 누르면 모달을 띄우고 저장이 끝나야 이동할 수 있다', async () => {
    let finish!: (response: Response) => void;
    mount(data, () => new Promise<Response>((resolve) => (finish = resolve)));
    await userEvent.selectOptions(await screen.findByRole('combobox', { name: '한국크루 반' }), '2');
    await userEvent.click(screen.getByRole('button', { name: /저장/ }));
    const link = document.createElement('a');
    link.href = '/studies';
    document.body.append(link);
    try {
      await userEvent.click(link);
      expect(screen.getByRole('dialog', { name: '변경을 취소하고 이동' })).toBeVisible();
      expect(screen.getByRole('button', { name: '변경 취소 후 이동' })).toBeDisabled();
    } finally {
      await act(async () => finish(reply({ participants: [{ participantId: 41, groupId: 2 }] })));
      link.remove();
    }
    await waitFor(() => expect(screen.getByRole('button', { name: '변경 취소 후 이동' })).toBeEnabled());
  });
});

describe('참여 가능 시간', () => {
  const withDays: ParticipantsResponse = {
    ...data,
    participants: [
      ...data.participants,
      {
        ...data.participants[0]!,
        participantId: 43,
        accountId: 3,
        nickname: '신청서없음',
        availableDays: [],
      },
    ],
  };

  it('명단에 크루가 고른 현지 요일을 월 → 일 순서로 보이고, 없으면 「-」', async () => {
    mount({
      ...withDays,
      participants: withDays.participants.map((p) =>
        p.participantId === 41 ? { ...p, availableDays: ['thu', 'mon', 'sun'] } : p,
      ),
    });
    const table = within(await screen.findByRole('table'));
    expect(table.getByRole('columnheader', { name: '참여 가능 요일' })).toBeVisible();
    const col = table.getAllByRole('columnheader').findIndex((h) => h.textContent === '참여 가능 요일');
    const daysOf = (nickname: string) => table.getByText(nickname).closest('tr')!.querySelectorAll('td')[col];
    expect(daysOf('한국크루')).toHaveTextContent(/^월 · 목 · 일$/);
    expect(daysOf('북미캡틴')).toHaveTextContent(/^월$/);
    expect(daysOf('신청서없음')).toHaveTextContent(/^-$/);
  });

  it('응답에 availableDays 가 없으면 빈 요일로 읽는다', async () => {
    mount({
      ...data,
      participants: data.participants.map((p) =>
        Object.fromEntries(Object.entries(p).filter(([k]) => k !== 'availableDays')),
      ),
    } as unknown as ParticipantsResponse);
    const table = within(await screen.findByRole('table'));
    const col = table.getAllByRole('columnheader').findIndex((h) => h.textContent === '참여 가능 요일');
    expect(table.getByText('한국크루').closest('tr')!.querySelectorAll('td')[col]).toHaveTextContent(/^-$/);
  });

  it('크루 현지 요일을 기준 시간대로 옮겨 세고, 칸을 누르면 그 시각에 되는 크루만 명단에 남는다', async () => {
    mount(withDays);
    // KST 월 12시 = 밴쿠버 일요일 저녁 → 한국크루만. KST 화 12시 = 밴쿠버 월요일 저녁 → 북미캡틴만
    const mon = await screen.findByRole('button', { name: '월 12시 KST · 1명' });
    expect(screen.getByRole('button', { name: '화 12시 KST · 1명' })).toBeVisible();
    // 요일이 없는 사람은 세지 않는다
    expect(within(screen.getByRole('region', { name: '참여 가능 시간' })).getByText('2명')).toBeVisible();

    await userEvent.click(mon);
    expect(mon).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('월 12시 KST에 되는 크루 1명')).toBeVisible();
    const table = within(screen.getByRole('table'));
    expect(table.getByText('한국크루')).toBeVisible();
    expect(table.queryByText('북미캡틴')).not.toBeInTheDocument();
    expect(table.queryByText('신청서없음')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '시각 필터 풀기' }));
    expect(table.getByText('북미캡틴')).toBeVisible();
    expect(mon).toHaveAttribute('aria-pressed', 'false');
  });

  it('기준 시간대를 바꾸면 칸이 그 시간대로 다시 그려지고 고른 칸은 풀린다', async () => {
    mount(withDays);
    await userEvent.click(await screen.findByRole('button', { name: '월 12시 KST · 1명' }));
    await userEvent.click(screen.getByRole('tab', { name: 'PCT' }));
    expect(screen.queryByText(/에 되는 크루 \d+명/)).not.toBeInTheDocument();
    expect(screen.getByRole('grid', { name: '참여 가능 인원 · 요일 × 시각 (PCT)' })).toBeVisible();
    expect(within(screen.getByRole('table')).getByText('북미캡틴')).toBeVisible();
  });

  it('현지 밤 빼기를 끄면 크루 현지 새벽 칸도 센다', async () => {
    mount(withDays);
    // KST 월 3시 — 한국크루 현지 새벽
    expect(await screen.findByRole('button', { name: '월 3시 KST · 0명' })).toBeVisible();
    await userEvent.click(screen.getByRole('switch', { name: '현지 밤(0~7시) 빼기' }));
    expect(screen.getByRole('button', { name: '월 3시 KST · 1명' })).toBeVisible();
  });

  it('반 · 시간대 필터를 바꾸면 고른 시각을 푼다', async () => {
    mount(withDays);
    await userEvent.click(await screen.findByRole('button', { name: '월 12시 KST · 1명' }));
    await userEvent.selectOptions(screen.getByRole('combobox', { name: '시간대 필터' }), 'Asia/Seoul');
    expect(screen.queryByText(/에 되는 크루 \d+명/)).not.toBeInTheDocument();
  });

  it('시간대가 없는 크루는 세지 않고 그 수를 알린다', async () => {
    mount({
      ...withDays,
      participants: withDays.participants.map((p) => (p.participantId === 42 ? { ...p, timeZone: null } : p)),
    });
    expect(
      await screen.findByText('시간대가 없는 1명은 빼고 셌습니다 — 프로필에서 시간대를 정하지 않은 크루입니다.'),
    ).toBeVisible();
  });
});

describe('담당 캡틴', () => {
  const captain = (id: number, name: string) => ({
    id,
    name,
    maskedEmail: 'c***@example.com',
    systemRole: 'ADMIN',
    navigatorOf: [],
    dormant: false,
    joinedAt: '2026-01-01T00:00:00Z',
    roleChangeBlockedReason: null,
    discordLinked: true,
  });
  const captains = { items: [captain(5, '소라'), captain(6, '민준')], total: 2, offset: 0, limit: 100 };

  const nicknames: Record<number, string> = { 5: '소라', 6: '민준' };
  /** 서버처럼 PATCH 가 성공하면 다음 GET 의 ownerCaptain 이 바뀐다. */
  function mountWithCaptains(write: (url: string, init: RequestInit) => Promise<Response>) {
    let owner = 5;
    const fetch = vi.fn(async (url: string, init: RequestInit) => {
      if (init.method) {
        const response = await write(url, init);
        if (response.ok) owner = (JSON.parse(String(init.body)) as { accountId: number }).accountId;
        return response;
      }
      if (url.includes('/api/admin/users')) return reply(captains);
      return reply({ ...data, ownerCaptain: { accountId: owner, nickname: nicknames[owner] } });
    });
    vi.stubGlobal('fetch', fetch);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <ParticipantsTab studyId={20} />
      </QueryClientProvider>,
    );
    return fetch;
  }
  async function ownerSelect() {
    const select = await screen.findByRole('combobox', { name: '담당 캡틴' });
    await waitFor(() => expect(select).toBeEnabled());
    return select;
  }

  it('캡틴 계정 중에서 고르면 바로 PATCH …/owner-captain 을 보내고, 저장 중에는 잠갔다가 새 값으로 바뀐다', async () => {
    let finish!: () => void;
    const fetch = mountWithCaptains(
      () =>
        new Promise<Response>((resolve) => {
          finish = () => resolve(reply({ studyId: 20, ownerCaptain: { accountId: 6, nickname: '민준' } }));
        }),
    );
    const select = await ownerSelect();
    expect(select).toHaveValue('5');

    await userEvent.selectOptions(select, '6');
    await waitFor(() => expect(select).toBeDisabled());
    expect(screen.getByRole('status')).toHaveTextContent('저장 중');
    const patch = fetch.mock.calls.find(([url, init]) => init.method === 'PATCH' && url.includes('/owner-captain'));
    expect(patch?.[1].body).toBe(JSON.stringify({ accountId: 6 }));

    await act(async () => finish());
    await waitFor(() => expect(toastSuccessMock).toHaveBeenCalledWith('담당 캡틴을 바꿨습니다.'));
    await waitFor(() => expect(select).toHaveValue('6'));
    expect(select).toBeEnabled();
  });

  it('캡틴이 아니게 된 사람을 고르면(409) 오류를 알리고 지금 값을 그대로 둔다', async () => {
    mountWithCaptains(async () =>
      reply({ errorCode: 'OWNER_CAPTAIN_NOT_ADMIN', errorMessage: '캡틴만 담당 캡틴이 될 수 있습니다.' }, 409),
    );
    const select = await ownerSelect();
    await userEvent.selectOptions(select, '6');
    await waitFor(() => expect(vi.mocked(toast.error)).toHaveBeenCalledWith('캡틴만 담당 캡틴이 될 수 있습니다.'));
    await waitFor(() => expect(select).toBeEnabled());
    expect(select).toHaveValue('5');
    expect(toastSuccessMock).not.toHaveBeenCalled();
  });

  it('같은 사람을 고르면 요청하지 않는다', async () => {
    const fetch = mountWithCaptains(async () => reply({}));
    const select = await ownerSelect();
    await userEvent.selectOptions(select, '5');
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(fetch.mock.calls.filter(([, init]) => init.method)).toHaveLength(0);
    expect(select).toBeEnabled();
  });
});
