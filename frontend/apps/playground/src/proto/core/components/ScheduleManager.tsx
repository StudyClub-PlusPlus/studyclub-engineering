'use client';

import { useState } from 'react';

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
  kstInstant,
  maxUntil,
  planDraft,
  previewOf,
  scheduleLabel,
  updateMeeting,
  validateEdit,
  zoneLabel,
  wallLabel,
  type DraftErrors,
  type MeetingDraft,
  type NavigatorGroup,
  type ProtoMeeting,
  type Repeat,
} from '@core/lib/meetings';
import type { Study } from '@studyclub/mock';
import { Button, Input, Modal, cx } from '@studyclub/ui';
import { Pencil, Plus, Trash2 } from 'lucide-react';

/**
 * 일정 — 맡은 분반의 회차를 더하고, 고치고, 지운다.
 *
 * 받는 것은 예정 시각(SCHEDULED_AT)과 표시용 제목뿐이다. 실제 시작·종료(START_AT·END_AT)는
 * 보이스룸에서 `/StudyStart` 로 열 때 기록된다.
 * 이미 시작한 회차(화면에선 「종료」)는 고치거나 지우지 않는다 — 출석이 찍혀 있다.
 */
export function ScheduleManager({ study, group }: { study: Study; group: NavigatorGroup }) {
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  /** 목록의 일정을 어느 시간대로 보일지. 처음엔 분반 시간대 — 탭에 없는 시간대면 KST. */
  const [zone, setZone] = useState<string>(
    DISPLAY_ZONES.some((z) => z.iana === group.timeZone) ? group.timeZone : DISPLAY_ZONES[0].iana,
  );
  /** 저장소가 localStorage 라 렌더 트리거가 없다 — 바꿀 때마다 올려 다시 읽는다. */
  const [, setRev] = useState(0);
  const refresh = () => setRev((n) => n + 1);

  const now = Date.now();
  const meetings = meetingsOf(study);
  const started = (m: ProtoMeeting) => meetingWindow(study, m).start.getTime() <= now;
  const upcomingCount = meetings.filter((m) => !started(m)).length;

  /** 반복 묶음을 저장하지 않으므로 한 회차씩만 지운다. */
  function remove(target: ProtoMeeting) {
    deleteMeetings(study.id, [target.id]);
    setDone(`${target.no}회차(${dayLabel(target.date)})를 지웠습니다.`);
    setConfirmId(null);
    refresh();
  }

  return (
    <div className='flex flex-col gap-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <h2 data-anno='schedule:1' className='text-[15px] font-bold'>
          회차
          <span className='ml-2 text-[13px] font-medium text-fg-muted'>
            전체 {meetings.length} · 예정 {upcomingCount}
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
          <span data-anno='schedule:2'>
            <Button
              size='sm'
              leadingIcon={<Plus size={15} />}
              onClick={() => {
                setAdding(true);
                setEditId(null);
                setConfirmId(null);
                setDone(null);
              }}
            >
              회차 추가
            </Button>
          </span>
        </div>
      </div>

      {done && (
        <p
          data-anno='schedule:5'
          role='status'
          className='rounded-control bg-success-50 px-3 py-2 text-sm font-semibold text-success-700'
        >
          {done}
        </p>
      )}

      {adding && (
        <AddForm
          study={study}
          group={group}
          onCancel={() => setAdding(false)}
          onAdded={(label) => {
            setAdding(false);
            setDone(`회차를 추가했습니다 — ${label}`);
            refresh();
          }}
        />
      )}

      {meetings.length === 0 ? (
        <p className='card px-6 py-10 text-center text-sm text-fg-muted'>
          아직 회차가 없습니다. 「회차 추가」로 만드세요.
        </p>
      ) : (
        <div data-anno='schedule:3' className='card overflow-x-auto'>
          <table className='w-full min-w-[36rem] border-separate border-spacing-0 text-sm'>
            <thead>
              <tr className='text-left text-xs font-semibold text-fg-muted'>
                <th className='w-16 px-4 py-3'>회차</th>
                <th className='px-3 py-3'>일정</th>
                <th className='px-3 py-3'>제목</th>
                <th className='w-24 px-3 py-3'>상태</th>
                <th className='w-24 px-3 py-3 text-right'>관리</th>
              </tr>
            </thead>
            <tbody>
              {meetings
                .map((m) => {
                  const past = started(m);
                  const start = meetingWindow(study, m).start;
                  if (editId === m.id) {
                    return (
                      <tr key={m.id}>
                        <td colSpan={5} className='border-t border-border bg-surface-1 px-4 py-3'>
                          <EditRow
                            study={study}
                            group={group}
                            meeting={m}
                            existing={meetings}
                            onCancel={() => setEditId(null)}
                            onSaved={(label) => {
                              setEditId(null);
                              setDone(`${label}로 고쳤습니다.`);
                              refresh();
                            }}
                          />
                        </td>
                      </tr>
                    );
                  }
                  return (
                    <tr key={m.id} className={cx(past && 'text-fg-muted', confirmId === m.id && 'bg-error-50')}>
                      <td className='tnum border-t border-border px-4 py-2.5 font-bold'>{m.no}</td>
                      <td className='tnum border-t border-border px-3 py-2.5'>{scheduleLabel(start, zone)}</td>
                      <td className='border-t border-border px-3 py-2.5'>
                        {m.title ?? <span className='text-fg-muted'>—</span>}
                      </td>
                      <td className='border-t border-border px-3 py-2.5'>
                        <span
                          data-anno='schedule:3-2'
                          className={cx(
                            'rounded-pill px-2 py-0.5 text-xs font-bold',
                            past ? 'bg-surface-2 text-fg-muted' : 'bg-brand-subtle text-brand',
                          )}
                        >
                          {past ? '종료' : '예정'}
                        </span>
                      </td>
                      <td className='border-t border-border px-3 py-2.5 text-right'>
                        {past ? (
                          <span className='text-xs text-fg-muted' title='출석이 찍혀 있어 고치거나 지울 수 없습니다'>
                            —
                          </span>
                        ) : (
                          <span className='inline-flex gap-0.5'>
                            <button
                              type='button'
                              data-anno='schedule:3-3'
                              aria-label={`${m.no}회차 수정`}
                              onClick={() => {
                                setEditId(m.id);
                                setConfirmId(null);
                                setAdding(false);
                                setDone(null);
                              }}
                              className='grid h-8 w-8 place-items-center rounded-control text-fg-muted hover:bg-surface-2 hover:text-fg'
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type='button'
                              data-anno='schedule:3-4'
                              aria-label={`${m.no}회차 삭제`}
                              onClick={() => setConfirmId(confirmId === m.id ? null : m.id)}
                              className='grid h-8 w-8 place-items-center rounded-control text-fg-muted hover:bg-surface-2 hover:text-error-700'
                            >
                              <Trash2 size={14} />
                            </button>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
                .flatMap((row, i) => {
                  const m = meetings[i];
                  if (confirmId !== m.id) return [row];
                  return [
                    row,
                    <tr key={`${m.id}-confirm`} className='bg-error-50'>
                      <td colSpan={5} className='px-4 pb-3'>
                        <div data-anno='schedule:3-5' className='flex flex-wrap items-center justify-between gap-2'>
                          <p className='text-[13px] text-error-700'>
                            {m.no}회차를 지울까요? 뒤 회차 번호는 하나씩 당겨집니다.
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

      <p data-anno='schedule:4' className='text-xs text-fg-muted'>
        종료된 회차는 출석 기록이 있어 고치거나 지울 수 없습니다. 회차 번호는 일정순으로 매겨져, 더하거나 지우면 다시
        매겨집니다.
      </p>
    </div>
  );
}

/* ── 회차 수정 (한 줄) ─────────────────────────────────────────────────────── */

function EditRow({
  study,
  group,
  meeting,
  existing,
  onCancel,
  onSaved,
}: {
  study: Study;
  group: NavigatorGroup;
  meeting: ProtoMeeting;
  existing: ProtoMeeting[];
  onCancel: () => void;
  onSaved: (label: string) => void;
}) {
  const [edit, setEdit] = useState({
    date: meeting.date,
    time: meeting.time ?? fmtClock(meetingWindow(study, meeting).start),
    title: meeting.title ?? '',
  });
  const [errors, setErrors] = useState<DraftErrors>({});
  const [touched, setTouched] = useState(false);

  function change(patch: Partial<typeof edit>) {
    const next = { ...edit, ...patch };
    setEdit(next);
    if (touched) setErrors(validateEdit(next, meeting.id, existing));
  }

  function save() {
    setTouched(true);
    const found = validateEdit(edit, meeting.id, existing);
    setErrors(found);
    if (Object.keys(found).length) return;
    updateMeeting(study.id, meeting.id, edit);
    onSaved(`${meeting.no}회차를 ${dayLabel(edit.date)} ${edit.time}`);
  }

  return (
    <div data-anno='schedule:6' className='flex flex-col gap-3'>
      <p className='text-sm font-bold text-fg'>{meeting.no}회차 수정</p>
      <div className='grid gap-3 sm:grid-cols-[10rem_8rem_1fr]'>
        <Input
          type='date'
          label='일자'
          required
          value={edit.date}
          error={errors.date}
          onChange={(ev) => change({ date: ev.target.value })}
        />
        <Input
          type='time'
          label={`시작 시각 (${zoneLabel(group.timeZone)})`}
          required
          value={edit.time}
          error={errors.time}
          onChange={(ev) => change({ time: ev.target.value })}
        />
        <Input
          label='제목'
          labelHint={`선택 · ${edit.title.trim().length}/${TITLE_MAX}`}
          value={edit.title}
          error={errors.title}
          onChange={(ev) => change({ title: ev.target.value })}
        />
      </div>
      <p className='text-xs text-fg-muted'>
        일자 및 시작 시간을 수정하면 일정 순서대로 회차가 다시 매겨질 수 있습니다.
      </p>
      <div className='flex justify-end gap-2'>
        <Button variant='secondary' size='sm' onClick={onCancel}>
          취소
        </Button>
        <Button size='sm' onClick={save}>
          저장
        </Button>
      </div>
    </div>
  );
}

function fmtClock(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
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
  const { errors: live, plan } = planDraft(draft, existing);

  function change(patch: Partial<MeetingDraft>) {
    const next = { ...draft, ...patch };
    if (patch.repeat && patch.repeat !== 'none' && !next.until) next.until = defaultUntil(next.date, patch.repeat);
    // 매주를 처음 고르면 시작 날짜의 요일을 켜 둔다 — 빈 채로 두면 무엇을 눌러야 할지 모른다.
    if (patch.repeat === 'weekly' && next.weekdays.length === 0 && next.date) next.weekdays = [dowOf(next.date)];
    setDraft(next);
    // 한 번 막힌 뒤에는 고치는 즉시 문구가 풀려야 한다 — 다시 누를 때까지 빨간 채로 두지 않는다.
    if (touched) setErrors(planDraft(next, existing).errors);
  }

  function submit() {
    setTouched(true);
    setErrors(live);
    if (!plan) return;
    const { from } = previewOf(plan, existing);
    addMeetings(study.id, { dates: plan.dates, time: draft.time, title: draft.title });
    const first = plan.dates[0];
    const last = plan.dates[plan.dates.length - 1];
    onAdded(
      plan.dates.length === 1
        ? `${from}회차 · ${wallLabel(kstInstant(first, draft.time), group.timeZone)}`
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
      description={`${group.name} · 한국 시간(KST) 기준`}
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
                  {scheduleLabel(kstInstant(first, draft.time), 'Asia/Seoul')} · PDT{' '}
                  {scheduleLabel(kstInstant(first, draft.time), 'America/Los_Angeles')}
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
