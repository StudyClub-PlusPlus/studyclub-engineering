'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { BulkSelect, SelectAll } from '@console/components/AttendanceTab';
import { ClubPasteDialog } from '@console/components/ClubPasteDialog';
import {
  clubDays,
  clubRate,
  daysIn,
  isoDay,
  monthOf,
  shortDate,
  STATUS_LABEL,
  weekdayOf,
  type ClubBook,
  type ClubConfig,
  type ClubMember,
  DEFAULT_TIME_ZONE,
} from '@console/lib/clubs';
import { type AttendanceStatus } from '@studyclub/types';
import { Badge, Button, Checkbox, HelpPopover, Modal, Select, SelectionCount, TableActionBar } from '@studyclub/ui';
import { ClipboardPaste } from 'lucide-react';


/**
 * 클럽 월간 출석부 — 사람 × 그 달의 날짜.
 *
 * 클럽에는 모임(회차)이 없다. 그래서 열은 회차가 아니라 기수 기간의 날짜다 (1일~말일).
 * 캡틴은 지금처럼 시트 · 디스코드로 출석을 확인하고, 여기에는 그 결과만 옮긴다 — 칸을 하나씩 누르거나 시트에서 붙여넣는다.
 * 칸을 눌러도 저장하지 않는다. 여러 칸을 고친 뒤 「저장」으로 한 번에 반영한다 (스터디 출석부와 같다).
 */

const CELL_STYLE: Record<AttendanceStatus, string> = {
  present: 'bg-success-100 text-success-700',
  late: 'bg-warning-100 text-warning-700',
  absent: 'bg-error-50 text-error-700',
  excused: 'bg-surface-2 text-fg-secondary',
};

const CHANGED_RING: Record<AttendanceStatus, string> = {
  present: 'ring-success-700',
  late: 'ring-warning-700',
  absent: 'ring-error-700',
  excused: 'ring-fg-secondary',
};

/** 칸 안 글자 — 날짜 칸이 좁아 한 글자로 */
const SHORT: Record<AttendanceStatus, string> = { present: '출', late: '지', absent: '결', excused: '휴' };

function clone(book: ClubBook): ClubBook {
  return Object.fromEntries(Object.entries(book).map(([id, row]) => [id, { ...row }]));
}

function changedCount(a: ClubBook, b: ClubBook): number {
  let n = 0;
  for (const id of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const l = a[id] ?? {};
    const r = b[id] ?? {};
    for (const d of new Set([...Object.keys(l), ...Object.keys(r)])) if (l[d] !== r[d]) n += 1;
  }
  return n;
}

