'use client';

import { useState } from 'react';

import { ClassDialog } from '@console/components/ClassDialog';
import { TableCard } from '@console/components/ui';
import {
  AVAIL_DAYS,
  AVAIL_SLOTS,
  classLabel,
  classPeriod,
  crewOnCell,
  tallyAvailability,
  type StudyClass,
} from '@console/lib/classes';
import { MEMBER_REGIONS, type Crew } from '@studyclub/mock';
import { Badge, Button } from '@studyclub/ui';
import { Plus } from 'lucide-react';

/**
 * 크루 탭 — 가능한 시간 집계, 반, 참여 명단.
 *
 * **승인이라는 단계가 없다.** 신청한 사람은 곧 크루다. 운영자가 한 명씩 통과시키는 절차를 두면
 * 처리하지 않은 사람이 대기열에 쌓이고, 그 사이 그 사람은 자기가 들어왔는지 알 수 없다.
 *
 * 여기서 하는 일은 셋이다 — **반을 만들고, 크루를 반에 넣고, 이 스터디를 맡을 사람을 정한다.**
 */

function regionLabel(key: Crew['region']) {
  return MEMBER_REGIONS.find((r) => r.key === key)?.label.ko ?? key;
}

/** 완주율 — 이력이 없으면 숫자를 만들지 않고 "첫 참여"로 말한다. */
function Completion({ crew }: { crew: Crew }) {
  if (crew.completionRate === undefined) {
    return <span className='text-fg-muted'>첫 참여</span>;
  }
  const tone =
    crew.completionRate >= 80 ? 'text-success-700' : crew.completionRate >= 60 ? 'text-fg' : 'text-warning-700';
  return (
    <span className='tnum'>
      <span className={`font-bold ${tone}`}>{crew.completionRate}%</span>
      <span className='ml-1 text-xs text-fg-muted'>({crew.pastStudies}회)</span>
    </span>
  );
}

