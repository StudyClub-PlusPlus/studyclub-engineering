import type { ReactNode } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PermissionTables } from '@/features/users/components/PermissionTables';
import { RoleBadgeSelect } from '@/features/users/components/RoleBadgeSelect';
import { UsersTable } from '@/features/users/components/UsersTable';
import { BLOCKED_REASON_MESSAGE, TAB_OPTIONS, displayName } from '@/features/users/labels';
import { usersPath } from '@/features/users/queries';
import type { ApiAdminAccount, ApiRolePermissions, UserRole } from '@/features/users/types';

function account(patch: Partial<ApiAdminAccount>): ApiAdminAccount {
  return {
    id: 1,
    name: '하늘',
    maskedEmail: 'h***@example.com',
    systemRole: 'MEMBER',
    navigatorOf: [],
    dormant: false,
    joinedAt: '2026-09-01T11:00:00Z',
    roleChangeBlockedReason: null,
    ...patch,
  };
}

function withQuery(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{ui}</QueryClientProvider>;
}

describe('탭 → role 파라미터 (1:1)', () => {
  const roleOf = (role: UserRole) =>
    new URL(usersPath({ role, offset: 0, limit: 20 }), 'http://x').searchParams.get('role');

  it('전체는 기본값(ALL)이라 싣지 않는다', () => {
    expect(roleOf('ALL')).toBeNull();
  });
  it('캡틴·네비게이터·크루는 탭 이름 그대로 보낸다', () => {
    expect(roleOf('CAPTAIN')).toBe('CAPTAIN');
    expect(roleOf('NAVIGATOR')).toBe('NAVIGATOR');
    expect(roleOf('CREW')).toBe('CREW');
  });
  it('탭 옵션이 네 값을 그 순서로 가진다', () => {
    expect(TAB_OPTIONS.map((o) => o.value)).toEqual(['ALL', 'CAPTAIN', 'NAVIGATOR', 'CREW']);
  });
});

describe('목록 요청 경로', () => {
  it('값이 없는 조건은 넣지 않고 페이지는 항상 넣는다', () => {
    expect(usersPath({ offset: 0, limit: 20 })).toBe('/api/admin/users?offset=0&limit=20');
  });
  it('조건을 함께 싣고 q 는 앞뒤 공백을 자른다', () => {
    const path = usersPath({ role: 'CREW', q: ' 하늘 ', offset: 20, limit: 20 });
    const params = new URL(path, 'http://x').searchParams;
    expect(params.get('role')).toBe('CREW');
    expect(params.get('q')).toBe('하늘');
    expect(params.get('offset')).toBe('20');
  });
});

describe('이름 표기', () => {
  it('이름이 있으면 이름을 쓴다', () => {
    expect(displayName(account({}))).toBe('하늘');
  });
  it('온보딩 전(name null)이면 가린 이메일의 로컬파트를 쓴다 — 원본이 아니다', () => {
    expect(displayName(account({ name: null, maskedEmail: 'n***@example.com' }))).toBe('n***');
  });
});

describe('UsersTable', () => {
  it('이름이 null 이면 로컬파트를, 휴면이면 「휴면」을 적는다', () => {
    render(
      withQuery(
        <UsersTable
          rows={[account({ id: 27, name: null, maskedEmail: 'n***@example.com', dormant: true })]}
          revealed={new Map()}
          onReveal={() => {}}
        />,
      ),
    );
    const row = screen.getAllByRole('row')[1]!;
    expect(within(row).getByText('n***')).toBeInTheDocument();
    expect(within(row).getByText('휴면')).toBeInTheDocument();
    // 가린 이메일과 「보기」
    expect(within(row).getByText('n***@example.com')).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: '보기' })).toBeInTheDocument();
  });

  it('받아 둔 원본이 있는 줄만 원본을 보이고 「보기」가 사라진다', () => {
    render(
      withQuery(
        <UsersTable
          rows={[account({ id: 18 }), account({ id: 19, name: '나래', maskedEmail: 'n***@example.com' })]}
          revealed={new Map([[18, 'haneul@example.com']])}
          onReveal={() => {}}
        />,
      ),
    );
    expect(screen.getByText('haneul@example.com')).toBeInTheDocument();
    expect(screen.getByText('n***@example.com')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: '보기' })).toHaveLength(1);
  });

  it('네비게이터는 첫 스터디와 나머지 개수를 적는다', () => {
    render(
      withQuery(
        <UsersTable
          rows={[
            account({
              navigatorOf: [
                { studyId: 21, title: 'AI 논문 리딩' },
                { studyId: 9, title: '알고리즘 스터디' },
              ],
            }),
          ]}
          revealed={new Map()}
          onReveal={() => {}}
        />,
      ),
    );
    expect(screen.getByText('AI 논문 리딩')).toBeInTheDocument();
    expect(screen.getByText('+1')).toBeInTheDocument();
  });

  it('결과가 없으면 안내 문구를 보인다', () => {
    render(withQuery(<UsersTable rows={[]} revealed={new Map()} onReveal={() => {}} />));
    expect(screen.getByText('조건에 맞는 유저가 없습니다.')).toBeInTheDocument();
  });

  it('CANNOT_CHANGE_OWN_ROLE 로 잠긴 줄은 선택 버튼 없이 사유를 툴팁으로 보인다', () => {
    render(
      withQuery(
        <UsersTable
          rows={[account({ id: 3, systemRole: 'ADMIN', roleChangeBlockedReason: 'CANNOT_CHANGE_OWN_ROLE' })]}
          revealed={new Map()}
          onReveal={() => {}}
        />,
      ),
    );
    expect(screen.queryByRole('button', { name: /캡틴/ })).not.toBeInTheDocument();
    expect(screen.getByTitle(BLOCKED_REASON_MESSAGE.CANNOT_CHANGE_OWN_ROLE)).toBeInTheDocument();
  });
});

