'use client';

import { useEffect, useState, type ReactNode } from 'react';

import { BulkSelect, SelectAll } from '@console/components/AttendanceTab';
import { ClubPasteDialog } from '@console/components/ClubPasteDialog';
import { daysIn, isoDay, monthOf, shortDate, type ClubConfig, type ClubMember } from '@console/lib/clubs';
import { isoWeek, marksFor, type DayMark } from '@core/lib/my-club';
import { Badge, Button, Checkbox, HelpPopover, Modal, Select, SelectionCount, TableActionBar } from '@studyclub/ui';
import { ClipboardPaste } from 'lucide-react';

import { ClubBoard, boardWeeks } from '@/proto/club/ClubBoard';
import { patchMember, quietMembers, restingNext, type ClubRoom } from '@/proto/club/room';

/**
 * 클럽 월간 출석부 (운영 콘솔) — 사용자 사이트 출석 탭과 **같은 판**(`ClubBoard`)에 캡틴 도구를 얹는다.
 *
 * 기록은 크루가 남기거나(얼리버드 · WEEKLY X) 자동으로 들어온다(Daily LeetCode). 캡틴은 다 적지 않고 **확인하고 고친다**.
 * 고친 칸에는 「캡틴이 고침」 표시가 남는다. 칸 모양 · 숫자는 클럽 설정이 정한다 — 날 단위는 날짜 칸, 주 단위는 한 주의 공부 시간.
 * 칸을 눌러도 저장하지 않는다. 여러 칸을 고친 뒤 「저장」으로 한 번에 반영한다 (스터디 출석부와 같다).
 */

const STATUS_LABEL: Record<DayMark, string> = { present: '출석', late: '지각', absent: '결석', excused: '휴가' };

/** 저장 전 고친 칸 수 */
function changedCount(a: ClubRoom, b: ClubRoom): number {
  let n = 0;
  for (const id of Object.keys(b.states)) {
    const l = a.states[id];
    const r = b.states[id];
    if (!l || !r) continue;
    for (const d of new Set([...Object.keys(l.days), ...Object.keys(r.days)])) if (l.days[d] !== r.days[d]) n += 1;
    for (const d of new Set([...Object.keys(l.minutes), ...Object.keys(r.minutes)]))
      if (l.minutes[d] !== r.minutes[d]) n += 1;
    for (const w of new Set([...Object.keys(l.weeks), ...Object.keys(r.weeks)]))
      if (l.weeks[w]?.goalMin !== r.weeks[w]?.goalMin) n += 1;
  }
  return n;
}