export function CrewTab({
  crew,
  capacity,
  classes,
  assign,
  onAddClass,
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
  onAddClass: (cls: StudyClass) => void;
  onRemoveClass: (classId: string) => void;
  onAssign: (crewId: string, classId: string) => void;
}) {
  const active = crew.filter((c) => c.status === 'active');
  const [newFrom, setNewFrom] = useState<string | null>(null);
  const [editing, setEditing] = useState<StudyClass | undefined>();
  const tally = tallyAvailability(active);
  const most = Math.max(1, ...Object.values(tally));

  return (
    <div className='flex flex-col gap-6'>
      <section data-anno='class:1'>
        <h2 className='flex items-baseline gap-2 text-[15px] font-bold'>
          가능한 시간
          <span className='text-[13px] font-medium text-fg-muted'>크루 {active.length}명의 응답</span>
        </h2>
        {/*
          반은 여기서 태어난다. 모집 전에는 몇 시로 몇 개를 열지 알 수 없고, 신청자가 낸 시간을
          겹쳐 봐야 정해진다. 그래서 집계를 먼저 보여주고, 그 칸에서 바로 반을 만들게 한다.
        */}
        <div data-anno='class:1-1' className='card mt-2 overflow-x-auto px-4 py-3'>
          <table className='w-full table-fixed border-separate border-spacing-1'>
            <thead>
              <tr>
                <th className='w-10 p-0' />
                {AVAIL_DAYS.map((d) => (
                  <th key={d.key} className='pb-1 text-center text-xs font-semibold text-fg-secondary'>
                    {d.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {AVAIL_SLOTS.map((sl) => (
                <tr key={sl.key}>
                  <th scope='row' className='pr-1.5 text-right text-xs font-medium text-fg-secondary'>
                    {sl.label}
                  </th>
                  {AVAIL_DAYS.map((d) => {
                    const cell = `${d.key}-${sl.key}`;
                    const n = tally[cell] ?? 0;
                    return (
                      <td key={cell} className='p-0'>
                        <button
                          type='button'
                          disabled={n === 0}
                          onClick={() => setNewFrom(cell)}
                          title={
                            n === 0 ? '가능한 사람이 없습니다' : `${d.label} ${sl.label} — ${n}명. 눌러서 반 만들기`
                          }
                          className='tnum h-9 w-full rounded-sm border border-border text-xs font-bold text-fg transition-colors disabled:cursor-not-allowed disabled:text-fg-placeholder'
                          style={{
                            background:
                              n === 0
                                ? 'var(--color-surface)'
                                : `color-mix(in oklab, var(--color-brand) ${Math.round((n / most) * 60)}%, var(--color-surface))`,
                          }}
                        >
                          {n === 0 ? '' : n}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section data-anno='class:2'>
        <h2 className='flex items-baseline gap-2 text-[15px] font-bold'>
          반<span className='tnum text-[13px] font-medium text-fg-muted'>{classes.length}</span>
          <span className='ml-auto'>
            <Button
              size='sm'
              variant='secondary'
              leadingIcon={<Plus size={15} />}
              onClick={() => {
                setEditing(undefined);
                setNewFrom('');
              }}
            >
              반 추가
            </Button>
          </span>
        </h2>
        {classes.length === 0 ? (
          <p className='mt-2 rounded-card border border-dashed border-border px-4 py-6 text-center text-sm text-fg-muted'>
            아직 반이 없습니다. 위 표에서 시간을 골라 만드세요.
          </p>
        ) : (
          <ul data-anno='class:2-1' className='mt-2 flex flex-col gap-2'>
            {classes.map((cls) => (
              <li key={cls.id} className='card flex items-baseline gap-3 px-4 py-3'>
                <span className='text-sm font-bold'>{classLabel(cls)}</span>
                <span className='text-sm text-fg-muted'>{classPeriod(cls)}</span>
                <span className='tnum ml-auto text-sm text-fg-secondary'>
                  {active.filter((c) => assign[c.id] === cls.id).length}명
                </span>
                {/* 일정은 나중에 바뀐다 — 크루가 더 들어오거나 시간이 안 맞아서다 */}
                <Button
                  size='sm'
                  variant='ghost'
                  data-anno='class:2-2'
                  onClick={() => {
                    setEditing(cls);
                    setNewFrom('');
                  }}
                >
                  일정 수정
                </Button>
                {/* 사람이 든 반은 지우지 않는다 — 그 반의 출석 기록까지 사라진다 */}
                <Button
                  size='sm'
                  variant='ghost'
                  data-anno='class:2-3'
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
        <h2 data-anno='attendee:3-1' className='flex items-baseline gap-2 text-[15px] font-bold'>
          참여 크루
          <span className='tnum text-[13px] font-medium text-fg-muted'>
            {active.length}/{capacity}
          </span>
        </h2>
        <div className='mt-2'>
          <TableCard>
            <thead>
              <tr>
                <th className='whitespace-nowrap'>이름</th>
                <th>이메일</th>
                <th className='whitespace-nowrap'>지역</th>
                <th className='whitespace-nowrap'>완주율</th>
                <th className='whitespace-nowrap'>반</th>
                <th className='whitespace-nowrap'>담당</th>
              </tr>
            </thead>
            <tbody>
              {active.map((c) => (
                <tr key={c.id}>
                  <td className='whitespace-nowrap font-semibold'>{c.name}</td>
                  <td className='whitespace-nowrap text-fg-secondary'>{c.email}</td>
                  <td className='whitespace-nowrap text-fg-secondary'>{regionLabel(c.region)}</td>
                  <td className='whitespace-nowrap'>
                    <Completion crew={c} />
                  </td>
                  <td data-anno='class:3' className='whitespace-nowrap'>
                    {/* 반 이동 = 이 값 변경 */}
                    <ClassPick classes={classes} value={assign[c.id]} onChange={(id) => onAssign(c.id, id)} />
                  </td>
                  <td data-anno='attendee:3-2' className='whitespace-nowrap'>
                    <NavigatorPick on={navigators.includes(c.id)} onToggle={() => onToggleNavigator(c.id)} />
                  </td>
                </tr>
              ))}
              {active.length === 0 && (
                <tr>
                  <td colSpan={6} className='text-center text-fg-muted'>
                    아직 크루가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </TableCard>
        </div>
      </section>

      <ClassDialog
        open={newFrom !== null}
        cell={newFrom || undefined}
        candidates={newFrom ? crewOnCell(active, newFrom) : []}
        edit={editing}
        onClose={() => {
          setNewFrom(null);
          setEditing(undefined);
        }}
        onCreate={(cls) => {
          onAddClass(cls);
          setNewFrom(null);
          setEditing(undefined);
        }}
      />
    </div>
  );
}

/**
 * 이 스터디의 네비게이터 — 캡틴이 크루 중에서 정한다.
 *
 * **역할은 스터디마다 따로 선다.** 여기서 지정된 사람은 이 스터디에 한해 정보 수정·알럿·출석
 * 현황 수정을 할 수 있고, 다른 스터디에서는 크루일 뿐이다.
 */
function NavigatorPick({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  if (on) {
    return (
      <span className='inline-flex items-center gap-1.5'>
        <Badge tone='navigator' className='px-2 py-0.5 text-xs font-semibold'>
          네비게이터
        </Badge>
        <Button size='sm' variant='ghost' onClick={onToggle}>
          해제
        </Button>
      </span>
    );
  }
  return (
    <Button size='sm' variant='ghost' onClick={onToggle}>
      네비게이터로
    </Button>
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
