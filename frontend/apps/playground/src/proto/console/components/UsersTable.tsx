'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { PageHeader, TableCard } from '@console/components/ui';
import { PERMISSIONS, ROLES, ROLE_LABEL, ROLE_PERMISSIONS, assignBlockReason, type RoleKey } from '@console/lib/roles';
import { consoleUsers, studyTitleById, type ConsoleUser } from '@console/lib/users';
import { Badge, Modal, type BadgeTone } from '@studyclub/ui';
import { Check, ChevronDown, ChevronLeft, ChevronRight, Info, Minus } from 'lucide-react';

/**
 * 유저 — 명단과 역할 부여.
 *
 * 역할은 **셀에서 바로 바꾼다.** 별도 「역할 변경」 버튼과 모달을 거치면 한 명 바꾸는 데 세 번을
 * 눌러야 하는데, 캡틴이 여기서 하는 일은 사실상 역할 하나 고르는 것뿐이다.
 *
 * 역할별 기본 권한표는 제목 옆 ⓘ 안에 둔다 — 명단은 매번 보고 역할 체계는 가끔 본다.
 *
 * 이 화면을 여는 사람은 캡틴이다(아니면 라우트에서 막힌다). 그래서 「캡틴인가」는 묻지 않는다.
 *
 * 역할 변경은 화면 상태로만 처리한다. 새로고침하면 되돌아간다.
 * TODO(api): PATCH /api/users/{id}/role
 */

// 크루는 디자인 시스템의 중립(member) 톤을 쓴다 — 토큰 이름만 다르고 같은 자리다.
const ROLE_TONE: Record<RoleKey, BadgeTone> = { captain: 'captain', navigator: 'navigator', crew: 'member' };

/** 한 화면에 20명. 스크롤로 다 내리는 것보다 「몇 번째 장을 보고 있는가」가 남는 편이 낫다. */
const PAGE_SIZE = 20;

type RoleFilter = 'all' | RoleKey;

// 순서는 어디서나 같다: 전체 → 캡틴 → 네비게이터 → 크루. `ROLES` 가 그 순서를 소유한다.
const ROLE_FILTERS: { value: RoleFilter; label: string }[] = [
  { value: 'all', label: '전체' },
  ...ROLES.map((r) => ({ value: r.key as RoleFilter, label: r.label })),
];

/**
 * 역할 배지 — 누르면 그 자리에서 역할을 고른다.
 *
 * 배지가 곧 버튼이다. 배지(현재 상태)와 셀렉트(바꾸는 자리)를 따로 두면 같은 것을 두 번 그리게
 * 된다. 메뉴는 `position: fixed` 로 띄운다 — 표가 가로 스크롤을 가지고 있어 안에 그리면 잘린다.
 */
