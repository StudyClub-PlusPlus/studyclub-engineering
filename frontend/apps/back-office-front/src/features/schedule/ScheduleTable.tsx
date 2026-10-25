'use client';

import { useEffect, useRef, useState } from 'react';

import { Button, Checkbox, Input, Modal, Segmented, Select, SelectionCount, TableActionBar, cx } from '@studyclub/ui';
import { Plus } from 'lucide-react';

import { AddMeetingDialog } from './AddMeetingDialog';
import { KickoffDialog } from './KickoffDialog';
import {
  isKickoff,
  meetingLabel,
  TITLE_MAX,
  validateEdit,
  type DraftErrors,
  type Meeting,
  type Person,
  type ScheduleGroup,
} from './meetings';
import type { MeetingPatch } from './store';
import { dateWithDow, dayLabel, DISPLAY_ZONES, wallParts, zonedInstant, zoneLabel } from './time';

/**
 * 일정 표 — 고른 반의 회차. 사용자 사이트 스터디 일정 표와 같은 표다 (navigator-register-sessions PRD §3 ~ §10).
 *
 * 예정 회차의 칸(일자 · 시각 · 제목 · 발표자)을 바로 고치고, 여러 줄을 「저장」으로 한 번에 보낸다.
 * 지우는 길은 체크박스 하나다. 킥오프와 시작한 회차(흐린 줄)는 고치거나 지울 수 없다 — 출석이 걸려 있다.
 * 킥오프 일자는 표가 아니라 제목 줄의 「킥오프 정하기 · 수정」으로만 정한다 (spec 결정 11).
 * 백오피스는 옆 메뉴 때문에 본문이 좁아 제목 · 발표자 열을 좁혀 가로 스크롤 없이 둔다 (share 10-18 D12).
 */
