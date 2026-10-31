import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ParticipantsTab } from './ParticipantsTab';
import { participantKeys } from './queries';
import type { ParticipantsResponse } from './types';

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
      regionGroup: 'KR',
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
      regionGroup: 'NA',
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
afterEach(() => {
  act(() => memoryUrl.set(''));
  memoryUrl.push.mockClear();
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
    expect(screen.getByRole('button', { name: '저장' })).toBeEnabled();
    await act(async () => {
      finish(reply(data));
      await refreshed;
    });
    await userEvent.click(screen.getByRole('button', { name: '저장' }));
    await screen.findByText('저장했습니다.');
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
    await userEvent.click(screen.getByRole('button', { name: '저장' }));
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
    await userEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(screen.getByRole('combobox', { name: '한국크루 반' })).toBeDisabled());
    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: '변경 취소' })).not.toBeInTheDocument();
  });

  it('필터 안 전체 선택과 해제가 다른 필터의 선택을 유지한다', async () => {
    mount();
    await userEvent.click(await screen.findByRole('checkbox', { name: '북미캡틴 선택' }));
    await userEvent.selectOptions(screen.getByRole('combobox', { name: '지역 필터' }), 'KR');
    expect(screen.queryByRole('button', { name: '선택 해제' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('checkbox', { name: '보이는 크루 전체 선택' }));
    await userEvent.click(screen.getByRole('checkbox', { name: '보이는 크루 전체 선택' }));
    await userEvent.selectOptions(screen.getByRole('combobox', { name: '지역 필터' }), 'all');
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
      await userEvent.click(screen.getByRole('button', { name: '저장' }));
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
    await userEvent.click(screen.getByRole('button', { name: '저장' }));
    await screen.findByText('저장했습니다.');
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
    await userEvent.click(screen.getByRole('button', { name: '저장' }));
    await screen.findByText('저장했습니다.');
    expect(fetch.mock.calls.filter(([, init]) => init.method)[0]?.[1]).toMatchObject({
      method: 'PATCH',
      body: JSON.stringify({ changes: [{ participantId: 41, participantRole: 'LEADER' }] }),
    });
    expect(screen.getByRole('combobox', { name: '한국크루 역할' })).toHaveValue('LEADER');
    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
  });

  it('고른 크루의 반과 역할을 이어서 일괄 변경하고 이미 같은 값인 칸은 보내지 않는다', async () => {
    const fetch = mount();
    await userEvent.click(await screen.findByRole('checkbox', { name: '보이는 크루 전체 선택' }));
    await userEvent.selectOptions(screen.getByRole('combobox', { name: '바꿀 역할' }), 'LEADER');
    expect(screen.getByRole('combobox', { name: '바꿀 역할' })).toHaveValue('');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: '바꿀 반' }), '2');
    expect(screen.getByRole('combobox', { name: '한국크루 역할' })).toHaveValue('LEADER');
    await userEvent.click(screen.getByRole('button', { name: '저장' }));
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
    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
    await userEvent.selectOptions(role, 'MEMBER');
    expect(screen.getByRole('button', { name: '저장' })).toBeEnabled();
    await userEvent.selectOptions(role, 'LEADER');
    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
  });

  it('필터에 숨은 선택 행은 일괄 변경하지 않는다', async () => {
    const fetch = mount();
    await userEvent.click(await screen.findByRole('checkbox', { name: '보이는 크루 전체 선택' }));
    await userEvent.selectOptions(screen.getByRole('combobox', { name: '지역 필터' }), 'KR');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: '바꿀 반' }), '2');
    await userEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() =>
      expect(fetch.mock.calls.filter(([, init]) => init.method)[0]?.[1].body).toBe(
        JSON.stringify({ changes: [{ participantId: 41, groupId: 2 }] }),
      ),
    );
  });

  it('저장 실패 시 입력을 유지하고 원래 반으로 되돌리면 저장을 잠근다', async () => {
    mount(data, async () => reply({ errorMessage: 'participantId 41: 참여 상태가 변경되었습니다.' }, 409));
    await userEvent.selectOptions(await screen.findByRole('combobox', { name: '한국크루 반' }), '2');
    await userEvent.click(screen.getByRole('button', { name: '저장' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('41');
    expect(screen.getByText('저장 실패')).toBeVisible();
    expect(screen.getByRole('combobox', { name: '한국크루 반' })).toHaveValue('2');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: '한국크루 반' }), '1');
    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
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
        response.groups.push({ groupId: 4, name: JSON.parse(init.body as string).name, isDefault: false, canDelete: true });
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
    expect(screen.getByRole('combobox', { name: '지역 필터' })).toBeVisible();
  });

  it('일부 선택 상태는 보이는 크루를 기준으로 표시하고 전체 선택·해제로 전환한다', async () => {
    mount();
    const all = await screen.findByRole('checkbox', { name: '보이는 크루 전체 선택' });
    await userEvent.click(screen.getByRole('checkbox', { name: '한국크루 선택' }));
    expect(all).toBePartiallyChecked();
    await userEvent.selectOptions(screen.getByRole('combobox', { name: '지역 필터' }), 'KR');
    expect(all).toBeChecked();
    expect(all).not.toBePartiallyChecked();
    await userEvent.selectOptions(screen.getByRole('combobox', { name: '지역 필터' }), 'all');
    expect(all).toBePartiallyChecked();
    await userEvent.click(all);
    expect(all).toBeChecked();
    expect(all).not.toBePartiallyChecked();
    await userEvent.click(all);
    expect(all).not.toBeChecked();
    expect(all).not.toBePartiallyChecked();
  });

  it('URL 필터를 복원하고 변경할 때 기존 쿼리를 보존한다', async () => {
    memoryUrl.set('tab=crew&region=KR&group=1');
    mount();
    await screen.findByRole('combobox', { name: '한국크루 반' });
    expect(screen.queryByRole('combobox', { name: '북미캡틴 반' })).not.toBeInTheDocument();
    await userEvent.selectOptions(screen.getByRole('combobox', { name: '지역 필터' }), 'all');
    expect(memoryUrl.get()).toBe('tab=crew&group=1');
    expect(screen.getByRole('combobox', { name: '북미캡틴 반' })).toBeVisible();
    act(() => memoryUrl.set('tab=crew&region=INVALID&group=999'));
    expect(screen.getByRole('combobox', { name: '지역 필터' })).toHaveValue('all');
    expect(screen.getByRole('combobox', { name: '반 필터' })).toHaveValue('all');
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
    await userEvent.click(screen.getByRole('button', { name: '저장' }));
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