function RoleBadgeSelect({
  role,
  blocked,
  onChange,
}: {
  role: RoleKey;
  blocked: string | null;
  onChange: (next: RoleKey) => void;
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
      <span title={blocked} className='inline-flex cursor-not-allowed opacity-70'>
        {badge}
      </span>
    );
  }

  return (
    <>
      <button
        ref={buttonRef}
        type='button'
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
          onMouseDown={(e) => e.stopPropagation()}
          style={{ top: pos.top, left: pos.left }}
          className='fixed z-50 w-40 rounded-card border border-border bg-surface p-1 shadow-lg'
        >
          {ROLES.map((r) => (
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
              className='flex w-full items-center gap-2 rounded-control px-2 py-1.5 text-left hover:bg-surface-2'
            >
              <Badge tone={ROLE_TONE[r.key]} dot className='whitespace-nowrap px-2.5 py-1 font-semibold'>
                {r.label}
              </Badge>
              {r.key === role && <Check size={14} className='ml-auto text-fg-muted' />}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

/** 페이지 번호 목록 — 항상 최대 7칸. 앞뒤가 잘리는 자리에는 「…」 를 둔다. */
function pageWindow(page: number, total: number): (number | 'gap')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const around = [page - 1, page, page + 1].filter((n) => n > 1 && n < total);
  const items: (number | 'gap')[] = [1];
  if (around[0] !== undefined && around[0] > 2) items.push('gap');
  items.push(...around);
  const last = around[around.length - 1];
  if (last !== undefined && last < total - 1) items.push('gap');
  items.push(total);
  return items;
}

function Pagination({ page, total, onChange }: { page: number; total: number; onChange: (next: number) => void }) {
  if (total <= 1) return null;
  const cell = 'grid h-8 min-w-8 place-items-center rounded-control px-2 text-sm transition-colors';
  return (
    <nav data-anno='6' className='mt-4 flex items-center justify-center gap-1'>
      <button
        type='button'
        onClick={() => onChange(page - 1)}
        disabled={page === 1}
        aria-label='이전 페이지'
        className={`${cell} text-fg-muted hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent`}
      >
        <ChevronLeft size={16} />
      </button>
      {pageWindow(page, total).map((n, i) =>
        n === 'gap' ? (
          <span key={`gap-${i}`} className={`${cell} text-fg-placeholder`}>
            …
          </span>
        ) : (
          <button
            key={n}
            type='button'
            onClick={() => onChange(n)}
            aria-current={n === page ? 'page' : undefined}
            className={`${cell} tnum ${
              n === page ? 'bg-surface-2 font-bold text-fg' : 'text-fg-muted hover:bg-surface-2'
            }`}
          >
            {n}
          </button>
        ),
      )}
      <button
        type='button'
        onClick={() => onChange(page + 1)}
        disabled={page === total}
        aria-label='다음 페이지'
        className={`${cell} text-fg-muted hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent`}
      >
        <ChevronRight size={16} />
      </button>
    </nav>
  );
}

/** 역할별 기본 권한 — 제목 옆 ⓘ 로 연다. */
function PermissionMatrixDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal open onClose={onClose} size='lg' title='역할별 기본 권한'>
      <TableCard>
        <thead>
          <tr>
            <th className='w-[46%]'>권한</th>
            {ROLES.map((r) => (
              <th key={r.key} className='whitespace-nowrap text-center'>
                {r.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PERMISSIONS.map((p) => (
            <tr key={p.key}>
              <td className='font-semibold'>{p.label}</td>
              {ROLES.map((r) => {
                const on = ROLE_PERMISSIONS[r.key].includes(p.key);
                return (
                  <td key={r.key} className='text-center'>
                    {on ? (
                      <Check size={15} className='inline text-success-700' aria-label='허용' />
                    ) : (
                      <Minus size={15} className='inline text-fg-placeholder' aria-label='없음' />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </TableCard>
    </Modal>
  );
}

export function UsersTable() {
  const [rows, setRows] = useState<ConsoleUser[]>(consoleUsers);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [matrixOpen, setMatrixOpen] = useState(false);
  const [page, setPage] = useState(1);

  // TODO(api): 로그인한 계정 id 로 교체. 자기 역할을 스스로 못 바꾸게 하는 데 쓴다.
  const actorId = rows.find((r) => r.role === 'captain')?.id ?? '';

  const captainCount = rows.filter((r) => r.role === 'captain').length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((m) => {
      if (roleFilter !== 'all' && m.role !== roleFilter) return false;
      if (q && !`${m.name} ${m.email}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, query, roleFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  // 걸러진 뒤 페이지가 줄면 빈 화면이 남는다. 범위를 벗어나면 마지막 장으로 당긴다.
  const current = Math.min(page, pageCount);
  const pageRows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  function setRole(id: string, role: RoleKey) {
    setRows((list) => list.map((m) => (m.id === id ? { ...m, role } : m)));
  }

  return (
    <div>
      <div data-anno='1'>
        <PageHeader
          title='유저'
          action={
            <button
              type='button'
              data-anno='2'
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

      <div data-anno='4' className='mb-3 flex flex-wrap items-center gap-3'>
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

      <div data-anno='5'>
        <TableCard>
          <thead>
            <tr>
              <th className='w-[18%] whitespace-nowrap'>이름</th>
              <th className='w-[38%]'>이메일</th>
              <th className='w-[14%] whitespace-nowrap'>역할</th>
              <th className='whitespace-nowrap'>참여 스터디</th>
              <th className='whitespace-nowrap'>가입일</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((m) => {
              const blocked = assignBlockReason({
                isSelf: m.id === actorId,
                targetRole: m.role,
                captainCount,
              });
              return (
                <tr key={m.id}>
                  <td className='whitespace-nowrap font-semibold'>
                    {m.name}
                    {m.status === 'dormant' && <span className='ml-1.5 text-xs text-fg-muted'>휴면</span>}
                  </td>
                  <td className='max-w-0 truncate text-fg-secondary'>{m.email}</td>
                  <td>
                    <RoleBadgeSelect role={m.role} blocked={blocked} onChange={(next) => setRole(m.id, next)} />
                  </td>
                  <td className='tnum whitespace-nowrap text-xs text-fg-secondary'>
                    {m.studyIds.length === 0 ? (
                      <span className='text-fg-muted'>없음</span>
                    ) : (
                      <span title={m.studyIds.map((id) => studyTitleById[id] ?? id).join(', ')}>
                        {m.studyIds.length}개
                      </span>
                    )}
                  </td>
                  <td className='tnum whitespace-nowrap text-xs text-fg-muted'>{m.joinedAt}</td>
                </tr>
              );
            })}
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={5} className='text-center text-fg-muted'>
                  조건에 맞는 유저가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </TableCard>
      </div>

      <Pagination page={current} total={pageCount} onChange={setPage} />

      {matrixOpen && <PermissionMatrixDialog onClose={() => setMatrixOpen(false)} />}
    </div>
  );
}