describe('RoleBadgeSelect', () => {
  it('LAST_ADMIN_REQUIRED 도 잠그고 그 사유를 보인다', () => {
    render(<RoleBadgeSelect role='ADMIN' blockedReason='LAST_ADMIN_REQUIRED' onChange={() => {}} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByTitle('마지막 캡틴입니다. 먼저 다른 캡틴을 세우세요.')).toBeInTheDocument();
  });

  it('처리 중이면 배지는 그대로 두고 「변경 중」만 붙인다', () => {
    render(<RoleBadgeSelect role='MEMBER' blockedReason={null} pending onChange={() => {}} />);
    expect(screen.getByText('크루')).toBeInTheDocument();
    expect(screen.getByText('변경 중')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('바꿀 수 있으면 현재 값이 버튼에 적힌다', () => {
    render(<RoleBadgeSelect role='MEMBER' blockedReason={null} onChange={() => {}} />);
    expect(screen.getByRole('button', { name: /크루/ })).toBeInTheDocument();
  });
});

describe('PermissionTables', () => {
  const group = (scope: string, roles: string[], keys: string[]): ApiRolePermissions['groups'][number] => ({
    scope,
    roles,
    permissions: keys.map((key) => ({ key, label: `${key} 라벨`, allowedRoles: roles.slice(0, 1) })),
  });

  it('응답의 그룹 수만큼 표를, 행 수만큼 행을 그린다', () => {
    const { container } = render(
      <PermissionTables
        groups={[group('STUDY', ['ADMIN', 'LEADER', 'MEMBER'], ['A', 'B', 'C']), group('SITE', ['ADMIN', 'MEMBER'], ['D', 'E'])]}
      />,
    );
    expect(container.querySelectorAll('table')).toHaveLength(2);
    expect(container.querySelectorAll('tbody tr')).toHaveLength(5);
    expect(screen.getByText('스터디 단위 권한')).toBeInTheDocument();
    expect(screen.getByText('네비게이터 권한은 담당 스터디에 국한')).toBeInTheDocument();
    expect(screen.getByText('사이트 전체 권한')).toBeInTheDocument();
  });

  it('코드에 없는 그룹·역할 키도 그대로 그린다 (키 문자열 그대로)', () => {
    const { container } = render(
      <PermissionTables
        groups={[group('STUDY', ['ADMIN', 'LEADER', 'MEMBER'], ['A']), group('SITE', ['ADMIN', 'MEMBER'], ['B']), group('APPLY', ['OWNER', 'ADMIN'], ['C', 'D'])]}
      />,
    );
    expect(container.querySelectorAll('table')).toHaveLength(3);
    expect(screen.getByText('APPLY')).toBeInTheDocument();
    expect(screen.getByText('OWNER')).toBeInTheDocument();
  });

  it('허용 역할만 체크하고 나머지는 없음으로 그린다', () => {
    render(
      <PermissionTables
        groups={[{ scope: 'SITE', roles: ['ADMIN', 'MEMBER'], permissions: [{ key: 'X', label: '무언가', allowedRoles: ['ADMIN'] }] }]}
      />,
    );
    const row = screen.getByText('무언가').closest('tr')!;
    expect(within(row).getAllByLabelText('허용')).toHaveLength(1);
    expect(within(row).getAllByLabelText('없음')).toHaveLength(1);
  });
});
