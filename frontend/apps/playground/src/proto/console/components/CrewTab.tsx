'use client';

import { useEffect, useState } from 'react';

import { CHECKBOX, SELECT_CLASS, SelectAll } from '@console/components/AttendanceTab';
import { TableCard } from '@console/components/ui';
import { CLASS_TITLE_MAX, classLabel, type StudyClass } from '@console/lib/classes';
import { EMPTY_RULE } from '@console/lib/schedule';
import { MEMBER_REGIONS, type Crew } from '@studyclub/mock';
import { Button, SelectionCount, TableActionBar } from '@studyclub/ui';
import { Plus } from 'lucide-react';

/**
 * 신청자 탭 — 반, 참여 명단.
 *
 * **승인이라는 단계가 없다.** 신청한 사람은 곧 크루다. 운영자가 한 명씩 통과시키는 절차를 두면
 * 처리하지 않은 사람이 대기열에 쌓이고, 그 사이 그 사람은 자기가 들어왔는지 알 수 없다.
 *
 * 여기서 하는 일은 셋이다 — **반을 만들고, 크루를 반에 넣고, 이 스터디를 맡을 사람을 정한다.**
 * 반은 제목 하나로 만든다. 언제 모이는지는 일정 탭에서 그 반에 정한다.
 *
 * **캡틴도 참여하려면 신청한다.** 스터디를 만든 캡틴이라고 명부에 저절로 들어가지 않는다 — 참여할지는
 * 스터디마다 다르다. 신청하면 크루와 같은 줄로 여기 나온다 (POL-0001).
 */

function regionLabel(key: Crew['region']) {
  return MEMBER_REGIONS.find((r) => r.key === key)?.label.ko ?? key;
}