export function ClubAttendanceBoard({
  club,
  cohortTitle,
  today,
  members,
  book,
  onSave,
  onWithdraw,
  onDirtyChange,
  ended = false,
  monthPicker,
}: {
  club: ClubConfig;
  cohortTitle: string;
  /** 오늘 (YYYY-MM-DD) — 이 날 뒤의 칸은 아직 입력할 수 없다 */
  today: string;
  members: ClubMember[];
  book: ClubBook;
  onSave: (next: ClubBook) => Promise<void>;
  /** 참여 중단 — 오늘 날짜로 끝난다 */
  onWithdraw: (ids: string[]) => void;
  onDirtyChange?: (dirty: boolean) => void;
  /** 끝난 기수 — 출석은 고칠 수 있다. 참여 중단은 없다 (기수가 이미 끝났다) */
  ended?: boolean;
  /** 제목 옆 기수(월) 고르기 */
  monthPicker?: ReactNode;
}) {
  const month = monthOf(today);
  const days = useMemo(
    () => Array.from({ length: daysIn(month) }, (_, i) => isoDay(month, i + 1)),
    [month.year, month.month], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const [draft, setDraft] = useState<ClubBook>(() => clone(book));
  const [saving, setSaving] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [bulkDay, setBulkDay] = useState(today);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  const changed = changedCount(book, draft);
  const dirty = changed > 0;
  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);

  // 중단한 사람은 맨 아래로 — 지금 챙길 사람이 위에 남는다
  const rows = [...members].sort((a, b) => Number(Boolean(a.leftOn)) - Number(Boolean(b.leftOn)));
  const active = rows.filter((m) => !m.leftOn);
  const selected = active.filter((m) => picked.has(m.id));

  /** 이 칸을 고칠 수 있는가 — 오늘 이후 · 중단한 날 이후는 잠긴다 */
  const editable = (m: ClubMember, day: string) => day <= today && !(m.leftOn && day > m.leftOn);

  function cycle(cur: AttendanceStatus | undefined): AttendanceStatus | undefined {
    if (cur === undefined) return club.statuses[0];
    const i = club.statuses.indexOf(cur);
    return i === club.statuses.length - 1 ? undefined : club.statuses[i + 1];
  }

  function setCell(id: string, day: string, s: AttendanceStatus | undefined) {
    setDraft((prev) => {
      const row = { ...(prev[id] ?? {}) };
      if (s) row[day] = s;
      else delete row[day];
      return { ...prev, [id]: row };
    });
  }

  function applyBulk(v: string) {
    for (const m of selected)
      if (editable(m, bulkDay)) setCell(m.id, bulkDay, v === 'clear' ? undefined : (v as AttendanceStatus));
  }

  async function save() {
    setSaving(true);
    await onSave(draft);
    setSaving(false);
  }

  const bulkOptions = [
    ...club.statuses.map((s) => ({ value: s, label: STATUS_LABEL[s] })),
    { value: 'clear', label: '기록 지우기' },
  ];

  return (
    <div>
      <div data-anno='clubbook:1' className='mb-3 flex flex-wrap items-center justify-between gap-3'>
        <div className='flex flex-wrap items-center gap-2'>
          <h2 data-anno='clubbook:1-1' className='type-title-md text-fg'>
            {cohortTitle} 출석부
          </h2>
          <span className='tnum type-label-sm text-fg-muted'>전체 {members.length}</span>
          {monthPicker}
          {ended && (
            <span data-anno='clubbook:1-5' className='inline-flex items-center gap-1'>
              <Badge tone='ended'>끝난 기수</Badge>
              <HelpPopover label='끝난 기수 출석 고치기 설명'>
                끝난 기수도 출석을 고칠 수 있습니다. 고친 출석은 그 기수의 출석률에만 반영되고, 이미 다음 기수로 넘어간
                명단은 바뀌지 않습니다.
              </HelpPopover>
            </span>
          )}
          {club.timeZone !== DEFAULT_TIME_ZONE && (
            <span data-anno='clubbook:1-2' className='inline-flex items-center gap-1'>
              <Badge tone='neutral'>날짜 기준 {club.timeZone}</Badge>
              <HelpPopover label='날짜 기준 설명'>
                이 클럽은 {club.timeZone} 0시에 하루가 바뀝니다. 출석부의 날짜도 이 시간대의 날짜입니다.
              </HelpPopover>
            </span>
          )}
        </div>
        {
          <Button
            data-anno='clubbook:1-3'
            size='sm'
            variant='secondary'
            leadingIcon={<ClipboardPaste size={14} />}
            onClick={() => setPasteOpen(true)}
          >
            시트에서 붙여넣기
          </Button>
        }
      </div>

      <ul data-anno='clubbook:2' className='mb-3 flex flex-wrap items-center gap-3 type-label-sm text-fg-muted'>
        {club.statuses.map((s) => (
          <li key={s} className='flex items-center gap-1.5'>
            <span className={`grid h-5 w-5 place-items-center rounded-sm ${CELL_STYLE[s]}`}>{SHORT[s]}</span>
            {STATUS_LABEL[s]}
            {s === 'late' && ' (0.5일)'}
          </li>
        ))}
        <li className='flex items-center gap-1.5'>
          <span className='h-5 w-5 rounded-sm border border-border bg-surface-1' />
          기록 없음
        </li>
      </ul>

      <div className='card overflow-clip'>
        {
          <TableActionBar
            position='top'
            className='top-[var(--table-action-bar-top,4rem)] bottom-auto border-b border-border bg-surface-raised px-4'
            data-anno='clubbook:4'
            selection={
              <>
                <SelectionCount count={selected.length} total={active.length} unit='명' />
                <Select
                  data-anno='clubbook:4-1'
                  size='sm'
                  aria-label='바꿀 날짜'
                  disabled={selected.length === 0}
                  value={bulkDay}
                  onChange={(e) => setBulkDay(e.target.value)}
                >
                  {days
                    .filter((d) => d <= today)
                    .map((d) => (
                      <option key={d} value={d}>
                        {shortDate(d)}
                      </option>
                    ))}
                </Select>
                <span data-anno='clubbook:4-2'>
                  <BulkSelect
                    label='바꿀 출석 상태'
                    placeholder='출석 상태'
                    options={bulkOptions}
                    disabled={saving || selected.length === 0}
                    onPick={applyBulk}
                  />
                </span>
                {!ended && (
                  <Button
                    data-anno='clubbook:4-3'
                    size='sm'
                    variant='danger'
                    disabled={saving || selected.length === 0}
                    onClick={() => setWithdrawOpen(true)}
                  >
                    참여 중단
                  </Button>
                )}
                {selected.length > 0 && (
                  <Button size='sm' variant='tertiary' onClick={() => setPicked(new Set())}>
                    선택 해제
                  </Button>
                )}
              </>
            }
            save={
              <span data-anno='clubbook:4-4' className='flex items-center gap-2'>
                {dirty && <span className='tnum type-label-sm text-fg-muted'>저장 안 한 칸 {changed}</span>}
                {dirty && (
                  <Button variant='tertiary' size='sm' onClick={() => setDraft(clone(book))} disabled={saving}>
                    변경 취소
                  </Button>
                )}
                <Button size='sm' onClick={save} loading={saving} disabled={!dirty}>
                  저장
                </Button>
              </span>
            }
          />
        }
        <div className='overflow-x-auto'>
          <table data-anno='clubbook:3' className='min-w-full border-separate border-spacing-0 type-body-sm'>
            <thead>
              <tr className='bg-surface-1'>
                <th className='sticky left-0 z-10 w-10 bg-surface-1 px-3 py-2'>
                  {
                    <SelectAll
                      checked={active.length > 0 && selected.length === active.length}
                      partial={selected.length > 0 && selected.length < active.length}
                      onChange={() =>
                        setPicked(selected.length === active.length ? new Set() : new Set(active.map((m) => m.id)))
                      }
                    />
                  }
                </th>
                <th
                  data-anno='clubbook:3-1'
                  className='sticky left-10 z-10 w-32 bg-surface-1 px-2 py-2 text-left type-label-sm text-fg-muted'
                >
                  디스코드 별명
                </th>
                {club.rosterQuestion && (
                  <th
                    data-anno='clubbook:3-2'
                    className='w-24 whitespace-nowrap px-2 py-2 text-left type-label-sm text-fg-muted'
                  >
                    {club.rosterQuestion.label}
                  </th>
                )}
                {days.map((d, i) => {
                  const weekend = ['토', '일'].includes(weekdayOf(d));
                  return (
                    <th
                      key={d}
                      data-anno={i === 0 ? 'clubbook:3-3' : undefined}
                      className={`min-w-9 px-0.5 py-1 text-center type-label-sm ${
                        d === today
                          ? 'text-brand'
                          : d > today
                            ? 'text-fg-muted'
                            : weekend
                              ? 'text-fg-secondary'
                              : 'text-fg'
                      }`}
                      aria-label={`${shortDate(d)}${d === today ? ' 오늘' : ''}`}
                    >
                      <span className='tnum block'>{Number(d.slice(8))}</span>
                      <span className='block text-fg-muted'>{d === today ? '오늘' : weekdayOf(d)}</span>
                    </th>
                  );
                })}
                <th
                  data-anno='clubbook:3-5'
                  className='sticky right-0 z-10 min-w-16 whitespace-nowrap bg-surface-1 px-2 py-2 text-right type-label-sm text-fg-muted'
                >
                  출석
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m, ri) => {
                const row = draft[m.id];
                const rate = clubRate(row);
                const left = Boolean(m.leftOn);
                return (
                  <tr
                    key={m.id}
                    data-anno={left ? 'clubbook:3-6' : undefined}
                    className={left ? 'text-fg-muted' : undefined}
                  >
                    <td className='sticky left-0 z-10 border-t border-border bg-surface-raised px-3 py-1'>
                      {!left && (
                        <Checkbox
                          label={`${m.name} 선택`}
                          hideLabel
                          checked={picked.has(m.id)}
                          onChange={() =>
                            setPicked((p) => {
                              const n = new Set(p);
                              if (n.has(m.id)) n.delete(m.id);
                              else n.add(m.id);
                              return n;
                            })
                          }
                        />
                      )}
                    </td>
                    <td className='sticky left-10 z-10 border-t border-border bg-surface-raised px-2 py-1'>
                      <span className='block truncate type-label-lg' title={m.name}>
                        {m.name}
                      </span>
                      {left && <span className='block type-label-sm'>{shortDate(m.leftOn!)} 참여 중단</span>}
                    </td>
                    {club.rosterQuestion && (
                      <td className='tnum whitespace-nowrap border-t border-border px-2 py-1 type-label-sm'>
                        {m.extra}
                      </td>
                    )}
                    {days.map((d, di) => {
                      const s = row?.[d];
                      const can = editable(m, d);
                      const was = book[m.id]?.[d];
                      const isChanged = was !== s;
                      if (!can) {
                        return (
                          <td key={d} className='border-t border-border px-0.5 py-1'>
                            <span
                              role='img'
                              aria-label={s ? STATUS_LABEL[s] : '입력할 수 없음'}
                              className={`grid h-8 place-items-center rounded-sm type-label-sm ${
                                s ? CELL_STYLE[s] : 'text-fg-muted'
                              }`}
                            >
                              {s ? SHORT[s] : left && d > m.leftOn! ? '—' : ''}
                            </span>
                          </td>
                        );
                      }
                      const label = `${m.name} ${shortDate(d)} ${s ? STATUS_LABEL[s] : '기록 없음'}`;
                      return (
                        <td key={d} className='border-t border-border px-0.5 py-1'>
                          <button
                            // ui-native: 출석부 칸 — 칸 전체가 누르는 곳이고 누를 때마다 상태가 돈다
                            type='button'
                            data-anno={ri === 0 && di === 0 ? 'clubbook:3-4' : undefined}
                            onClick={() => setCell(m.id, d, cycle(s))}
                            aria-label={isChanged ? `${label} · 저장되지 않음` : label}
                            title={`눌러서 ${club.statuses.map((x) => STATUS_LABEL[x]).join(' → ')} → 기록 없음`}
                            className={`h-8 w-full rounded-sm type-label-sm transition-colors ${
                              s ? CELL_STYLE[s] : 'bg-surface-1 hover:bg-surface-2'
                            } ${isChanged ? `ring-2 ${s ? CHANGED_RING[s] : 'ring-border-strong'}` : ''}`}
                          >
                            {s ? SHORT[s] : ''}
                          </button>
                        </td>
                      );
                    })}
                    <td className='tnum sticky right-0 z-10 min-w-16 whitespace-nowrap border-t border-border bg-surface-raised px-2 py-1 text-right type-label-sm'>
                      <span className='block text-fg'>{clubDays(row)}일</span>
                      <span className='block text-fg-muted'>{rate === undefined ? '-' : `${rate}%`}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <ClubPasteDialog
        open={pasteOpen}
        club={club}
        days={days.filter((d) => d <= today)}
        members={members}
        onClose={() => setPasteOpen(false)}
        onApply={(cells) => {
          for (const c of cells) {
            const m = members.find((x) => x.id === c.id);
            if (m && editable(m, c.day)) setCell(c.id, c.day, c.status);
          }
          setPasteOpen(false);
        }}
      />

      <Modal
        open={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
        title='참여 중단'
        footer={
          <>
            <Button variant='secondary' data-autofocus onClick={() => setWithdrawOpen(false)}>
              취소
            </Button>
            <Button
              variant='danger'
              onClick={() => {
                onWithdraw(selected.map((m) => m.id));
                setPicked(new Set());
                setWithdrawOpen(false);
              }}
            >
              {selected.length}명 참여 중단
            </Button>
          </>
        }
      >
        <div data-anno='clubbook:6' className='py-4'>
          <p className='type-label-lg text-fg'>{selected.map((m) => m.name).join(', ')}</p>
          <p className='mt-1.5 type-body-sm text-fg-muted'>
            오늘({shortDate(today)})로 참여가 끝납니다. 이 기수를 완주하지 않은 것으로 남고, 다음 기수로 이어지지
            않습니다. 다시 참여하려면 다음 기수 모집에 신청해야 합니다.
          </p>
        </div>
      </Modal>
    </div>
  );
}