export function ClubAttendanceBoard({
  club,
  cohortTitle,
  room,
  members,
  onSave,
  onWithdraw,
  onReinstate,
  onDirtyChange,
  ended = false,
  monthPicker,
}: {
  club: ClubConfig;
  cohortTitle: string;
  /** 그 기수의 기록 — 오늘(`room.today`) 뒤의 칸은 아직 입력할 수 없다 */
  room: ClubRoom;
  /** 명단 — 참여 중단 날짜는 여기서 온다 */
  members: ClubMember[];
  onSave: (next: ClubRoom) => Promise<void>;
  /** 참여 중단 — 오늘 날짜로 끝난다 */
  onWithdraw: (ids: string[]) => void;
  /** 참여 중단 취소 — 다시 참여 중으로. 이번 기수에서만 */
  onReinstate?: (id: string) => void;
  onDirtyChange?: (dirty: boolean) => void;
  /** 끝난 기수 — 기록은 고칠 수 있다. 참여 중단은 없다 (기수가 이미 끝났다) */
  ended?: boolean;
  /** 제목 옆 기수(월) 고르기 */
  monthPicker?: ReactNode;
}) {
  const today = room.today;
  const month = monthOf(today);
  const days = Array.from({ length: daysIn(month) }, (_, i) => isoDay(month, i + 1));
  const base: ClubRoom = { ...room, members };
  const [draftStates, setDraftStates] = useState(room.states);
  // 저장 · 크루 화면에서 기록이 바뀌면 그 값에서 다시 시작한다
  useEffect(() => setDraftStates(room.states), [room.states]);
  const draft: ClubRoom = { ...base, states: draftStates };
  const setDraft = (f: (r: ClubRoom) => ClubRoom) => setDraftStates((st) => f({ ...base, states: st }).states);
  const [saving, setSaving] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [bulkDay, setBulkDay] = useState(today);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [reinstate, setReinstate] = useState<ClubMember | null>(null);
  const week = club.rules.judge === 'week';
  const weeks = boardWeeks(today);
  const [monday, setMonday] = useState(weeks[0]);

  const changed = changedCount(base, draft);
  const dirty = changed > 0;
  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);

  const active = members.filter((m) => !m.leftOn);
  const selected = active.filter((m) => picked.has(m.id));
  const quiet = ended ? [] : quietMembers(draft);
  const restNext = ended ? [] : restingNext(draft);

  /** 이 칸을 고칠 수 있는가 — 오늘 이후 · 중단한 날 이후 · 쉬는 달은 잠긴다 */
  const editable = (m: ClubMember, day: string) =>
    day <= today && !(m.leftOn && day > m.leftOn) && draft.states[m.id]?.membership.kind !== 'resting';

  function setCell(id: string, day: string, v: DayMark | undefined) {
    setDraft((r) =>
      patchMember(r, id, (s) => {
        const d2 = { ...s.days };
        if (v) d2[day] = v;
        else delete d2[day];
        return { ...s, days: d2, byCaptain: { ...(s.byCaptain ?? {}), [day]: true } };
      }),
    );
  }

  function applyBulk(v: string) {
    for (const m of selected)
      if (editable(m, bulkDay)) setCell(m.id, bulkDay, v === 'clear' ? undefined : (v as DayMark));
  }

  async function save() {
    setSaving(true);
    await onSave(draft);
    setSaving(false);
  }

  const bulkOptions = [
    ...marksFor(club.rules).map((s) => ({ value: s, label: STATUS_LABEL[s] })),
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
          {week && (
            <span data-anno='clubbook:1-6'>
              <Select size='sm' aria-label='주' value={monday} onChange={(e) => setMonday(e.target.value)}>
                {weeks.map((w, i) => (
                  <option key={w} value={w}>
                    {isoWeek(w)}주차{i === 0 && !ended ? ' (이번 주)' : ''}
                  </option>
                ))}
              </Select>
            </span>
          )}
          {ended && (
            <span data-anno='clubbook:1-5' className='inline-flex items-center gap-1'>
              <Badge tone='ended'>끝난 기수</Badge>
              <HelpPopover label='끝난 기수 출석 고치기 설명'>
                끝난 기수도 기록을 고칠 수 있습니다. 고친 기록은 그 기수의 숫자에만 반영되고, 이미 다음 기수로 넘어간
                명단은 바뀌지 않습니다.
              </HelpPopover>
            </span>
          )}
        </div>
        {!week && (
          <Button
            data-anno='clubbook:1-3'
            size='sm'
            variant='secondary'
            leadingIcon={<ClipboardPaste size={14} />}
            onClick={() => setPasteOpen(true)}
          >
            시트에서 붙여넣기
          </Button>
        )}
      </div>

      {(quiet.length > 0 || restNext.length > 0) && (
        <div data-anno='clubbook:8' className='card mb-3 flex flex-col gap-1.5 px-4 py-3 type-body-sm'>
          {quiet.length > 0 && (
            <p>
              <span className='font-semibold text-fg'>살펴볼 사람</span>
              <span className='ml-2 text-fg-secondary'>사흘째 기록 없음 — {quiet.map((m) => m.name).join(', ')}</span>
            </p>
          )}
          {restNext.length > 0 && (
            <p>
              <span className='font-semibold text-fg'>다음 달 쉬기</span>
              <span className='ml-2 text-fg-secondary'>{restNext.map((m) => m.name).join(', ')}</span>
            </p>
          )}
          <p className='type-label-sm text-fg-muted'>자동으로 내보내지 않습니다 — 연락은 캡틴이 합니다.</p>
        </div>
      )}

      <div className='card overflow-clip'>
        <TableActionBar
          position='top'
          className='top-[var(--table-action-bar-top,4rem)] bottom-auto border-b border-border bg-surface-raised px-4'
          data-anno='clubbook:4'
          selection={
            <>
              <SelectionCount count={selected.length} total={active.length} unit='명' />
              {!week && (
                <>
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
                      label='바꿀 기록'
                      placeholder='기록'
                      options={bulkOptions}
                      disabled={saving || selected.length === 0}
                      onPick={applyBulk}
                    />
                  </span>
                </>
              )}
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
                <Button variant='tertiary' size='sm' onClick={() => setDraftStates(room.states)} disabled={saving}>
                  변경 취소
                </Button>
              )}
              <Button size='sm' onClick={save} loading={saving} disabled={!dirty}>
                저장
              </Button>
            </span>
          }
        />
        <div className='p-3'>
          <ClubBoard
            room={draft}
            baseline={base}
            days={days}
            week={monday}
            onRoom={setDraft}
            showCounts={!week}
            lead={{
              head: (
                <SelectAll
                  checked={active.length > 0 && selected.length === active.length}
                  partial={selected.length > 0 && selected.length < active.length}
                  onChange={() =>
                    setPicked(selected.length === active.length ? new Set() : new Set(active.map((m) => m.id)))
                  }
                />
              ),
              cell: (m) =>
                m.leftOn ? null : (
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
                ),
            }}
            nameExtra={(m) =>
              m.leftOn && !ended && onReinstate ? (
                <Button
                  data-anno={members.find((x) => x.leftOn)?.id === m.id ? 'clubbook:3-7' : undefined}
                  size='sm'
                  variant='tertiary'
                  disabled={saving}
                  onClick={() => setReinstate(m)}
                >
                  참여 중단 취소
                </Button>
              ) : null
            }
            anno={{
              table: 'clubbook:3',
              name: 'clubbook:3-1',
              extra: 'clubbook:3-2',
              dayHead: 'clubbook:3-3',
              cell: 'clubbook:3-4',
              total: 'clubbook:3-5',
              counts: 'clubbook:3-8',
              legend: 'clubbook:2',
            }}
          />
        </div>
      </div>

      <ClubPasteDialog
        open={pasteOpen}
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

      <Modal
        open={reinstate !== null}
        onClose={() => setReinstate(null)}
        title='참여 중단 취소'
        footer={
          <>
            <Button variant='secondary' data-autofocus onClick={() => setReinstate(null)}>
              닫기
            </Button>
            <Button
              onClick={() => {
                if (reinstate) onReinstate?.(reinstate.id);
                setReinstate(null);
              }}
            >
              참여 중단 취소
            </Button>
          </>
        }
      >
        <div data-anno='clubbook:6-1' className='py-4'>
          <p className='type-label-lg text-fg'>{reinstate?.name}</p>
          <p className='mt-1.5 type-body-sm text-fg-muted'>
            다시 참여 중으로 돌아갑니다. {reinstate?.leftOn ? shortDate(reinstate.leftOn) : ''} 뒤의 날짜도 입력할 수
            있고, 이번 기수를 끝까지 마치면 다음 기수로 이어집니다.
          </p>
        </div>
      </Modal>
    </div>
  );
}
