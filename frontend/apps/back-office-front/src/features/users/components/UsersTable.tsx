'use client';

import { TableCard } from '@/components/ui';
import { AccountRoleCell } from '@/features/users/components/AccountRoleCell';
import { EmailCell } from '@/features/users/components/EmailCell';
import { displayName } from '@/features/users/labels';
import type { ApiAdminAccount } from '@/features/users/types';

/** 가입일 — 서버는 UTC ISO 8601 로 준다. */
function fmtDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString('ko-KR');
}

/**
 * 네비게이터 칸 — 맡은 스터디 이름.
 *
 * **여기서 바꾸지 않는다.** 누가 어느 스터디를 맡는지는 그 스터디의 크루 명단에서 정한다 —
 * 스터디를 보면서 정할 일을 사람 목록에서 하면 어느 스터디 이야기인지 알 수 없다.
 * 첫 스터디만 적고 나머지는 개수로 접는다. 전체 이름은 title.
 */
function NavigatorCell({ studies }: { studies: ApiAdminAccount['navigatorOf'] }) {
  if (studies.length === 0) return <span className='text-fg-muted'>—</span>;
  const [first, ...rest] = studies;
  return (
    <span className='inline-flex items-center gap-1.5' title={studies.map((s) => s.title).join(', ')}>
      <span className='max-w-[18ch] truncate text-fg'>{first!.title}</span>
      {rest.length > 0 && <span className='tnum text-fg-muted'>+{rest.length}</span>}
    </span>
  );
}

/**
 * 회원 목록 표. 정렬·필터·페이지는 서버가 한다 — 받은 순서 그대로 그린다(화면에서 다시 섞으면 한 페이지 안에서만 섞인다).
 * 원본 이메일은 `revealed` 에 있는 줄만 보인다(페이지 state, 목록이 다시 오면 비워진다).
 */
export function UsersTable({
  rows,
  revealed,
  onReveal,
}: {
  rows: ApiAdminAccount[];
  revealed: ReadonlyMap<number, string>;
  onReveal: (accountId: number, email: string) => void;
}) {
  return (
    <TableCard>
      <thead>
        <tr>
          <th className='w-[18%] whitespace-nowrap'>이름</th>
          <th className='w-[32%]'>이메일</th>
          <th className='w-[14%] whitespace-nowrap'>권한</th>
          <th className='whitespace-nowrap'>네비게이터</th>
          <th className='whitespace-nowrap'>가입일</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((a) => (
          <tr key={a.id}>
            <td className='whitespace-nowrap font-semibold'>
              {displayName(a)}
              {a.dormant && <span className='ml-1.5 text-xs font-normal text-fg-muted'>휴면</span>}
            </td>
            <td className='max-w-0 text-fg-secondary'>
              <EmailCell
                accountId={a.id}
                displayName={displayName(a)}
                maskedEmail={a.maskedEmail}
                revealedEmail={revealed.get(a.id)}
                onReveal={onReveal}
              />
            </td>
            <td>
              <AccountRoleCell account={a} />
            </td>
            {/* 스터디 단위 역할이라 이름을 적는다 — 「네비게이터 ✓」만으로는 어느 스터디인지 알 수 없다 */}
            <td className='whitespace-nowrap text-xs text-fg-secondary'>
              <NavigatorCell studies={a.navigatorOf} />
            </td>
            <td className='tnum whitespace-nowrap text-xs text-fg-muted'>{fmtDate(a.joinedAt)}</td>
          </tr>
        ))}
        {rows.length === 0 && (
          <tr>
            <td colSpan={5} className='text-center text-fg-muted'>
              조건에 맞는 유저가 없습니다.
            </td>
          </tr>
        )}
      </tbody>
    </TableCard>
  );
}