export function CrewTab({
  crew,
  classes,
  assign,
  onSaveClass,
  onRemoveClass,
  onAssign,
  onDirtyChange,
  navigators,
  onToggleNavigator,
}: {
  crew: Crew[];
  classes: StudyClass[];
  assign: Record<string, string>;
  /** 이 스터디를 맡은 크루. 네비게이터 권한은 여기 있는 사람에게 이 스터디 안에서만 선다. */
  navigators: string[];
  onToggleNavigator: (crewId: string) => void;
  /** 반을 만들거나 이름을 바꾼다. */
  onSaveClass: (cls: StudyClass) => void;
  onRemoveClass: (classId: string) => void;
  onAssign: (crewId: string, classId: string) => void;
  /** 반 · 역할에 저장하지 않은 변경이 있는가. 탭을 옮기기 전에 묻는 데 쓴다. */
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const active = crew;
  // 명단 필터 — 반을 나눌 때 지역별로, 반을 확인할 때 반별로 본다. 둘 다 화면에서만 거른다
  const [regionFilter, setRegionFilter] = useState<'all' | Crew['region']>('all');
  const [picked, setClassFilter] = useState<string>('all');
  // 고른 반이 지워졌으면 전체로 본다
  const classFilter = classes.some((c) => c.id === picked) ? picked : 'all';
  const shown = active.filter(
    (c) =>
      (regionFilter === 'all' || c.region === regionFilter) && (classFilter === 'all' || assign[c.id] === classFilter),
  );
  // 반 만들기 · 제목 수정은 모달 없이 카드 안에서 한다.
  // 수정은 그 반 카드가, 「반 추가」는 목록 맨 아래 새 카드가 입력칸으로 열린다. 한 번에 하나만 연다.
  const [renaming, setRenaming] = useState<{ id: string; title: string; touched: boolean } | null>(null);
  function saveRename(cls: StudyClass | undefined) {
    if (!renaming) return;
    const title = renaming.title.trim();
    if (!title) {
      setRenaming({ ...renaming, touched: true });
      return;
    }
    // TODO(api): 새 반은 POST …/groups { name }, 수정은 PATCH …/groups/{groupId} { name }
    if (!cls) onSaveClass({ id: `c${Date.now()}`, title, rule: EMPTY_RULE });
    else if (title !== cls.title) onSaveClass({ ...cls, title });
    setRenaming(null);
  }
  const adding = renaming?.id === NEW_CLASS;

  /** 카드 안 입력 — 입력칸은 줄의 절반, 취소 · 저장은 오른쪽(읽기 상태의 수정 · 삭제 자리). */
  function editor(cls: StudyClass | undefined) {
    if (!renaming) return null;
    const errId = `class-title-${renaming.id}`;
    const empty = renaming.touched && !renaming.title.trim();
    return (
      <form
        data-anno='class:1-4'
        className='flex flex-col gap-1'
        onSubmit={(ev) => {
          ev.preventDefault();
          saveRename(cls);
        }}
        onKeyDown={(ev) => ev.key === 'Escape' && setRenaming(null)}
      >
        <div className='flex items-center gap-3'>
          <input
            aria-label='반 제목'
            value={renaming.title}
            maxLength={CLASS_TITLE_MAX}
            placeholder={cls ? undefined : '예: A반 · 미국 금요일반'}
            aria-invalid={empty || undefined}
            aria-describedby={errId}
            onChange={(ev) => setRenaming({ ...renaming, title: ev.target.value })}
            className='h-9 w-1/2 min-w-0 rounded-control border border-border-strong bg-bg px-3 text-sm font-bold text-neutral-900 outline-none focus:border-brand focus:shadow-[var(--ring)]'
          />
          <div className='ml-auto flex shrink-0 gap-1.5'>
            <Button type='button' size='sm' variant='ghost' onClick={() => setRenaming(null)}>
              취소
            </Button>
            <Button type='submit' size='sm'>
              저장
            </Button>
          </div>
        </div>
        <p id={errId} role='status' className='text-xs text-error-600'>
          {empty ? '반 제목을 입력해 주세요.' : ''}
        </p>
      </form>
    );
  }

  // 반 · 역할은 고친 값을 모았다가 「저장」으로 한 번에 반영한다 — 일정 표와 같다.
  // 한 칸 바꿀 때마다 저장하면 여러 명을 옮기는 도중의 어중간한 편성이 그대로 남는다.
  const [draftClass, setDraftClass] = useState<Record<string, string>>({});
  const [draftNav, setDraftNav] = useState<Record<string, boolean>>({});
  const classOf = (id: string) => draftClass[id] ?? assign[id];
  const isNavigator = (id: string) => draftNav[id] ?? navigators.includes(id);
  const changedIds = new Set([...Object.keys(draftClass), ...Object.keys(draftNav)]);
  const changed = changedIds.size;
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    onDirtyChange?.(changed > 0);
  }, [changed, onDirtyChange]);

  /** 저장한 값과 같아지면 고친 것에서 뺀다 — 되돌렸는데 「변경 1건」이 남지 않게. */
  function pickClass(id: string, classId: string) {
    setSaved(false);
    setDraftClass((d) => withDraft(d, id, classId === assign[id] ? undefined : classId));
  }
  function pickRole(id: string, nav: boolean) {
    setSaved(false);
    setDraftNav((d) => withDraft(d, id, nav === navigators.includes(id) ? undefined : nav));
  }
  // 여러 명을 골라 반 · 역할을 한 번에 — 고르는 즉시 저장 전 변경에 얹히고, 「저장」으로 반영한다(출석부 일괄 변경과 같은 방식).
  // 「적용」 버튼은 두지 않는다 — 드롭다운에서 고른 것이 곧 적용이다 (2026-10-17 기획 결정)
  const [checkedIds, setCheckedIds] = useState<Set<string>>(() => new Set());
  const [announce, setAnnounce] = useState('');
  // 보이는 줄만 센다 — 필터로 숨긴 사람까지 바뀌면 안 된다
  const selected = shown.filter((c) => checkedIds.has(c.id));
  const allPicked = shown.length > 0 && selected.length === shown.length;
  function pick(id: string) {
    setCheckedIds((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function pickAll() {
    setCheckedIds(allPicked ? new Set() : new Set(shown.map((c) => c.id)));
  }
  /** 고른 사람 모두의 반 또는 역할을 바꾼다. 선택은 그대로 둔다 — 반과 역할을 이어서 바꿀 수 있게. */
  function applyBulk(change: { classId?: string; role?: 'crew' | 'navigator' }) {
    if (selected.length === 0) return;
    for (const c of selected) {
      if (change.classId) pickClass(c.id, change.classId);
      if (change.role) pickRole(c.id, change.role === 'navigator');
    }
    setAnnounce(`${selected.length}명에 적용했습니다. 저장을 눌러야 반영됩니다.`);
  }

  function discard() {
    setDraftClass({});
    setDraftNav({});
  }
  function save() {
    // TODO(api): PATCH …/participants/{id}/group · PATCH …/participants/{id}/role — 바뀐 줄만 보낸다
    for (const [id, classId] of Object.entries(draftClass)) onAssign(id, classId);
    for (const [id, nav] of Object.entries(draftNav)) if (nav !== navigators.includes(id)) onToggleNavigator(id);
    discard();
    setSaved(true);
  }

  return (
    <div className='flex flex-col gap-6'>
      <section data-anno='class:1'>
        <h2 className='flex items-baseline gap-2 text-[15px] font-bold'>
          반<span className='tnum text-[13px] font-medium text-fg-muted'>{classes.length}</span>
          <span className='ml-auto'>
            <Button
              size='sm'
              variant='secondary'
              leadingIcon={<Plus size={15} />}
              disabled={adding}
              onClick={() => setRenaming({ id: NEW_CLASS, title: '', touched: false })}
            >
              반 추가
            </Button>
          </span>
        </h2>
        {classes.length === 0 && !adding ? (
          <p className='mt-2 rounded-card border border-dashed border-border px-4 py-6 text-center text-sm text-fg-muted'>
            아직 반이 없습니다. 「반 추가」로 반을 만들고 크루를 나눠 주세요.
          </p>
        ) : (
          <ul data-anno='class:1-1' className='mt-2 flex flex-col gap-2'>
            {classes.map((cls) => (
              <li key={cls.id} className='card px-4 py-3'>
                {renaming?.id === cls.id ? (
                  editor(cls)
                ) : (
                  <div className='flex flex-wrap items-baseline gap-x-3 gap-y-1'>
                    <span className='text-sm font-bold'>{classLabel(cls)}</span>
                    <span className='tnum ml-auto text-sm text-fg-secondary'>
                      {active.filter((c) => assign[c.id] === cls.id).length}명
                    </span>
                    <Button
                      size='sm'
                      variant='secondary'
                      data-anno='class:1-2'
                      aria-label={`${classLabel(cls)} 수정`}
                      onClick={() => setRenaming({ id: cls.id, title: cls.title, touched: false })}
                    >
                      수정
                    </Button>
                    {/* 사람이 든 반은 지우지 않는다 — 그 반의 출석 기록까지 사라진다 */}
                    <Button
                      size='sm'
                      variant='danger'
                      data-anno='class:1-3'
                      aria-label={`${classLabel(cls)} 삭제`}
                      disabled={active.some((c) => assign[c.id] === cls.id)}
                      title={
                        active.some((c) => assign[c.id] === cls.id) ? '크루가 있는 반은 지울 수 없습니다' : undefined
                      }
                      onClick={() => onRemoveClass(cls.id)}
                    >
                      삭제
                    </Button>
                  </div>
                )}
              </li>
            ))}
            {/* 「반 추가」 — 목록 맨 아래 새 카드가 입력칸으로 열린다. 저장해야 반이 생긴다 */}
            {adding && <li className='card px-4 py-3'>{editor(undefined)}</li>}
          </ul>
        )}
      </section>
      <section data-anno='attendee:3'>
        <div className='flex flex-wrap items-center gap-x-3 gap-y-2'>
          <h2 data-anno='attendee:3-1' className='flex items-baseline gap-2 text-[15px] font-bold'>
            참여 크루
            {/* 반 제목 옆 개수와 같은 모양 — 숫자만. 필터와 상관없이 전체 인원 */}
            <span className='tnum text-[13px] font-medium text-fg-muted'>{active.length}</span>
          </h2>
        </div>
        {/* 필터는 제목 아래 줄, 왼쪽부터 반 · 지역 드롭다운 */}
        <div data-anno='attendee:3-3' className='mt-2 flex flex-wrap items-center gap-2'>
          {/* 반이 하나면 거를 것이 없다 */}
          {classes.length > 1 && (
            <FilterSelect
              label='반'
              value={classFilter}
              onChange={setClassFilter}
              options={classes.map((c) => ({ value: c.id, label: classLabel(c) }))}
            />
          )}
          <FilterSelect
            label='지역'
            value={regionFilter}
            onChange={(v) => setRegionFilter(v as typeof regionFilter)}
            options={MEMBER_REGIONS.map((r) => ({ value: r.key, label: r.label.ko }))}
          />
        </div>
        <div className='mt-2'>
          <TableCard
            top={
              // 표 맨 위 작업 바 — 한 줄. 왼쪽은 고른 크루에 하는 일, 오른쪽은 저장 (POL-0008). 일정 · 출석 표와 같은 자리 · 같은 모양
              active.length > 0 ? (
                <TableActionBar
                  className='top-[var(--table-action-bar-top,4rem)] bottom-auto border-b border-border bg-surface-raised px-4'
                  data-anno='attendee:3-7'
                  selection={
                    <>
                      <SelectionCount count={selected.length} unit='명' />
                      {classes.length > 1 && (
                        <select
                          aria-label='바꿀 반'
                          className={SELECT_CLASS}
                          value=''
                          disabled={selected.length === 0}
                          onChange={(e) => e.target.value && applyBulk({ classId: e.target.value })}
                        >
                          <option value=''>반 변경</option>
                          {classes.map((c) => (
                            <option key={c.id} value={c.id}>
                              {classLabel(c)}
                            </option>
                          ))}
                        </select>
                      )}
                      <select
                        aria-label='바꿀 역할'
                        className={SELECT_CLASS}
                        value=''
                        disabled={selected.length === 0}
                        onChange={(e) => e.target.value && applyBulk({ role: e.target.value as 'crew' | 'navigator' })}
                      >
                        <option value=''>역할 변경</option>
                        <option value='crew'>크루</option>
                        <option value='navigator'>네비게이터</option>
                      </select>
                      {selected.length > 0 && (
                        <Button size='sm' variant='ghost' onClick={() => setCheckedIds(new Set())}>
                          선택 해제
                        </Button>
                      )}
                    </>
                  }
                  save={
                    <span data-anno='attendee:3-5' className='flex items-center gap-2'>
                      <span role='status' className='text-xs text-fg-muted'>
                        {saved && changed === 0 ? '저장했습니다.' : ''}
                      </span>
                      {changed > 0 && (
                        <Button variant='ghost' size='sm' onClick={discard}>
                          변경 취소
                        </Button>
                      )}
                      <Button size='sm' onClick={save} disabled={changed === 0}>
                        저장
                      </Button>
                    </span>
                  }
                />
              ) : undefined
            }
          >
            <thead>
              <tr>
                <th data-anno='attendee:3-6' className='w-8'>
                  <SelectAll
                    label='보이는 크루 전체 선택'
                    checked={allPicked}
                    partial={selected.length > 0 && !allPicked}
                    onChange={pickAll}
                  />
                </th>
                <th className='whitespace-nowrap'>닉네임</th>
                <th className='whitespace-nowrap'>디스코드 닉네임</th>
                <th>이메일</th>
                <th className='whitespace-nowrap'>지역</th>
                <th className='whitespace-nowrap'>반</th>
                <th className='whitespace-nowrap'>역할</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((c) => (
                // 고친 줄은 옅게 칠한다 — 저장 전인 것이 한눈에 보인다
                <tr key={c.id} className={changedIds.has(c.id) ? 'bg-brand-subtle/40' : undefined}>
                  <td className='w-8'>
                    <input
                      type='checkbox'
                      aria-label={`${c.name} 선택`}
                      className={CHECKBOX}
                      checked={checkedIds.has(c.id)}
                      onChange={() => pick(c.id)}
                    />
                  </td>
                  <td className='whitespace-nowrap font-semibold'>{c.name}</td>
                  {/* 디스코드에서 이 사람을 찾을 때 쓰는 이름 — 신청할 때 받은 서버 별명 */}
                  <td data-anno='attendee:3-4' className='whitespace-nowrap text-fg-secondary'>
                    {c.discordNickname || '—'}
                  </td>
                  <td className='whitespace-nowrap text-fg-secondary'>{c.email}</td>
                  <td className='whitespace-nowrap text-fg-secondary'>{regionLabel(c.region)}</td>
                  <td data-anno='class:2' className='whitespace-nowrap'>
                    {/* 반 이동 = 이 값 변경 */}
                    <ClassPick classes={classes} value={classOf(c.id)} onChange={(id) => pickClass(c.id, id)} />
                  </td>
                  <td data-anno='attendee:3-2' className='whitespace-nowrap'>
                    <RolePick name={c.name} navigator={isNavigator(c.id)} onChange={(nav) => pickRole(c.id, nav)} />
                  </td>
                </tr>
              ))}
              {shown.length === 0 && (
                <tr>
                  <td colSpan={7} className='text-center text-fg-muted'>
                    {active.length === 0 ? '아직 크루가 없습니다.' : '조건에 맞는 크루가 없습니다.'}
                  </td>
                </tr>
              )}
            </tbody>
          </TableCard>
        </div>
        <p className='sr-only' aria-live='polite'>
          {announce}
        </p>
      </section>
    </div>
  );
}

/**
 * 이 스터디에서의 역할 — 크루(기본) · 네비게이터. 캡틴이 정한다.
 *
 * 옆 「반」 칸과 같은 드롭다운이다. 누를 때마다 바뀌는 배지는 바꿀 수 있다는 것이 안 보이고,
 * 잘못 눌러도 권한이 바로 넘어간다.
 *
 * **역할은 스터디마다 따로 선다.** 네비게이터는 이 스터디에 한해 정보 수정·공지·출석 현황 수정을
 * 할 수 있고, 다른 스터디에서는 크루일 뿐이다.
 */
function RolePick({
  name,
  navigator,
  onChange,
}: {
  name: string;
  navigator: boolean;
  onChange: (navigator: boolean) => void;
}) {
  return (
    <select
      aria-label={`${name} 역할`}
      value={navigator ? 'navigator' : 'crew'}
      onChange={(ev) => onChange(ev.target.value === 'navigator')}
      // 네비게이터는 몇 안 된다 — 긴 명단에서 바로 눈에 띄게 테두리를 칠한다
      className={`h-8 rounded-control border bg-bg px-2 text-sm outline-none focus:border-brand focus:shadow-[var(--ring)] ${
        navigator ? 'border-brand font-semibold text-fg' : 'border-border-strong text-neutral-900'
      }`}
    >
      <option value='crew'>크루</option>
      <option value='navigator'>네비게이터</option>
    </select>
  );
}

/** 고친 값 한 칸을 넣거나(값) 뺀다(undefined). */
function withDraft<T>(drafts: Record<string, T>, id: string, value: T | undefined): Record<string, T> {
  const next = { ...drafts };
  if (value === undefined) delete next[id];
  else next[id] = value;
  return next;
}

/** 「반 추가」로 연 새 카드의 자리 표시 id — 저장하면 진짜 id 를 받는다. */
const NEW_CLASS = '__new__';

/** 명단 필터 드롭다운(반 · 지역). 값이 있으면 테두리로 드러낸다 — 걸러진 채로 명단을 오독하지 않게. */
function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`h-9 shrink-0 rounded-control border bg-surface px-3 text-sm outline-none focus:border-brand ${
        value === 'all' ? 'border-border-strong text-fg-secondary' : 'border-brand font-semibold text-fg'
      }`}
    >
      <option value='all'>{value === 'all' ? label : `${label} 전체`}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** 반 고르기. 반이 하나면 고를 것이 없으므로 이름만 적는다. */
function ClassPick({
  classes,
  value,
  onChange,
}: {
  classes: StudyClass[];
  value: string | undefined;
  onChange: (id: string) => void;
}) {
  if (classes.length === 0) return <span className='text-xs text-fg-muted'>반 없음</span>;
  if (classes.length === 1) return <span className='text-sm text-fg-secondary'>{classLabel(classes[0]!)}</span>;
  return (
    <select
      aria-label='반'
      value={value ?? classes[0]!.id}
      onChange={(ev) => onChange(ev.target.value)}
      className='h-8 rounded-control border border-border-strong bg-bg px-2 text-sm text-neutral-900 outline-none focus:border-brand focus:shadow-[var(--ring)]'
    >
      {classes.map((c) => (
        <option key={c.id} value={c.id}>
          {classLabel(c)}
        </option>
      ))}
    </select>
  );
}
