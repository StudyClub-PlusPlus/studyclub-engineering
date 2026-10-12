import { Check, Minus } from 'lucide-react';

import { TableCard } from '@/components/ui';
import { SCOPE_TITLE, roleLabel } from '@/features/users/labels';
import type { ApiRolePermissions } from '@/features/users/types';

/**
 * 역할별 기본 권한 표 — **서버 응답을 그대로 그린다.**
 *
 * 그룹(`groups`) → 열(`roles`) → 행(`permissions`)을 받은 순서대로 그리기만 한다. 행·열·그룹 수를
 * 코드에 박지 않는다 — 서버 정의가 늘면 화면은 그대로 따라온다. 이름표가 없는 역할 키·`scope` 는
 * 키 문자열을 그대로 보인다.
 */
export function PermissionTables({ groups }: { groups: ApiRolePermissions['groups'] }) {
  return (
    <div className='flex flex-col gap-6'>
      {groups.map((group) => {
        const heading = SCOPE_TITLE[group.scope] ?? { title: group.scope };
        return (
          <section key={group.scope} aria-label={heading.title}>
            <h3 className='mb-2 flex items-baseline gap-2 text-sm font-bold'>
              {heading.title}
              {heading.note && <span className='text-xs font-medium text-fg-muted'>{heading.note}</span>}
            </h3>
            <TableCard>
              <thead>
                <tr>
                  <th className='w-[46%]'>하는 일</th>
                  {group.roles.map((role) => (
                    <th key={role} className='whitespace-nowrap text-center'>
                      {roleLabel(role)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {group.permissions.map((p) => (
                  <tr key={p.key}>
                    <td className='font-semibold'>{p.label}</td>
                    {group.roles.map((role) => (
                      <td key={role} className='text-center'>
                        {p.allowedRoles.includes(role) ? (
                          <Check size={15} className='inline text-success-700' aria-label='허용' />
                        ) : (
                          <Minus size={15} className='inline text-fg-placeholder' aria-label='없음' />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </TableCard>
          </section>
        );
      })}
    </div>
  );
}
