'use client';

import { useEffect, useId, useRef, useState } from 'react';

import { AutoTextarea } from '@core/components/AutoTextarea';
import { SegmentTabs } from '@core/components/SegmentTabs';
import { meetingWindow, meetingsOf } from '@core/lib/attendance';
import {
  DISPLAY_ZONES,
  DOW_LABEL,
  REPEAT_SPAN_DAYS,
  TITLE_MAX,
  addMeetings,
  dayLabel,
  defaultDate,
  defaultUntil,
  deleteMeetings,
  dowOf,
  isKickoff,
  maxUntil,
  meetingLabel,
  patchMeeting,
  planDraft,
  previewOf,
  validateEdit,
  zoneLabel,
  zoneTitle,
  zonedInstant,
  wallLabel,
  wallParts,
  scheduleLabel,
  type DraftErrors,
  type MeetingDraft,
  type NavigatorGroup,
  type ProtoMeeting,
  type Repeat,
  type ScheduleRole,
} from '@core/lib/meetings';
import { ME_ID, participantsOf, type Participant } from '@core/lib/schedule-board';
import type { Study } from '@studyclub/mock';
import { Button, Input, Modal, cx } from '@studyclub/ui';
import { Plus, Trash2, X } from 'lucide-react';

/**
 * 스터디 일정 — 구글 시트 출석부의 일정표를 옮긴 화면. 참가자 누구나 본다.
 *
 * - 캡틴·네비게이터: 표의 칸을 바로 고친다(일자·시각·제목·발표자). 여러 칸을 고친 뒤 「저장」으로 한 번에.
 *   회차 추가(반복 포함)는 창으로, 삭제는 줄 아래 확인으로.
 * - 크루: 본다. 빈 발표자 칸에만 자기 이름을 넣고 뺄 수 있다(선착순) — 바로 저장된다.
 *
 * 킥오프는 0회차로 맨 위에 둔다. 지우지 않고, 발표자가 없고, 출석률에 넣지 않는다.
 * 시작한 회차(흐린 줄)는 고치거나 지우지 않는다 — 출석이 찍혀 있다.
 */