export function ScheduleTable({
  group,
  meetings,
  people,
  pickable = people,
  onSave,
  onAdd,
  onSetKickoff,
  onDelete,
  onDirtyChange,
  startAdding = false,
  onStartedAdding,
}: {
  group: ScheduleGroup;
  meetings: Meeting[];
  /** 발표자 칸에 이름을 적을 사람 — 참여를 중단한 사람도 지난 회차의 발표 기록에 남는다. */
  people: Person[];
  /** 발표자로 새로 고를 수 있는 사람. 없으면 `people`. 참여를 중단한 사람은 빠진다. */
  pickable?: Person[];
  /** 저장하지 못한 회차 ID 로 끝난다 — 그 줄의 고침은 남긴다. */
  onSave: (patches: Record<string, MeetingPatch>) => Promise<string[]>;
  onAdd: (input: { dates: string[]; time: string; title: string }) => void;
  onSetKickoff: (input: { date: string; time: string }) => void;
  onDelete: (ids: string[]) => void;
  onDirtyChange: (dirty: boolean) => void;
  /** 열자마자 회차 추가 창을 띄운다. */
  startAdding?: boolean;
  onStartedAdding?: () => void;
}) {
  const tz = group.time.tz;
  const [adding, setAdding] = useState(startAdding);
  const [settingKickoff, setSettingKickoff] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(() => new Set());
  const [bulkConfirm, setBulkConfirm] = useState(false);
  /** 화면 문구 없이 스크린리더에만 결과를 알린다. */
  const [announce, setAnnounce] = useState('');
  /** 줄을 처음 고칠 때의 저장값. 저장할 때 발표자 칸이 「내가 바꾼 것」인지 이것과 견준다. */
  const bases = useRef<Record<string, RowDraft>>({});
  const [drafts, setDrafts] = useState<Record<string, RowDraft>>({});
  /** 표의 일자·시각을 어느 시간대로 보일지. 처음엔 반 시간대. */
  const [zone, setZone] = useState<string>(tz);

  const now = Date.now();
  const regular = meetings.filter((m) => !isKickoff(m));
  const hasKickoff = meetings.some(isKickoff);
  // 서버는 디스코드에서 일찍 시작한 회차도 시작으로 본다 — 시각이 안 됐어도 고치거나 지우지 않는다
  const started = (m: Meeting) => m.started === true || new Date(m.scheduledAt).getTime() <= now;
  const upcomingCount = regular.filter((m) => !started(m)).length;

  const saved = (m: Meeting): RowDraft => ({
    date: m.date,
    time: m.time,
    title: m.title,
    presenter1: m.presenter1,
    presenter2: m.presenter2,
  });
  const valueOf = (m: Meeting) => drafts[m.id] ?? saved(m);
  const changedIds = meetings.filter((m) => drafts[m.id] && !sameRow(drafts[m.id], saved(m))).map((m) => m.id);
  const dirty = changedIds.length > 0;

  // 고친 줄을 반영한 회차들로 같은 날 겹침을 본다 — 두 줄을 같은 날로 옮기는 것도 막아야 한다.
  const projected = meetings.map((m) => (drafts[m.id] ? { ...m, date: drafts[m.id].date } : m));
  const errorsOf = (m: Meeting): RowErrors => {
    if (!changedIds.includes(m.id)) return {};
    const v = valueOf(m);
    const found: RowErrors = validateEdit(v, m.id, projected, tz);
    if (v.presenter1 && v.presenter1 === v.presenter2) found.presenter2 = '발표자1과 다른 사람을 골라 주세요.';
    return found;
  };
  const errorCount = changedIds.reduce((n, id) => {
    const m = meetings.find((x) => x.id === id);
    return n + (m ? Object.keys(errorsOf(m)).length : 0);
  }, 0);

  useEffect(() => {
    if (startAdding) onStartedAdding?.();
  }, [startAdding, onStartedAdding]);

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

  function change(m: Meeting, patch: Partial<RowDraft>) {
    if (!bases.current[m.id]) bases.current[m.id] = saved(m);
    setAnnounce('');
    setDrafts((d) => ({ ...d, [m.id]: { ...(d[m.id] ?? saved(m)), ...patch } }));
  }

  function clearDrafts() {
    bases.current = {};
    setDrafts({});
  }

  /** 고친 줄은 반 시간대 벽시계로 들고 있다가, 칸에는 지금 고른 시간대로 보인다. */
  function shownWall(v: RowDraft): { date: string; time: string } {
    if (!v.date || !v.time || zone === tz) return { date: v.date, time: v.time };
    return wallParts(zonedInstant(v.date, v.time, tz), zone);
  }

  function changeWall(m: Meeting, patch: { date?: string; time?: string }) {
    const next = { ...shownWall(valueOf(m)), ...patch };
    // 칸을 비우면 그대로 비운다 — 「일자를 정해 주세요」로 막힌다.
    if (!next.date || !next.time || zone === tz) {
      change(m, next);
      return;
    }
    change(m, wallParts(zonedInstant(next.date, next.time, zone), tz));
  }

  async function saveAll() {
    if (!dirty || errorCount > 0) return;
    const patches: Record<string, MeetingPatch> = {};
    for (const id of changedIds) {
      const v = drafts[id];
      const before = bases.current[id];
      // 발표자 칸은 고치기 시작할 때와 달라진 것만 보낸다 — 그 사이 크루가 신청한 칸을 옛 값(빈칸)으로 덮지 않는다.
      patches[id] = {
        date: v.date,
        time: v.time,
        title: v.title,
        ...(v.presenter1 !== before?.presenter1 && { presenter1: v.presenter1 || null }),
        ...(v.presenter2 !== before?.presenter2 && { presenter2: v.presenter2 || null }),
      };
    }
    const failed = new Set(await onSave(patches));
    // 저장하지 못한 줄은 고침을 남긴다 — 고쳐서 다시 저장하거나 되돌릴 수 있게. 저장한 줄만 비운다
    const done = changedIds.filter((id) => !failed.has(id));
    for (const id of done) delete bases.current[id];
    setDrafts((d) => Object.fromEntries(Object.entries(d).filter(([id]) => failed.has(id))));
    setAnnounce(
      failed.size === 0
        ? `회차 ${done.length}개를 저장했습니다.`
        : `회차 ${done.length}개를 저장했고, ${failed.size}개는 저장하지 못해 고친 값을 남겨 두었습니다.`,
    );
  }

  function remove(targets: Meeting[]) {
    const ids = new Set(targets.map((t) => t.id));
    for (const id of ids) delete bases.current[id];
    onDelete([...ids]);
    setDrafts((d) => Object.fromEntries(Object.entries(d).filter(([id]) => !ids.has(id))));
    setAnnounce(
      targets.length === 1 ? `${meetingLabel(targets[0])}를 지웠습니다.` : `회차 ${targets.length}개를 지웠습니다.`,
    );
    setBulkConfirm(false);
    setChecked(new Set());
  }

  // 지울 수 있는 회차 — 예정된 정규 회차만
  const deletable = meetings.filter((m) => !isKickoff(m) && !started(m));
  const picked = deletable.filter((m) => checked.has(m.id));
  const allChecked = deletable.length > 0 && picked.length === deletable.length;
  function toggle(id: string) {
    setChecked((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  const toDelete = bulkConfirm ? picked : [];

  return (
    <div className='flex flex-col gap-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <h2 className='text-base font-bold'>
          일정
          <span className='tnum ml-2 text-sm font-medium text-fg-muted'>
            전체 {regular.length} · 예정 {upcomingCount}
          </span>
        </h2>
        <div className='flex items-center gap-2'>
          <Segmented
            aria-label='일정 표시 시간대'
            shape='pill'
            size='sm'
            value={zone}
            options={DISPLAY_ZONES.map((z) => ({ value: z.iana as string, label: z.label }))}
            onChange={setZone}
          />
          <Button size='sm' variant='secondary' onClick={() => setSettingKickoff(true)}>
            {hasKickoff ? '킥오프 수정' : '킥오프 정하기'}
          </Button>
          {/* 고른 것과 상관없는 일이라 작업 바가 아니라 제목 줄에 둔다 */}
          <Button size='sm' leadingIcon={<Plus size={15} />} onClick={() => setAdding(true)}>
            회차 추가
          </Button>
        </div>
      </div>

      <p className='sr-only' aria-live='polite'>
        {announce}
      </p>

      {adding && (
        <AddMeetingDialog
          group={group}
          existing={meetings}
          onCancel={() => setAdding(false)}
          onAdd={(input, label) => {
            onAdd(input);
            setAdding(false);
            setAnnounce(`회차를 추가했습니다. ${label}`);
          }}
        />
      )}

      {settingKickoff && (
        <KickoffDialog
          group={group}
          existing={meetings}
          onCancel={() => setSettingKickoff(false)}
          onSave={(input, label) => {
            onSetKickoff(input);
            setSettingKickoff(false);
            setAnnounce(`킥오프를 정했습니다. ${label}`);
          }}
        />
      )}

      {meetings.length === 0 ? (
        <p className='card px-6 py-10 text-center text-sm text-fg-muted'>
          아직 회차가 없습니다. 「회차 추가」로 만드세요.
        </p>
      ) : (
        // overflow-clip — 카드 모서리는 자르되 스크롤 상자는 만들지 않는다. 그래야 작업 바가 화면 위에 붙는다
        <div className='card overflow-clip'>
          {/* 표 맨 위 작업 바 — 왼쪽은 고른 회차 삭제, 오른쪽은 저장 (POL-0008). 삭제는 고르기 전에도 늘 보인다 */}
          <TableActionBar
            className='top-[var(--table-action-bar-top,4rem)] bottom-auto border-b border-border bg-surface-raised px-4'
            selection={
              <>
                <SelectionCount count={picked.length} unit='개' />
                <Button
                  size='sm'
                  variant='danger'
                  disabled={picked.length === 0}
                  title={picked.length === 0 ? '지울 회차를 왼쪽 체크박스로 고르세요' : undefined}
                  onClick={() => setBulkConfirm(true)}
                >
                  삭제
                </Button>
                {picked.length > 0 && (
                  <Button size='sm' variant='ghost' onClick={() => setChecked(new Set())}>
                    선택 해제
                  </Button>
                )}
              </>
            }
            save={
              <span className='flex items-center gap-2'>
                {errorCount > 0 && <p className='mr-1 text-xs text-error-700'>고칠 칸 {errorCount}개</p>}
                {dirty && (
                  <Button variant='ghost' size='sm' onClick={clearDrafts}>
                    변경 취소
                  </Button>
                )}
                <Button size='sm' onClick={saveAll} disabled={!dirty || errorCount > 0}>
                  저장
                </Button>
              </span>
            }
          />
          <div className='overflow-x-auto'>
            <table className='w-full min-w-[56rem] border-separate border-spacing-0 text-sm'>
              <thead>
                <tr className='text-left text-xs font-semibold text-fg-muted'>
                  <th className='w-10 py-3 pl-4'>
                    <Checkbox
                      label=''
                      aria-label='지울 수 있는 회차 전체 선택'
                      checked={allChecked}
                      disabled={deletable.length === 0}
                      indeterminate={picked.length > 0 && !allChecked}
                      onChange={() => setChecked(allChecked ? new Set() : new Set(deletable.map((m) => m.id)))}
                    />
                  </th>
                  <th className='w-24 px-4 py-3 text-center'>회차</th>
                  <th className='w-40 px-2 py-3'>일자</th>
                  <th className='w-28 px-2 py-3'>시각 ({zoneLabel(zone)})</th>
                  <th className='w-60 px-2 py-3'>제목</th>
                  <th className='w-32 px-2 py-3 text-center'>발표자1</th>
                  <th className='w-32 px-2 py-3 text-center'>발표자2</th>
                </tr>
              </thead>
              <tbody>
                {meetings.map((m) => {
                  const past = started(m);
                  const kickoff = isKickoff(m);
                  const shown = wallParts(new Date(m.scheduledAt), zone);
                  const v = valueOf(m);
                  const errors = errorsOf(m);
                  // 킥오프는 표에서 고치지 않는다 — 「킥오프 정하기 · 수정」으로만
                  const editable = !past && !kickoff;
                  const wall = shownWall(v);
                  const cell = 'border-t border-border px-2 py-1.5 align-top';

                  const presenterCell = (slot: 'presenter1' | 'presenter2') => {
                    if (kickoff) return <span className='inline-block py-1.5 text-fg-muted'>-</span>;
                    if (editable) {
                      return (
                        <PresenterSelect
                          label={`${meetingLabel(m)} ${slot === 'presenter1' ? '발표자1' : '발표자2'}`}
                          placeholder={slot === 'presenter1' ? '발표자 1' : '발표자 2'}
                          people={pickable}
                          value={v[slot]}
                          onChange={(id) => change(m, { [slot]: id })}
                        />
                      );
                    }
                    const name = people.find((p) => p.id === m[slot])?.name;
                    return <span className={cx('inline-block py-1.5', !name && 'text-fg-muted')}>{name ?? '-'}</span>;
                  };

                  return (
                    <tr
                      key={m.id}
                      className={cx(
                        // 시작한 회차는 흐린 글자 — 상태 열 없이도 고칠 수 없는 줄임을 알린다
                        past && 'text-fg-muted',
                        kickoff && 'bg-surface-1',
                        changedIds.includes(m.id) && 'bg-brand-subtle/40',
                        bulkConfirm && checked.has(m.id) && 'bg-error-50',
                      )}
                    >
                      <td className='border-t border-border py-2.5 pl-4 align-middle'>
                        {!kickoff && !past && (
                          <Checkbox
                            label=''
                            aria-label={`${meetingLabel(m)} 선택`}
                            checked={checked.has(m.id)}
                            onChange={() => toggle(m.id)}
                          />
                        )}
                      </td>
                      <td className='tnum border-t border-border px-4 py-2.5 text-center align-middle font-bold'>
                        {m.no}
                        {past && <span className='sr-only'> (지난 회차 · 고칠 수 없음)</span>}
                      </td>
                      <td className={cx(cell, 'tnum')}>
                        {editable ? (
                          <CellInput
                            type='date'
                            label={`${meetingLabel(m)} 일자 (${zoneLabel(zone)})`}
                            value={wall.date}
                            error={errors.date}
                            onChange={(date) => changeWall(m, { date })}
                          />
                        ) : (
                          <span className='inline-block whitespace-nowrap py-1.5'>{dateWithDow(shown.date)}</span>
                        )}
                      </td>
                      <td className={cx(cell, 'tnum')}>
                        {editable ? (
                          <CellInput
                            type='time'
                            label={`${meetingLabel(m)} 시작 시각 (${zoneLabel(zone)})`}
                            value={wall.time}
                            error={errors.time}
                            onChange={(time) => changeWall(m, { time })}
                          />
                        ) : (
                          <span className='inline-block py-1.5'>{shown.time}</span>
                        )}
                      </td>
                      <td className={cell}>
                        {editable ? (
                          <TitleInput
                            label={`${meetingLabel(m)} 제목`}
                            value={v.title}
                            error={errors.title}
                            onChange={(title) => change(m, { title })}
                          />
                        ) : m.title ? (
                          <span className='inline-block whitespace-pre-wrap break-words py-1.5'>{m.title}</span>
                        ) : (
                          <span className='block py-1.5 text-center text-fg-muted'>-</span>
                        )}
                      </td>
                      <td className={cx(cell, 'text-center')}>{presenterCell('presenter1')}</td>
                      <td className={cx(cell, 'text-center')}>
                        {presenterCell('presenter2')}
                        {errors.presenter2 && <p className='mt-1 text-xs text-error-700'>{errors.presenter2}</p>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 결정을 묻는 모달 — 취소가 기본 포커스. Enter 로 지워지면 안 된다 (POL-0008) */}
      <Modal
        open={toDelete.length > 0}
        onClose={() => setBulkConfirm(false)}
        title='회차 삭제'
        footer={
          <>
            <Button variant='secondary' data-autofocus onClick={() => setBulkConfirm(false)}>
              취소
            </Button>
            <Button variant='destructive' onClick={() => remove(toDelete)}>
              삭제
            </Button>
          </>
        }
      >
        <p className='text-sm text-fg-secondary'>
          {toDelete.length === 1
            ? `${meetingLabel(toDelete[0])}(${dayLabel(toDelete[0].date)})를 지울까요?`
            : `회차 ${toDelete.length}개(${toDelete.map((m) => meetingLabel(m)).join(', ')})를 지울까요?`}{' '}
          뒤 회차 번호는 당겨집니다. 되돌릴 수 없습니다.
        </p>
      </Modal>
    </div>
  );
}

/* ── 표 칸 ─────────────────────────────────────────────────────────────── */

type RowDraft = { date: string; time: string; title: string; presenter1: string; presenter2: string };

type RowErrors = DraftErrors & { presenter2?: string };

function sameRow(a: RowDraft, b: RowDraft): boolean {
  return (
    a.date === b.date &&
    a.time === b.time &&
    a.title.trim() === b.title.trim() &&
    a.presenter1 === b.presenter1 &&
    a.presenter2 === b.presenter2
  );
}

function CellInput({
  type,
  label,
  value,
  error,
  onChange,
}: {
  type: 'date' | 'time';
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  return (
    <Input
      size='sm'
      type={type}
      aria-label={label}
      value={value}
      error={error}
      onChange={(ev) => onChange(ev.target.value)}
      className='px-2'
    />
  );
}

function TitleInput({
  label,
  value,
  error,
  onChange,
}: {
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  return (
    <Input
      size='sm'
      aria-label={label}
      value={value}
      placeholder='제목'
      maxLength={TITLE_MAX + 10}
      error={error}
      onChange={(ev) => onChange(ev.target.value)}
      className='px-2'
    />
  );
}

function PresenterSelect({
  label,
  placeholder,
  people,
  value,
  onChange,
}: {
  label: string;
  /** 비어 있을 때 보이는 글 — 고르면 칸을 비운다. */
  placeholder: string;
  people: Person[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <Select
      aria-label={label}
      size='sm'
      value={value}
      onChange={(ev) => onChange(ev.target.value)}
      className={cx('w-full max-w-none', !value && 'text-fg-muted')}
    >
      <option value=''>{placeholder}</option>
      {people.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </Select>
  );
}
