'use client';

import { useState } from 'react';

import { ClassDialog } from '@console/components/ClassDialog';
import { TableCard } from '@console/components/ui';
import { classLabel, classPeriod, classTime, hasSchedule, type StudyClass } from '@console/lib/classes';
import { MEMBER_REGIONS, type Crew } from '@studyclub/mock';
import { Button } from '@studyclub/ui';
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
  capacity,
  classes,
  assign,
  onSaveClass,
  onRemoveClass,
  onAssign,
  navigators,
  onToggleNavigator,
}: {
  crew: Crew[];
  capacity: number;
  classes: StudyClass[];
  assign: Record<string, string>;
  /** 이 스터디를 맡은 크루. 네비게이터 권한은 여기 있는 사람에게 이 스터디 안에서만 선다. */
  navigators: string[];
  onToggleNavigator: (crewId: string) => void;
  /** 반을 만들거나 이름을 바꾼다. */
  onSaveClass: (cls: StudyClass) => void;
  onRemoveClass: (classId: string) => void;
  onAssign: (crewId: string, classId: string) => void;
}) {
  const active = crew;
  const [dialogOpen, setDialogOpen] = useState(false);
  // 명단 필터 — 반을 나눌 때 지역별로, 반을 확인할 때 반별로 본다. 둘 다 화면에서만 거른다
  const [regionFilter, setRegionFilter] = useState<'all' | Crew['region']>('all');
  const [picked, setClassFilter] = useState<string>('all');
  // 고른 반이 지워졌으면 전체로 본다
  const classFilter = classes.some((c) => c.id === picked) ? picked : 'all';
  const shown = active.filter(
    (c) =>
      (regionFilter === 'all' || c.region === regionFilter) && (classFilter === 'all' || assign[c.id] === classFilter),
  );
  const filtered = regionFilter !== 'all' || classFilter !== 'all';
  const [editing, setEditing] = useState<StudyClass | undefined>();

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
              onClick={() => {
                setEditing(undefined);
                setDialogOpen(true);
              }}
            >
              반 추가
            </Button>
          </span>
        </h2>
        {classes.length === 0 ? (
          <p className='mt-2 rounded-card border border-dashed border-border px-4 py-6 text-center text-sm text-fg-muted'>
            아직 반이 없습니다. 「반 추가」로 반을 만들고 크루를 나눠 주세요.
          </p>
        ) : (
          <ul data-anno='class:1-1' className='mt-2 flex flex-col gap-2'>
            {classes.map((cls) => (
              <li key={cls.id} className='card flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3'>
                <span className='text-sm font-bold'>{classLabel(cls)}</span>
                {/* 일정은 일정 탭에서 정한다 — 여기서는 정해졌는지만 보인다 */}
                {hasSchedule(cls) ? (
                  <span className='tnum text-sm text-fg-muted'>
                    {classTime(cls.rule)} · {classPeriod(cls)}
                  </span>
                ) : (
                  <span className='text-sm text-fg-muted'>일정 미정</span>
                )}
                <span className='tnum ml-auto text-sm text-fg-secondary'>
                  {active.filter((c) => assign[c.id] === cls.id).length}명
                </span>
                <Button
                  size='sm'
                  variant='ghost'
                  data-anno='class:1-2'
                  aria-label={`${classLabel(cls)} 수정`}
                  onClick={() => {
                    setEditing(cls);
                    setDialogOpen(true);
                  }}
                >
                  수정
                </Button>
                {/* 사람이 든 반은 지우지 않는다 — 그 반의 출석 기록까지 사라진다 */}
                <Button
                  size='sm'
                  variant='ghost'
                  data-anno='class:1-3'
                  aria-label={`${classLabel(cls)} 삭제`}
                  disabled={active.some((c) => assign[c.id] === cls.id)}
                  title={active.some((c) => assign[c.id] === cls.id) ? '크루가 있는 반은 지울 수 없습니다' : undefined}
                  onClick={() => onRemoveClass(cls.id)}
                >
                  삭제
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section data-anno='attendee:3'>
        {/* 필터는 제목 줄 오른쪽에 둔다 — 반 목록의 「반 추가」와 같은 자리 */}
        <div className='flex flex-wrap items-center gap-x-3 gap-y-2'>
          <h2 data-anno='attendee:3-1' className='flex items-baseline gap-2 text-[15px] font-bold'>
            참여 크루
            <span className='tnum text-[13px] font-medium text-fg-muted'>
              {active.length}/{capacity}
            </span>
          </h2>
          <div data-anno='attendee:3-3' className='ml-auto flex flex-wrap items-center gap-2'>
            <FilterSelect
              label='지역'
              value={regionFilter}
              onChange={(v) => setRegionFilter(v as typeof regionFilter)}
              options={MEMBER_REGIONS.map((r) => ({ value: r.key, label: r.label.ko }))}
            />
            {/* 반이 하나면 거를 것이 없다 */}
            {classes.length > 1 && (
              <FilterSelect
                label='반'
                value={classFilter}
                onChange={setClassFilter}
                options={classes.map((c) => ({ value: c.id, label: classLabel(c) }))}
              />
            )}
            {filtered && (
              <>
                <span className='tnum text-sm text-fg-muted'>{shown.length}명</span>
                <Button
                  size='sm'
                  variant='ghost'
                  onClick={() => {
                    setRegionFilter('all');
                    setClassFilter('all');
                  }}
                >
                  필터 해제
                </Button>
              </>
            )}
          </div>
        </div>
        <div className='mt-2'>
          <TableCard>
            <thead>
              <tr>
                <th className='whitespace-nowrap'>이름</th>
                <th className='whitespace-nowrap'>디스코드 닉네임</th>
                <th>이메일</th>
                <th className='whitespace-nowrap'>지역</th>
                <th className='whitespace-nowrap'>반</th>
                <th className='whitespace-nowrap'>역할</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((c) => (
                <tr key={c.id}>
                  <td className='whitespace-nowrap font-semibold'>{c.name}</td>
                  {/* 디스코드에서 이 사람을 찾을 때 쓰는 이름 — 신청할 때 받은 서버 별명 */}
                  <td data-anno='attendee:3-4' className='whitespace-nowrap text-fg-secondary'>
                    {c.discordNickname || '—'}
                  </td>
                  <td className='whitespace-nowrap text-fg-secondary'>{c.email}</td>
                  <td className='whitespace-nowrap text-fg-secondary'>{regionLabel(c.region)}</td>
                  <td data-anno='class:2' className='whitespace-nowrap'>
                    {/* 반 이동 = 이 값 변경 */}
                    <ClassPick classes={classes} value={assign[c.id]} onChange={(id) => onAssign(c.id, id)} />
                  </td>
                  <td data-anno='attendee:3-2' className='whitespace-nowrap'>
                    <RolePick
                      name={c.name}
                      navigator={navigators.includes(c.id)}
                      onChange={(nav) => nav !== navigators.includes(c.id) && onToggleNavigator(c.id)}
                    />
                  </td>
                </tr>
              ))}
              {shown.length === 0 && (
                <tr>
                  <td colSpan={6} className='text-center text-fg-muted'>
                    {active.length === 0 ? '아직 크루가 없습니다.' : '조건에 맞는 크루가 없습니다.'}
                  </td>
                </tr>
              )}
            </tbody>
          </TableCard>
        </div>
      </section>

      <ClassDialog
        open={dialogOpen}
        edit={editing}
        onClose={() => {
          setDialogOpen(false);
          setEditing(undefined);
        }}
        onSave={(cls) => {
          onSaveClass(cls);
          setDialogOpen(false);
          setEditing(undefined);
        }}
      />
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

/** 명단 필터. 값이 있으면 테두리로 드러낸다 — 걸러진 채로 명단을 오독하지 않게. */
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
