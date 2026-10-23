'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { DiscordCell } from '@console/components/DiscordCell';
import { PageHeader, TableCard } from '@console/components/ui';
import { maskEmail } from '@console/lib/mask';
import {
  ACCOUNT_ROLES,
  PERMISSIONS,
  PERMISSION_GROUPS,
  ROLES,
  ROLE_LABEL,
  assignBlockReason,
  requestRoleChange,
  scopeOf,
  type AccountRole,
  type RoleKey,
  type Scope,
} from '@console/lib/roles';
import { consoleUsers, studyTitleById, type ConsoleUser } from '@console/lib/users';
import { Badge, Modal, Pagination, toast, type BadgeTone } from '@studyclub/ui';
import { Check, ChevronDown, Eye, EyeOff, Info, Loader2, Minus } from 'lucide-react';

/** 한 화면에 20명. 스크롤로 다 내리는 것보다 「몇 번째 장을 보고 있는가」가 남는 편이 낫다. */
const PAGE_SIZE = 20;

type RoleFilter = 'all' | RoleKey;

// 순서는 어디서나 같다: 전체 → 캡틴 → 네비게이터 → 크루. `ROLES` 가 그 순서를 소유한다.
/**
 * 이메일 칸 — **가린 채로 둔다.**
 *
 * 역할을 바꾸러 들어온 화면이라 주소 전체가 필요한 일은 드물다. 늘 펼쳐 두면 화면을 띄워 둔 채
 * 자리를 비우거나 화면을 공유할 때 수십 명의 주소가 그대로 드러난다. 필요한 사람이 한 줄씩 펼친다.
 *
 * 펼친 것은 그 줄에만 남고 다른 줄에 옮겨 가지 않는다 — 한 번 누르면 목록 전체가 열리는 토글을
 * 두지 않는다. 펼친 줄은 **같은 버튼으로 다시 가린다.**
 */