export function ScheduleManager({
  study,
  group,
  role,
  canEdit,
  onDirtyChange,
}: {
  study: Study;
  group: NavigatorGroup;
  role: ScheduleRole;
  canEdit: boolean;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  /** 신청이 밀렸을 때처럼 알려야 하지만 성공은 아닌 한 줄. */
  const [notice, setNotice] = useState<string | null>(null);
  /** 화면 문구 없이 스크린리더에만 결과를 알린다 — 늘 붙어 있는 aria-live 영역. */
  const [announce, setAnnounce] = useState('');
  /** 줄을 처음 고칠 때의 저장값. 저장할 때 발표자 칸이 「내가 바꾼 것」인지 이것과 견준다. */
  const bases = useRef<Record<string, RowDraft>>({});
  /** 고치는 중인 줄 — 저장 전까지는 화면에만 있다. */
  const [drafts, setDrafts] = useState<Record<string, RowDraft>>({});
  /** 목록의 일정을 어느 시간대로 보일지. 처음엔 분반 시간대 — 탭에 없는 시간대면 KST. */
  const [zone, setZone] = useState<string>(
    DISPLAY_ZONES.some((z) => z.iana === group.timeZone) ? group.timeZone : DISPLAY_ZONES[0].iana,
  );
  /** 저장소가 localStorage 라 렌더 트리거가 없다 — 바꿀 때마다 올려 다시 읽는다. */
  const [, setRev] = useState(0);
  const refresh = () => setRev((n) => n + 1);

  const now = Date.now();
  const meetings = meetingsOf(study);
  const regular = meetings.filter((m) => !isKickoff(m));
  const people = participantsOf(study);
  const nameOf = (id?: string) => people.find((p) => p.id === id)?.name;
  const started = (m: ProtoMeeting) => meetingWindow(study, m).start.getTime() <= now;
  const upcomingCount = regular.filter((m) => !started(m)).length;

  const saved = (m: ProtoMeeting): RowDraft => ({
    date: m.date,
    time: m.time ?? wallParts(meetingWindow(study, m).start, group.timeZone).time,
    title: m.title ?? '',
    presenter1: m.presenter1 ?? '',
    presenter2: m.presenter2 ?? '',
  });
  const valueOf = (m: ProtoMeeting) => drafts[m.id] ?? saved(m);
  const changedIds = meetings.filter((m) => drafts[m.id] && !sameRow(drafts[m.id], saved(m))).map((m) => m.id);
  const dirty = changedIds.length > 0;

  // 고친 줄을 반영한 회차들로 같은 날 겹침을 본다 — 두 줄을 같은 날로 옮기는 것도 막아야 한다.
  const projected = meetings.map((m) => (drafts[m.id] ? { ...m, date: drafts[m.id].date } : m));
  const errorsOf = (m: ProtoMeeting): RowErrors => {
    if (!changedIds.includes(m.id)) return {};
    const v = valueOf(m);
    const found: RowErrors = validateEdit(v, m.id, projected, group.timeZone);
    if (v.presenter1 && v.presenter1 === v.presenter2) found.presenter2 = '발표자1과 다른 사람을 골라 주세요.';
    return found;
  };
  const errorCount = changedIds.reduce((n, id) => {
    const m = meetings.find((x) => x.id === id);
    return n + (m ? Object.keys(errorsOf(m)).length : 0);
  }, 0);

  useEffect(() => {
    onDirtyChange?.(dirty);
    return () => onDirtyChange?.(false);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    if (!dirty) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = '';
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  function change(m: ProtoMeeting, patch: Partial<RowDraft>) {
    if (!bases.current[m.id]) bases.current[m.id] = saved(m);
    // 같은 결과 문장이 다시 와도 스크린리더가 읽도록 고칠 때 비운다.
    setAnnounce('');
    setDrafts((d) => ({ ...d, [m.id]: { ...(d[m.id] ?? saved(m)), ...patch } }));
  }

  function clearDrafts() {
    bases.current = {};
    setDrafts({});
  }

  /**
   * 일자·시각 칸은 지금 고른 시간대로 보이고 그 시간대로 받는다. 고친 줄은 분반 시간대 벽시계로 들고 있다가
   * 저장할 때 UTC 로 바꾼다 — 어느 탭에서 고쳐도 같은 순간이 저장된다.
   */
  function shownWall(v: RowDraft): { date: string; time: string } {
    if (!v.date || !v.time || zone === group.timeZone) return { date: v.date, time: v.time };
    return wallParts(zonedInstant(v.date, v.time, group.timeZone), zone);
  }

  function changeWall(m: ProtoMeeting, patch: { date?: string; time?: string }) {
    const next = { ...shownWall(valueOf(m)), ...patch };
    // 칸을 비우면 그대로 비운다 — 「일자를 정해 주세요」로 막힌다.
    if (!next.date || !next.time || zone === group.timeZone) {
      change(m, next);
      return;
    }
    change(m, wallParts(zonedInstant(next.date, next.time, zone), group.timeZone));
  }

  function saveAll() {
    if (!dirty || errorCount > 0) return;
    for (const id of changedIds) {
      const v = drafts[id];
      const m = meetings.find((x) => x.id === id)!;
      const before = bases.current[id] ?? saved(m);
      // 발표자 칸은 고치기 시작할 때와 달라진 것만 보낸다 — 그 사이 크루가 신청한 칸을 옛 값(빈칸)으로 덮지 않는다.
      // TODO(api): PUT /api/studies/{studyId}/meetings/{meetingId} — 바뀐 줄마다, 바꾼 발표자 칸만.
      patchMeeting(
        study.id,
        id,
        {
          date: v.date,
          time: v.time,
          title: v.title,
          ...(v.presenter1 !== before.presenter1 && { presenter1: v.presenter1 || null }),
          ...(v.presenter2 !== before.presenter2 && { presenter2: v.presenter2 || null }),
        },
        group.timeZone,
      );
    }
    setAnnounce(`회차 ${changedIds.length}개를 저장했습니다.`);
    clearDrafts();
    refresh();
  }

  /** 크루의 발표 신청 — 빈 칸에 나를 넣거나, 내 이름을 뺀다. 바로 저장한다. */
  function sign(m: ProtoMeeting, slot: 'presenter1' | 'presenter2', on: boolean) {
    const which = slot === 'presenter1' ? '발표자1' : '발표자2';
    // 누르기 직전 저장값을 다시 본다 — 화면을 연 사이 다른 크루가 먼저 신청했으면 덮지 않는다(선착순).
    const latest = meetingsOf(study).find((x) => x.id === m.id) as ProtoMeeting | undefined;
    if (on && latest?.[slot]) {
      setNotice(`방금 다른 크루가 ${meetingLabel(m)} ${which}로 신청했습니다.`);
      refresh();
      return;
    }
    // TODO(api): PUT /api/studies/{studyId}/meetings/{meetingId}/presenters/{slot}/me (DELETE 로 취소)
    //            409 PRESENTER_SLOT_TAKEN 이면 위 문구를 보이고 목록을 다시 부른다.
    patchMeeting(study.id, m.id, { [slot]: on ? ME_ID : null }, group.timeZone);
    setNotice(null);
    setAnnounce(
      on ? `${meetingLabel(m)} ${which}로 신청했습니다.` : `${meetingLabel(m)} ${which} 신청을 취소했습니다.`,
    );
    refresh();
  }

  function remove(target: ProtoMeeting) {
    deleteMeetings(study.id, [target.id]);
    setDrafts((d) => {
      const { [target.id]: _gone, ...rest } = d;
      return rest;
    });
    delete bases.current[target.id];
    setAnnounce(`${meetingLabel(target)}를 지웠습니다.`);
    setConfirmId(null);
    refresh();
  }

  const cols = canEdit ? 7 : 6;

  return (
    <div className='flex flex-col gap-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <h2 data-anno='schedule:1' className='text-[15px] font-bold'>
          회차
          <span className='ml-2 text-[13px] font-medium text-fg-muted'>
            전체 {regular.length} · 예정 {upcomingCount}
          </span>
        </h2>
        <div className='flex items-center gap-2'>
          <SegmentTabs
            anno='schedule:8'
            label='일정 표시 시간대'
            value={zone}
            options={DISPLAY_ZONES.map((z) => ({ key: z.iana, label: z.label }))}
            onChange={setZone}
          />
          {canEdit && (
            <span data-anno='schedule:2'>
              <Button
                size='sm'
                leadingIcon={<Plus size={15} />}
                onClick={() => {
                  setAdding(true);
                  setConfirmId(null);
                }}
              >
                회차 추가
              </Button>
            </span>
          )}
        </div>
      </div>

      <p className='sr-only' aria-live='polite'>
        {announce}
      </p>

      {notice && (
        <p role='status' className='rounded-control bg-warning-50 px-3 py-2 text-sm font-semibold text-warning-700'>
          {notice}
        </p>
      )}

      {adding && (
        <AddForm
          study={study}
          group={group}
          onCancel={() => setAdding(false)}
          onAdded={(label) => {
            setAdding(false);
            setAnnounce(`회차를 추가했습니다 — ${label}`);
            refresh();
          }}
        />
      )}

      {meetings.length === 0 ? (
        <p className='card px-6 py-10 text-center text-sm text-fg-muted'>
          {canEdit ? '아직 회차가 없습니다. 「회차 추가」로 만드세요.' : '아직 회차가 없습니다.'}
        </p>
      ) : (
        <div data-anno='schedule:3' className='card overflow-x-auto'>
          <table className='w-full min-w-[66rem] border-separate border-spacing-0 text-sm'>
            <thead>
              <tr className='text-left text-xs font-semibold text-fg-muted'>
                <th className='w-24 px-4 py-3'>회차</th>
                <th className='w-40 px-2 py-3'>일자</th>
                <th className='w-28 px-2 py-3'>시각 ({zoneLabel(zone)})</th>
                <th className='min-w-[16rem] px-2 py-3'>제목</th>
                <th data-anno='schedule:9' className='w-36 px-2 py-3'>
                  발표자1
                </th>
                <th className='w-36 px-2 py-3'>발표자2</th>
                {canEdit && <th className='w-14 px-3 py-3 text-right'>삭제</th>}
              </tr>
            </thead>
            <tbody>
              {meetings.flatMap((m) => {
                const past = started(m);
                const kickoff = isKickoff(m);
                const start = meetingWindow(study, m).start;
                const shown = wallParts(start, zone);
                const v = valueOf(m);
                const errors = errorsOf(m);
                const changed = changedIds.includes(m.id);
                const editable = canEdit && !past;
                const wall = shownWall(v);
                const cell = 'border-t border-border px-2 py-1.5 align-top';

                const presenterCell = (slot: 'presenter1' | 'presenter2') => {
                  if (kickoff) return <span className='text-fg-muted'>—</span>;
                  if (editable) {
                    return (
                      <PresenterSelect
                        label={`${meetingLabel(m)} ${slot === 'presenter1' ? '발표자1' : '발표자2'}`}
                        placeholder={slot === 'presenter1' ? '발표자 1' : '발표자 2'}
                        people={people}
                        value={v[slot]}
                        onChange={(id) => change(m, { [slot]: id })}
                      />
                    );
                  }
                  const id = m[slot];
                  const other = slot === 'presenter1' ? m.presenter2 : m.presenter1;
                  const which = slot === 'presenter1' ? '발표자1' : '발표자2';
                  // 크루의 선착순 신청 — 빈 칸은 포인트 색 실선 칩 「신청」, 내 이름은 강조 칩 + × 로 취소.
                  if (!canEdit && !past && !id && other !== ME_ID) {
                    return (
                      <button
                        type='button'
                        data-anno='schedule:9-1'
                        aria-label={`${meetingLabel(m)} ${which} 신청`}
                        onClick={() => sign(m, slot, true)}
                        className='inline-flex h-7 w-full items-center justify-center rounded-pill border border-brand text-xs font-semibold text-brand transition-colors hover:bg-brand-subtle'
                      >
                        신청
                      </button>
                    );
                  }
                  if (!canEdit && !past && id === ME_ID) {
                    return (
                      <span className='inline-flex h-7 max-w-full items-center gap-1 rounded-pill bg-brand-subtle pl-2.5 pr-1 text-xs font-bold text-brand'>
                        <span className='truncate'>{nameOf(id)}</span>
                        <button
                          type='button'
                          aria-label={`${meetingLabel(m)} ${which} 신청 취소`}
                          title='신청 취소'
                          onClick={() => sign(m, slot, false)}
                          className='grid h-6 w-6 shrink-0 place-items-center rounded-full hover:bg-brand hover:text-on-brand'
                        >
                          <X size={12} strokeWidth={2.5} aria-hidden />
                        </button>
                      </span>
                    );
                  }
                  return nameOf(id) ?? <span className='text-fg-muted'>—</span>;
                };

                const row = (
                  <tr
                    key={m.id}
                    className={cx(
                      // 시작한 회차는 흐린 글자 — 상태 열 없이도 고칠 수 없는 줄임을 알린다.
                      past && 'text-fg-muted',
                      kickoff && 'bg-surface-1',
                      changed && 'bg-brand-subtle/40',
                      confirmId === m.id && 'bg-error-50',
                    )}
                  >
                    <td
                      data-anno={kickoff ? 'schedule:10' : undefined}
                      className='tnum border-t border-border px-4 py-2.5 align-top font-bold'
                    >
                      {m.no}
                      {past && <span className='sr-only'> (지난 회차 · 고칠 수 없음)</span>}
                    </td>
                    <td className={cn(cell, 'tnum')}>
                      {editable ? (
                        <CellInput
                          type='date'
                          label={`${meetingLabel(m)} 일자 (${zoneLabel(zone)})`}
                          value={wall.date}
                          error={errors.date}
                          onChange={(date) => changeWall(m, { date })}
                        />
                      ) : (
                        <span className='inline-block py-1.5'>{shown.date}</span>
                      )}
                    </td>
                    <td className={cn(cell, 'tnum')}>
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
                      ) : (
                        <span className='inline-block whitespace-pre-wrap break-words py-1.5'>
                          {m.title ?? <span className='text-fg-muted'>—</span>}
                        </span>
                      )}
                    </td>
                    <td className={cell}>{presenterCell('presenter1')}</td>
                    <td className={cell}>
                      {presenterCell('presenter2')}
                      {errors.presenter2 && <p className='mt-1 text-[11px] text-error-700'>{errors.presenter2}</p>}
                    </td>
                    {canEdit && (
                      <td className='border-t border-border px-3 py-1.5 text-right align-top'>
                        {past || kickoff ? (
                          <span
                            className='inline-block py-1.5 text-xs text-fg-muted'
                            title={kickoff ? '킥오프는 지울 수 없습니다' : '출석이 찍혀 있어 지울 수 없습니다'}
                          >
                            —
                          </span>
                        ) : (
                          <button
                            type='button'
                            data-anno='schedule:3-4'
                            aria-label={`${meetingLabel(m)} 삭제`}
                            onClick={() => setConfirmId(confirmId === m.id ? null : m.id)}
                            className='grid h-8 w-8 place-items-center rounded-control text-fg-muted hover:bg-surface-2 hover:text-error-700'
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
                if (confirmId !== m.id) return [row];
                return [
                  row,
                  <tr key={`${m.id}-confirm`} className='bg-error-50'>
                    <td colSpan={cols} className='px-4 pb-3'>
                      <div data-anno='schedule:3-5' className='flex flex-wrap items-center justify-between gap-2'>
                        <p className='text-[13px] text-error-700'>
                          {meetingLabel(m)}를 지울까요? 뒤 회차 번호는 하나씩 당겨집니다.
                        </p>
                        <span className='flex flex-wrap gap-1.5'>
                          <Button variant='ghost' size='sm' onClick={() => setConfirmId(null)}>
                            취소
                          </Button>
                          <Button variant='destructive' size='sm' onClick={() => remove(m)}>
                            삭제
                          </Button>
                        </span>
                      </div>
                    </td>
                  </tr>,
                ];
              })}
            </tbody>
          </table>
        </div>
      )}

      {canEdit && dirty && (
        <div data-anno='schedule:6' className='sticky bottom-0 z-10 flex items-center justify-end gap-2 bg-bg py-2'>
          {errorCount > 0 && <p className='mr-1 text-xs text-error-700'>고칠 칸 {errorCount}개</p>}
          <div className='flex items-center gap-1.5'>
            <Button variant='ghost' size='sm' onClick={clearDrafts}>
              변경 취소
            </Button>
            <Button size='sm' onClick={saveAll} disabled={errorCount > 0}>
              저장
            </Button>
          </div>
        </div>
      )}
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

function cn(...parts: string[]): string {
  return parts.join(' ');
}

const FIELD =
  'h-8 w-full rounded-control border bg-bg px-2 text-sm text-fg outline-none focus-visible:ring-2 focus-visible:ring-brand/60';

function CellInput({
  type = 'text',
  label,
  value,
  placeholder,
  error,
  onChange,
}: {
  type?: 'text' | 'date' | 'time';
  label: string;
  value: string;
  placeholder?: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  const errorId = useId();
  return (
    <div>
      <input
        type={type}
        aria-label={label}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        value={value}
        placeholder={placeholder}
        maxLength={type === 'text' ? TITLE_MAX + 10 : undefined}
        onChange={(ev) => onChange(ev.target.value)}
        className={cx(FIELD, error ? 'border-error-500' : 'border-border-strong')}
      />
      {error && (
        <p id={errorId} className='mt-1 text-[11px] leading-snug text-error-700'>
          {error}
        </p>
      )}
    </div>
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
    <div>
      <AutoTextarea
        label={label}
        value={value}
        placeholder='제목'
        maxLength={TITLE_MAX + 10}
        singleLine
        invalid={Boolean(error)}
        className='min-h-8 px-2 py-1 leading-snug'
        onChange={onChange}
      />
      {error && <p className='mt-1 text-[11px] leading-snug text-error-700'>{error}</p>}
    </div>
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
  people: Participant[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(ev) => onChange(ev.target.value)}
      className={cx(FIELD, 'border-border-strong', !value && 'text-fg-muted')}
    >
      <option value=''>{placeholder}</option>
      {/* 중단한 사람은 고를 수 없다. 이미 배정돼 있으면 그 칸에만 「(참여 종료)」로 남겨 보인다 — 빈 칸처럼 보이면 안 된다 */}
      {people
        .filter((p) => !p.left || p.id === value)
        .map((p) => (
          <option key={p.id} value={p.id} disabled={Boolean(p.left)}>
            {p.me ? `${p.name} (나)` : p.left ? `${p.name} (참여 종료)` : p.name}
          </option>
        ))}
    </select>
  );
}

/* ── 회차 추가 (반복 포함) ──────────────────────────────────────────────────── */

function AddForm({
  study,
  group,
  onCancel,
  onAdded,
}: {
  study: Study;
  group: NavigatorGroup;
  onCancel: () => void;
  onAdded: (label: string) => void;
}) {
  const [draft, setDraft] = useState<MeetingDraft>(() => ({
    date: defaultDate(meetingsOf(study), new Date().toISOString().slice(0, 10)),
    time: group.startAt,
    title: '',
    repeat: 'none',
    until: '',
    weekdays: [],
  }));
  const [errors, setErrors] = useState<DraftErrors>({});
  const [touched, setTouched] = useState(false);

  const existing = meetingsOf(study);
  const { errors: live, plan } = planDraft(draft, existing, group.timeZone);

  function change(patch: Partial<MeetingDraft>) {
    const next = { ...draft, ...patch };
    if (patch.repeat && patch.repeat !== 'none' && !next.until) next.until = defaultUntil(next.date, patch.repeat);
    // 매주를 처음 고르면 시작 날짜의 요일을 켜 둔다 — 빈 채로 두면 무엇을 눌러야 할지 모른다.
    if (patch.repeat === 'weekly' && next.weekdays.length === 0 && next.date) next.weekdays = [dowOf(next.date)];
    setDraft(next);
    // 한 번 막힌 뒤에는 고치는 즉시 문구가 풀려야 한다 — 다시 누를 때까지 빨간 채로 두지 않는다.
    if (touched) setErrors(planDraft(next, existing, group.timeZone).errors);
  }

  function submit() {
    setTouched(true);
    setErrors(live);
    if (!plan) return;
    const { from } = previewOf(plan, existing);
    addMeetings(study.id, { dates: plan.dates, time: draft.time, timeZone: group.timeZone, title: draft.title });
    const first = plan.dates[0];
    const last = plan.dates[plan.dates.length - 1];
    onAdded(
      plan.dates.length === 1
        ? `${from}회차 · ${wallLabel(zonedInstant(first, draft.time, group.timeZone), group.timeZone)}`
        : `회차 ${plan.dates.length}개 · ${dayLabel(first)} ~ ${dayLabel(last)} ${draft.time}`,
    );
  }

  const preview = plan ? previewOf(plan, existing) : undefined;
  const first = plan?.dates[0];
  const repeatOptions: { key: Repeat; label: string }[] = [
    { key: 'none', label: '반복 안 함' },
    { key: 'daily', label: '매일' },
    { key: 'weekly', label: '매주' },
  ];
  // 월요일부터 — 주간 일정과 같은 순서.
  const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

  function toggleWeekday(d: number) {
    const on = draft.weekdays.includes(d);
    change({ weekdays: on ? draft.weekdays.filter((x) => x !== d) : [...draft.weekdays, d].sort() });
  }

  return (
    <Modal
      open
      onClose={onCancel}
      title='회차 추가'
      description={`${group.name} · ${zoneTitle(group.timeZone)} 기준`}
      footer={
        <>
          <Button variant='secondary' onClick={onCancel}>
            취소
          </Button>
          <span data-anno='schedule:7-7'>
            <Button onClick={submit}>
              {plan && plan.dates.length > 1 ? `회차 ${plan.dates.length}개 추가` : '추가'}
            </Button>
          </span>
        </>
      }
    >
      <div data-anno='schedule:7' className='flex flex-col gap-4 py-2'>
        <div className='grid gap-3 sm:grid-cols-[10rem_8rem]'>
          <div data-anno='schedule:7-1'>
            <Input
              type='date'
              label={draft.repeat === 'none' ? '일자' : '시작 일자'}
              required
              value={draft.date}
              error={errors.date}
              onChange={(ev) => change({ date: ev.target.value })}
            />
          </div>
          <div data-anno='schedule:7-2'>
            <Input
              type='time'
              label={`시작 시각 (${zoneLabel(group.timeZone)})`}
              required
              value={draft.time}
              error={errors.time}
              onChange={(ev) => change({ time: ev.target.value })}
            />
          </div>
        </div>

        <div data-anno='schedule:7-3' className='flex flex-col gap-1.5'>
          <span className='text-sm font-medium text-neutral-800'>반복</span>
          <div role='group' aria-label='반복' className='flex flex-wrap gap-1.5'>
            {repeatOptions.map((o) => {
              const on = draft.repeat === o.key;
              return (
                <button
                  key={o.key}
                  type='button'
                  aria-pressed={on}
                  onClick={() => change({ repeat: o.key })}
                  className={cx(
                    'h-9 rounded-control border px-3 text-sm font-semibold transition-colors',
                    on
                      ? 'border-brand bg-brand text-white'
                      : 'border-border-strong bg-bg text-fg-secondary hover:bg-surface-2',
                  )}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
          {draft.repeat === 'weekly' && (
            <div data-anno='schedule:7-8' className='mt-1 flex flex-col gap-1'>
              <div role='group' aria-label='반복 요일' className='flex flex-wrap gap-1'>
                {WEEK_ORDER.map((d) => {
                  const on = draft.weekdays.includes(d);
                  return (
                    <button
                      key={d}
                      type='button'
                      aria-pressed={on}
                      aria-label={`${DOW_LABEL[d]}요일`}
                      onClick={() => toggleWeekday(d)}
                      className={cx(
                        'h-9 w-9 rounded-control border text-sm font-semibold transition-colors',
                        on
                          ? 'border-brand bg-brand text-white'
                          : 'border-border-strong bg-bg text-fg-secondary hover:bg-surface-2',
                      )}
                    >
                      {DOW_LABEL[d]}
                    </button>
                  );
                })}
              </div>
              {errors.weekdays && <p className='text-xs text-error-700'>{errors.weekdays}</p>}
            </div>
          )}
        </div>

        {draft.repeat !== 'none' && (
          <div data-anno='schedule:7-4' className='sm:max-w-[18rem]'>
            <Input
              type='date'
              label='종료일'
              labelHint={`이 날까지 · 시작부터 최대 ${REPEAT_SPAN_DAYS}일`}
              required
              min={draft.date}
              max={maxUntil(draft.date)}
              value={draft.until}
              error={errors.until}
              onChange={(ev) => change({ until: ev.target.value })}
            />
          </div>
        )}

        <div data-anno='schedule:7-5'>
          <Input
            label='제목'
            labelHint={`선택 · ${draft.title.trim().length}/${TITLE_MAX}`}
            placeholder={
              draft.repeat === 'none' ? '예: 3장 저장소와 검색' : '반복하면 모든 회차에 같은 제목이 붙습니다'
            }
            value={draft.title}
            error={errors.title}
            onChange={(ev) => change({ title: ev.target.value })}
          />
        </div>

        <div data-anno='schedule:7-6' className='rounded-control border border-border px-3.5 py-2.5 text-sm'>
          {plan && preview && first ? (
            <>
              <p className='font-bold text-fg'>
                {plan.dates.length === 1 ? (
                  <>
                    <span className='tnum'>{preview.from}</span>회차로 추가됩니다
                  </>
                ) : (
                  <>
                    회차 <span className='tnum'>{plan.dates.length}</span>개 ·{' '}
                    <span className='tnum'>
                      {preview.from}~{preview.to}
                    </span>
                    회차로 추가됩니다
                  </>
                )}
              </p>
              <ul className='mt-1 flex flex-col gap-0.5 text-xs text-fg-secondary'>
                {plan.dates.length > 1 && (
                  <li className='tnum'>
                    {dayLabel(first)} ~ {dayLabel(plan.dates[plan.dates.length - 1])}
                  </li>
                )}
                <li className='tnum'>
                  {plan.dates.length > 1 ? '첫 회차 ' : ''}KST{' '}
                  {scheduleLabel(zonedInstant(first, draft.time, group.timeZone), 'Asia/Seoul')} · PDT{' '}
                  {scheduleLabel(zonedInstant(first, draft.time, group.timeZone), 'America/Los_Angeles')}
                </li>
                {plan.skipped.length > 0 && (
                  <li className='text-warning-700'>
                    건너뜀 <b className='tnum'>{plan.skipped.length}</b>개 —{' '}
                    {plan.skipped.map((s) => `${dayLabel(s.date)} ${s.reason}`).join(', ')}
                  </li>
                )}
                {preview.shifted > 0 && (
                  <li>
                    기존 회차 <b className='tnum'>{preview.shifted}</b>개의 번호가 뒤로 밀립니다.
                  </li>
                )}
                {preview.extendsTo && <li>마지막 회차 뒤라 스터디 기간이 {preview.extendsTo}까지 늘어납니다.</li>}
              </ul>
            </>
          ) : touched && errors.form ? (
            <p className='font-medium text-error-700'>{errors.form}</p>
          ) : (
            <p className='text-fg-muted'>
              일자와 시작 시각을 정하면 몇 회차가 되는지 보여 드립니다. 반복은 시작부터 {REPEAT_SPAN_DAYS}일까지.
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}