function EmailCell({ email }: { email: string }) {
  const [shown, setShown] = useState(false);
  return (
    <td className='max-w-0 truncate text-fg-secondary'>
      <span className='inline-flex items-center gap-1.5'>
        <span className='tnum' title={shown ? email : undefined}>
          {shown ? email : maskEmail(email)}
        </span>
        <button
          type='button'
          onClick={() => setShown((v) => !v)}
          aria-label={shown ? '전체 주소 가리기' : '전체 주소 보기'}
          title={shown ? '가리기' : '전체 주소 보기'}
          className='grid h-6 w-6 shrink-0 place-items-center rounded-control text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg'
        >
          {shown ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </span>
    </td>
  );
}

/** 계정 권한 색. 캡틴과 크루를 색만으로 가르지 않으므로 이름도 함께 적는다. */
const ROLE_TONE: Record<AccountRole, BadgeTone> = { captain: 'captain', crew: 'member' };

const ROLE_FILTERS: { value: RoleFilter; label: string }[] = [
  { value: 'all', label: '전체' },
  ...ROLES.map((r) => ({ value: r.key as RoleFilter, label: r.label })),
];

/**
 * 계정 권한 배지 — 누르면 그 자리에서 캡틴·크루를 고른다.
 *
 * 배지가 곧 버튼이다. 배지(현재 상태)와 셀렉트(바꾸는 자리)를 따로 두면 같은 것을 두 번 그리게
 * 된다. 메뉴는 `position: fixed` 로 띄운다 — 표가 가로 스크롤을 가지고 있어 안에 그리면 잘린다.
 *
 * **고를 수 있는 것은 둘뿐이다.** 네비게이터는 계정 권한이 아니라 스터디마다 서는 역할이라
 * 그 스터디의 크루 명단에서 정한다.
 */
function RoleBadgeSelect({
  role,
  blocked,
  saving,
  onChange,
}: {
  role: AccountRole;
  blocked: string | null;
  /** 저장을 기다리는 중. 배지는 **지금 저장된 값** 그대로 두고 옆에서 돌기만 한다. */
  saving: boolean;
  onChange: (next: AccountRole) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function close() {
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    // 스크롤하면 메뉴만 제자리에 남아 엉뚱한 줄 위에 뜬다. 그냥 닫는다.
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const badge = (
    <Badge tone={ROLE_TONE[role]} dot className='whitespace-nowrap px-2.5 py-1 font-semibold'>
      {ROLE_LABEL[role]}
    </Badge>
  );

  if (blocked) {
    return (
      <span data-anno='role:1' title={blocked} className='inline-flex cursor-not-allowed opacity-70'>
        {badge}
      </span>
    );
  }

  // 저장을 기다리는 동안에는 다시 고를 수 없다 — 두 번 눌러 두 번 저장되지 않게.
  // 도는 것 하나면 된다 — 「변경 중」이라고 적으면 줄마다 글이 늘고 배지가 밀린다
  if (saving) {
    return (
      <span data-anno='role:1' className='inline-flex items-center gap-1.5'>
        {badge}
        <Loader2 size={13} className='animate-spin text-fg-muted' aria-label='저장 중' />
      </span>
    );
  }

  return (
    <>
      <button
        ref={buttonRef}
        type='button'
        data-anno='role:1'
        onMouseDown={(e) => e.stopPropagation()}
        onClick={() => {
          const r = buttonRef.current?.getBoundingClientRect();
          if (r) setPos({ top: r.bottom + 6, left: r.left });
          setOpen((v) => !v);
        }}
        aria-haspopup='listbox'
        aria-expanded={open}
        className='inline-flex items-center gap-1 rounded-pill transition-opacity hover:opacity-80'
      >
        {badge}
        <ChevronDown size={13} className='text-fg-muted' />
      </button>

      {open && pos && (
        <div
          role='listbox'
          data-anno='role:2'
          onMouseDown={(e) => e.stopPropagation()}
          style={{ top: pos.top, left: pos.left }}
          className='fixed z-50 rounded-card border border-border bg-surface p-1 shadow-lg'
        >
          {ACCOUNT_ROLES.map((r) => (
            <button
              key={r.key}
              type='button'
              role='option'
              aria-selected={r.key === role}
              // mousedown 으로 처리한다. 바깥 클릭 감지가 mousedown 에서 메뉴를 닫아 버리면
              // 버튼이 사라져 click 이 영영 오지 않는다.
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(r.key);
                setOpen(false);
              }}
              className='flex w-full rounded-control p-1 hover:bg-surface-2'
            >
              <Badge tone={ROLE_TONE[r.key]} dot className='whitespace-nowrap px-2.5 py-1 font-semibold'>
                {r.label}
              </Badge>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

/**
 * 역할별 기본 권한 — 제목 옆 ⓘ 로 연다.
 *
 * **표를 둘로 가른다.** 담당 스터디 안에서 도는 일과 사이트 전체에 미치는 일은 같은 체크가
 * 아니다. 한 표에 섞으면 네비게이터의 ✓ 가 모든 스터디를 뜻하는 것처럼 읽힌다.
 */
function PermissionMatrixDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal open onClose={onClose} size='lg' title='역할별 기본 권한'>
      <div className='flex flex-col gap-6' data-anno='role:4'>
        {PERMISSION_GROUPS.map((group) => (
          <section key={group.key}>
            <h3 className='mb-2 flex items-baseline gap-2 text-sm font-bold'>
              {group.label}
              {group.note && <span className='text-xs font-medium text-fg-muted'>{group.note}</span>}
            </h3>
            <TableCard>
              <thead>
                <tr>
                  <th className='w-[46%]'>하는 일</th>
                  {group.roles.map((role) => (
                    <th key={role} className='whitespace-nowrap text-center'>
                      {ROLE_LABEL[role]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERMISSIONS.filter((p) => p.group === group.key).map((p) => (
                  <tr key={p.key}>
                    <td className='font-semibold'>{p.label}</td>
                    {group.roles.map((role) => (
                      <td key={role} className='text-center'>
                        <ScopeCell scope={scopeOf(role, p.key)} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </TableCard>
          </section>
        ))}
      </div>
    </Modal>
  );
}

/**
 * 네비게이터 칸 — 맡은 스터디 이름.
 *
 * **여기서 바꾸지 않는다.** 누가 어느 스터디를 맡는지는 그 스터디의 크루 명단에서 정한다 —
 * 스터디를 보면서 정할 일을 사람 목록에서 하면 어느 스터디 이야기인지 알 수 없다.
 */
function NavigatorCell({ studyIds }: { studyIds: string[] }) {
  if (studyIds.length === 0) return <span className='text-fg-muted'>—</span>;
  const [first, ...rest] = studyIds;
  return (
    <span
      className='inline-flex items-center gap-1.5'
      title={studyIds.map((id) => studyTitleById[id] ?? id).join(', ')}
    >
      <span className='max-w-[18ch] truncate text-fg'>{studyTitleById[first!] ?? first}</span>
      {rest.length > 0 && <span className='tnum text-fg-muted'>+{rest.length}</span>}
    </span>
  );
}

/** 권한 칸. 범위는 표 제목 옆 한마디가 말한다. */
function ScopeCell({ scope }: { scope: Scope }) {
  if (scope === 'none') return <Minus size={15} className='inline text-fg-placeholder' aria-label='없음' />;
  return <Check size={15} className='inline text-success-700' aria-label='허용' />;
}

export function UsersTable() {
  // TODO(api): PATCH /api/users/{id}/role. 지금은 화면 상태로만 바뀐다.
  const [rows, setRows] = useState<ConsoleUser[]>(consoleUsers);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [matrixOpen, setMatrixOpen] = useState(false);
  const [page, setPage] = useState(1);
  // 저장을 기다리는 줄. 그 줄의 배지는 잠기고 옆에서 하나가 돈다
  const [saving, setSaving] = useState<ReadonlySet<string>>(new Set());
  // 바꾸는 함수가 **지금 값**을 읽어야 한다. 의존성에 넣으면 줄이 바뀔 때마다 함수가 새로 만들어진다
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  // TODO(api): 로그인한 계정 id 로 교체. 자기 권한을 스스로 못 내리게 하는 데 쓴다.
  const actorId = rows.find((r) => r.account === 'captain')?.id ?? '';
  const captainCount = rows.filter((r) => r.account === 'captain').length;

  /**
   * 권한을 바꾼다 — **저장된 뒤에** 화면이 바뀐다.
   *
   * 누르자마자 배지를 바꾸면 저장에 실패해도 바뀐 것처럼 남는다. 권한은 지금 저장돼 있는 것이
   * 보여야 하는 값이라, 기다리는 동안에는 **원래 배지를 그대로 두고** 변경 중이라는 사실만 알린다.
   */
  const changeAccount = useCallback(async (id: string, account: AccountRole) => {
    // 지금과 같은 값을 고른 것은 **아무 일도 아니다** — 보내지도, 바뀌었다고 알리지도 않는다
    if (rowsRef.current.find((m) => m.id === id)?.account === account) return;
    setSaving((prev) => new Set([...prev, id]));
    try {
      await requestRoleChange(id);
      setRows((list) => list.map((m) => (m.id === id ? { ...m, account } : m)));
      // 디스코드 역할은 이 화면이 건드리지 못한다. 바꾼 사람이 그 사실을 바로 알아야 한다.
      // 무엇으로 바뀌었는지는 배지가 그 자리에서 말하므로 여기서 또 말하지 않는다
      toast.success('변경 성공. 디스코드 권한은 별도로 변경해야 합니다.', { duration: 6000 });
    } catch {
      // 바뀐 것이 없다. 배지는 원래 값 그대로다
      toast.error(
        (t) => (
          <span className='flex items-center gap-3'>
            권한을 바꾸지 못했습니다. 다시 시도해 주세요.
            <button
              type='button'
              className='shrink-0 font-semibold text-primary-600 underline-offset-2 hover:underline'
              onClick={() => {
                toast.dismiss(t.id);
                void changeAccount(id, account);
              }}
            >
              다시 시도
            </button>
          </span>
        ),
        { duration: 8000 },
      );
    } finally {
      setSaving((prev) => new Set([...prev].filter((x) => x !== id)));
    }
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((m) => {
      if (roleFilter === 'navigator' ? m.navigatorOf.length === 0 : roleFilter !== 'all' && m.account !== roleFilter)
        return false;
      if (q && !`${m.name} ${m.email}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, query, roleFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  // 걸러진 뒤 페이지가 줄면 빈 화면이 남는다. 범위를 벗어나면 마지막 장으로 당긴다.
  const current = Math.min(page, pageCount);
  const pageRows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  return (
    <div>
      <div data-anno='list:1'>
        <PageHeader
          title='유저'
          action={
            <button
              type='button'
              data-anno='role:3'
              onClick={() => setMatrixOpen(true)}
              title='역할별 기본 권한'
              aria-label='역할별 기본 권한'
              className='grid h-8 w-8 place-items-center rounded-full text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg'
            >
              <Info size={17} />
            </button>
          }
        />
      </div>

      <div data-anno='list:2' className='mb-3 flex flex-wrap items-center gap-3'>
        {/* 역할은 셋뿐이라 접어 둘 이유가 없다 — 펴 두면 지금 무엇으로 걸러져 있는지 한눈에 보인다 */}
        <nav className='inline-flex rounded-pill bg-surface-2 p-1'>
          {ROLE_FILTERS.map((o) => {
            const on = roleFilter === o.value;
            return (
              <button
                key={o.value}
                type='button'
                onClick={() => {
                  setRoleFilter(o.value);
                  setPage(1);
                }}
                className={`rounded-pill px-3 py-1.5 text-sm font-semibold transition-colors ${
                  on ? 'bg-surface text-fg shadow-sm' : 'text-fg-muted hover:text-fg'
                }`}
              >
                {o.label}
              </button>
            );
          })}
        </nav>
        <input
          type='search'
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
          placeholder='이름 · 이메일 검색'
          className='h-9 w-56 rounded-control border border-border-strong bg-surface px-3 text-sm outline-none focus:border-brand'
        />
        {/* 탭·검색으로 걸러진 뒤의 수다 — 표 위에 두어야 무엇을 세고 있는지가 분명하다 */}
        <span className='tnum ml-auto text-sm text-fg-muted'>총 {filtered.length}명</span>
      </div>

      <div>
        <TableCard anno='list:3'>
          <thead>
            <tr>
              <th className='w-[18%] whitespace-nowrap'>이름</th>
              <th className='w-[32%]'>이메일</th>
              <th className='w-[11%] whitespace-nowrap'>디스코드</th>
              <th className='w-[12%] whitespace-nowrap'>권한</th>
              <th className='whitespace-nowrap'>네비게이터</th>
              <th className='whitespace-nowrap'>가입일</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((m) => (
              <tr key={m.id}>
                <td className='whitespace-nowrap font-semibold'>
                  {m.name}
                  {m.status === 'dormant' && <span className='ml-1.5 text-xs text-fg-muted'>휴면</span>}
                </td>
                <EmailCell email={m.email} />
                {/* 스터디가 디스코드에서 돌아간다 — 이어져 있지 않으면 권한을 올려도 합류하지 못한다.
                    아이디는 가린 채로 두고 필요한 줄만 펼친다 — 이메일과 같은 규칙 (POL-0007) */}
                <DiscordCell email={m.email} reveal />
                <td>
                  <RoleBadgeSelect
                    role={m.account}
                    blocked={assignBlockReason({
                      isSelf: m.id === actorId,
                      targetRole: m.account,
                      captainCount,
                    })}
                    saving={saving.has(m.id)}
                    onChange={(next) => void changeAccount(m.id, next)}
                  />
                </td>
                {/* 스터디 단위 역할이라 이름을 적는다 — 「네비게이터 ✓」만으로는 어느 스터디인지 알 수 없다 */}
                <td className='whitespace-nowrap text-xs text-fg-secondary'>
                  <NavigatorCell studyIds={m.navigatorOf} />
                </td>
                <td className='tnum whitespace-nowrap text-xs text-fg-muted'>{m.joinedAt}</td>
              </tr>
            ))}
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={6} className='text-center text-fg-muted'>
                  조건에 맞는 유저가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </TableCard>
      </div>

      <Pagination data-anno='list:4' className='mt-4' page={current} total={pageCount} onChange={setPage} />

      {matrixOpen && <PermissionMatrixDialog onClose={() => setMatrixOpen(false)} />}
    </div>
  );
}
