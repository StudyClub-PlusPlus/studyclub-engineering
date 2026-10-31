'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import type { Study } from '@studyclub/mock';
import { Button, Input, Modal, Select, SelectionCount, TableActionBar, cx } from '@studyclub/ui';
import { Mic, Plus, X } from 'lucide-react';

import { ApiError } from '@/lib/http';
import { apiMeetingsOf, meetingRows } from '@/lib/joined-detail';
import {
  createStudyMeetings,
  deleteStudyMeetings,
  registerPresenter,
  unregisterPresenter,
  updateStudyMeeting,
  type ApiAttendance,
  type ApiMeetingList,
} from '@/lib/joined-detail-api';
import {
  dateWithDow,
  dayLabel,
  defaultUntil,
  initialMeetingDraft,
  wallInputErrors,
  wallTimeChoices,
  resolveWallInput,
  DOW_LABEL,
  dowOf,
  isKickoff,
  maxUntil,
  meetingLabel,
  planDraft,
  previewOf,
  REPEAT_SPAN_DAYS,
  TITLE_MAX,
  validateEdit,
  wallParts,
  zonedInstant,
  zoneLabel,
  zoneTitle,
  type DraftErrors,
  type MeetingDraft,
  type NavigatorGroup,
  type ProtoMeeting,
  type Repeat,
} from '@/lib/meetings';
import { SCHEDULE_ZONES, scheduleZoneTitle } from '@/lib/schedule-timezone';
import { useDisplayTimeZone } from '@/lib/use-display-timezone';

const CHECKBOX =
  'h-4 w-4 shrink-0 cursor-pointer rounded-xs border-border-strong accent-(--color-brand) focus-visible:outline-none focus-visible:shadow-(--ring)';

function PresenterCell({
  label,
  slotValue,
  otherValue,
  myParticipantId,
  people,
  started,
  onSign,
}: {
  label: string;
  slot: 1 | 2;
  slotValue: string;
  otherValue: string;
  myParticipantId: number | null;
  people: { id: string; name: string; displayName?: string; left?: boolean }[];
  started: boolean;
  onSign: (on: boolean) => void;
}) {
  const myId = myParticipantId != null ? String(myParticipantId) : null;
  const person = slotValue ? people.find((p) => p.id === slotValue) : null;
  const rawName = person?.displayName ?? person?.name ?? slotValue;
  const name = slotValue ? (person?.left ? `${rawName} (참여 종료)` : rawName) : null;
  const isMeWithdrawn = Boolean(myId && people.find((p) => p.id === myId)?.left);

  if (!started && myId && !isMeWithdrawn) {
    if (!slotValue && otherValue !== myId) {
      return (
        <button
          type='button'
          aria-label={`${label} 신청`}
          onClick={() => onSign(true)}
          className='inline-flex h-7 w-full items-center justify-center rounded-pill border border-brand type-label-lg text-brand transition-colors hover:bg-brand-subtle'
        >
          신청
        </button>
      );
    }
    if (slotValue === myId) {
      return (
        <span className='relative inline-flex h-7 w-full min-w-0 items-center rounded-pill bg-brand-subtle px-1 type-label-sm text-brand'>
          <span className='flex-1 truncate text-center'>{name}</span>
          <button
            type='button'
            aria-label={`${label} 신청 취소`}
            title='신청 취소'
            onClick={() => onSign(false)}
            className='grid h-5 w-5 shrink-0 place-items-center rounded-full hover:bg-brand hover:text-on-brand'
          >
            <X size={11} strokeWidth={2.5} aria-hidden />
          </button>
        </span>
      );
    }
  }

  return name ? (
    <span className='inline-flex items-center gap-1'>
      <Mic size={12} aria-hidden />
      {name}
    </span>
  ) : (
    <span className='block text-center text-fg-muted'>-</span>
  );
}

type PendingMeeting = { id: string; date: string; time: string; title: string; scheduledAt: string };

function AddMeetingForm({
  group,
  inputZone,
  existing,
  onClose,
  onAdded,
}: {
  group: NavigatorGroup;
  inputZone: string;
  existing: ProtoMeeting[];
  onClose: () => void;
  onAdded: (input: { scheduledAts: string[]; title: string }) => void;
}) {
  const [draft, setDraft] = useState<MeetingDraft>(() => initialMeetingDraft(group, existing, inputZone));
  const [errors, setErrors] = useState<DraftErrors>({});
  const [touched, setTouched] = useState(false);

  const { errors: live, plan, ambiguousTimes = [] } = planDraft(draft, existing, inputZone, new Date(), group.timeZone);

  function change(patch: Partial<MeetingDraft>) {
    const next = { ...draft, ...patch };
    if (patch.time !== undefined && patch.time !== draft.time) next.occurrences = {};
    if (patch.repeat && patch.repeat !== 'none' && !next.until) next.until = defaultUntil(next.date, patch.repeat);
    if (patch.repeat === 'weekly' && next.weekdays.length === 0 && next.date) next.weekdays = [dowOf(next.date)];
    setDraft(next);
    if (touched) setErrors(planDraft(next, existing, inputZone, new Date(), group.timeZone).errors);
  }

  function submit() {
    setTouched(true);
    setErrors(live);
    if (!plan) return;
    onAdded({ scheduledAts: plan.scheduledAts, title: draft.title.trim() });
  }

  const preview = plan
    ? previewOf(
        {
          ...plan,
          dates: plan.scheduledAts.map((at) => wallParts(new Date(at), group.timeZone).date),
        },
        existing,
      )
    : undefined;
  if (preview?.extendsTo && plan) preview.extendsTo = plan.dates[plan.dates.length - 1];
  const first = plan?.dates[0];
  const firstInstant = plan ? new Date(plan.scheduledAts[0]) : undefined;
  const repeatOptions: { key: Repeat; label: string }[] = [
    { key: 'none', label: '반복 안 함' },
    { key: 'daily', label: '매일' },
    { key: 'weekly', label: '매주' },
  ];
  const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

  function toggleWeekday(d: number) {
    const on = draft.weekdays.includes(d);
    change({ weekdays: on ? draft.weekdays.filter((x) => x !== d) : [...draft.weekdays, d].sort() });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title='회차 추가'
      description={`${group.name} · 내 시간대: ${zoneTitle(inputZone, firstInstant)}`}
      footer={
        <>
          <Button variant='secondary' onClick={onClose}>
            취소
          </Button>
          <Button
            onClick={submit}
            disabled={
              Boolean(live.until) ||
              ambiguousTimes.some(
                ({ date, choices }) => !choices.some((choice) => choice.scheduledAt === draft.occurrences?.[date]),
              )
            }
          >
            {plan && plan.dates.length > 1 ? `회차 ${plan.dates.length}개 추가` : '추가'}
          </Button>
        </>
      }
    >
      <div className='flex flex-col gap-4 py-2'>
        <div className='grid gap-3 sm:grid-cols-[10rem_8rem]'>
          <Input
            type='date'
            label={draft.repeat === 'none' ? '일자' : '시작 일자'}
            required
            value={draft.date}
            error={errors.date}
            onChange={(ev) => change({ date: ev.target.value })}
          />
          <Input
            type='time'
            label={`시작 시각 (${zoneLabel(inputZone, firstInstant)})`}
            required
            value={draft.time}
            error={errors.time}
            onChange={(ev) => change({ time: ev.target.value })}
          />
        </div>

        {ambiguousTimes.map(({ date, choices }) => (
          <Select
            key={date}
            label={`${date} 시각 구분`}
            helper='이날은 같은 시각이 두 번 있어요. 시계 전환 전후 중 하나를 선택해 주세요.'
            value={choices.some((c) => c.scheduledAt === draft.occurrences?.[date]) ? draft.occurrences![date] : ''}
            onChange={(e) => change({ occurrences: { ...draft.occurrences, [date]: e.target.value } })}
          >
            <option value='' disabled>
              시각을 선택해 주세요
            </option>
            {choices.map((choice) => (
              <option key={choice.scheduledAt} value={choice.scheduledAt}>
                {choice.label}
              </option>
            ))}
          </Select>
        ))}

        <div className='flex flex-col gap-1.5'>
          <span className='type-label-lg text-ink'>반복</span>
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
                    'h-9 rounded-control border px-3 type-label-lg transition-colors',
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
            <div className='mt-1 flex flex-col gap-1'>
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
                        'h-9 w-9 rounded-control border type-label-lg transition-colors',
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
              {errors.weekdays && <p className='type-label-sm text-error-700'>{errors.weekdays}</p>}
            </div>
          )}
        </div>

        {draft.repeat !== 'none' && (
          <div className='sm:max-w-[18rem]'>
            <Input
              type='date'
              label='종료일'
              labelHint={`이 날까지 · 시작부터 최대 ${REPEAT_SPAN_DAYS}일`}
              required
              min={draft.date}
              max={maxUntil(draft.date)}
              value={draft.until}
              error={live.until ?? errors.until}
              onChange={(ev) => change({ until: ev.target.value })}
            />
          </div>
        )}

        <Input
          label='제목'
          labelHint={`선택 · ${draft.title.trim().length}/${TITLE_MAX}`}
          placeholder={draft.repeat === 'none' ? '예: 3장 저장소와 검색' : '반복하면 모든 회차에 같은 제목이 붙습니다'}
          value={draft.title}
          error={errors.title}
          onChange={(ev) => change({ title: ev.target.value })}
        />

        <div className='rounded-control border border-border px-3.5 py-2.5 type-body-sm'>
          {plan && preview && first ? (
            <>
              <p className='font-semibold text-fg'>
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
              <ul className='mt-1 flex flex-col gap-0.5 type-label-sm text-fg-secondary'>
                {plan.dates.length > 1 && (
                  <li className='tnum'>
                    {dayLabel(first)} ~ {dayLabel(plan.dates[plan.dates.length - 1]!)}
                  </li>
                )}
                <li className='tnum'>
                  {plan.dates.length > 1 ? '첫 회차 ' : ''}
                  {first}
                </li>
                <li className='grid grid-cols-1 gap-x-4 gap-y-1 min-[400px]:grid-cols-2'>
                  {SCHEDULE_ZONES.map(({ iana }) => {
                    const at = firstInstant!;
                    const local = wallParts(at, iana);
                    const shift = Math.round((Date.parse(local.date) - Date.parse(first)) / 86_400_000);
                    const day = shift === -1 ? '전날 ' : shift === 1 ? '다음 날 ' : shift ? `${local.date} ` : '';
                    return (
                      <span key={iana} className='tnum'>
                        {zoneTitle(iana, at)} {day}
                        {local.time}
                      </span>
                    );
                  })}
                </li>
                {plan.skipped.length > 0 && (
                  <li className='text-warning-700'>
                    건너뜀 <b className='tnum'>{plan.skipped.length}</b>개:{' '}
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
            <p className='font-semibold text-error-700'>{errors.form}</p>
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

export function ScheduleTab({
  study,
  group,
  groupId,
  meetingData,
  attendanceData,
  refetchMeetings,
  canEdit,
  onDirty,
}: {
  study: Study;
  group: NavigatorGroup;
  groupId: number;
  meetingData?: ApiMeetingList;
  attendanceData?: ApiAttendance;
  refetchMeetings: () => Promise<unknown>;
  canEdit: boolean;
  onDirty: (value: boolean) => void;
}) {
  const headerScrollRef = useRef<HTMLDivElement>(null);
  const bodyScrollRef = useRef<HTMLDivElement>(null);
  const myParticipantId = meetingData?.me.participantId ?? null;
  const viewerZone = useDisplayTimeZone();
  const [inputZone, setInputZone] = useState<string | null>(null);
  const zone = canEdit ? (inputZone ?? viewerZone) : viewerZone;
  const [incompleteWalls, setIncompleteWalls] = useState<Record<string, { date: string; time: string }>>({});
  const [adding, setAdding] = useState(false);
  const [, setRevision] = useState(0);
  const [drafts, setDrafts] = useState<
    Record<
      string,
      { date: string; time: string; title: string; presenter1: string; presenter2: string; scheduledAt?: string }
    >
  >({});
  const [pendingAdds, setPendingAdds] = useState<PendingMeeting[]>([]);
  /** 체크박스로 고른 삭제 대상 회차 ID */
  const [checked, setChecked] = useState<Set<string>>(() => new Set());
  /** 「삭제」를 눌렀을 때 뜨는 확인 모달 */
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [announce, setAnnounce] = useState<string | null>(null);
  /** 저장 · 삭제 요청 중 — 두 번 눌러 회차가 두 번 생기지 않게 잠근다. */
  const [saving, setSaving] = useState(false);

  const apiMeetings = apiMeetingsOf(meetingData, group);
  const pendingMeetings: ProtoMeeting[] = pendingAdds.map((m) => ({
    id: m.id,
    no: 0,
    date: m.date,
    time: m.time,
    title: m.title,
    scheduledAt: m.scheduledAt,
  }));
  const meetings = meetingRows([...apiMeetings, ...pendingMeetings]);
  const pendingIds = new Set(pendingAdds.map((m) => m.id));
  const people = useMemo(() => {
    const withdrawnIds = new Set<string>();
    for (const p of attendanceData?.participants ?? []) {
      if (p.leftAt || p.participantStatus === 'WITHDRAWN') {
        withdrawnIds.add(String(p.participantId));
      }
    }
    for (const m of meetingData?.meetings ?? []) {
      if (m.presenter1 && !m.presenter1.active) {
        withdrawnIds.add(String(m.presenter1.participantId));
      }
      if (m.presenter2 && !m.presenter2.active) {
        withdrawnIds.add(String(m.presenter2.participantId));
      }
    }

    const myId = myParticipantId != null ? String(myParticipantId) : null;
    const list: Array<{
      id: string;
      name: string;
      displayName: string;
      discordNickname?: string | null;
      me?: boolean;
      left?: boolean;
    }> = (meetingData?.participants ?? []).map((p) => {
      const pid = String(p.participantId);
      const isLeft = Boolean(p.left || p.active === false || withdrawnIds.has(pid));
      return {
        id: pid,
        name: p.name,
        displayName: p.name,
        discordNickname: p.discordNickname ?? null,
        me: pid === myId,
        left: isLeft,
      };
    });

    for (const p of attendanceData?.participants ?? []) {
      const pid = String(p.participantId);
      if (!list.some((item) => item.id === pid)) {
        list.push({
          id: pid,
          name: p.displayName,
          displayName: p.displayName,
          discordNickname: null,
          me: pid === myId,
          left: Boolean(p.leftAt || p.participantStatus === 'WITHDRAWN'),
        });
      }
    }

    for (const m of meetingData?.meetings ?? []) {
      for (const pres of [m.presenter1, m.presenter2]) {
        if (!pres) continue;
        const pid = String(pres.participantId);
        if (!list.some((item) => item.id === pid)) {
          list.push({
            id: pid,
            name: pres.name,
            displayName: pres.name,
            discordNickname: null,
            me: pid === myId,
            left: !pres.active || withdrawnIds.has(pid),
          });
        }
      }
    }

    // 이름이 겹치는 참가자는 디스코드 닉네임을 붙여 가른다 (spec 9)
    const rawNames = list.map((p) => p.name);
    const isDup = (name: string) => rawNames.filter((n) => n === name).length > 1;
    for (const p of list) {
      if (isDup(p.name)) {
        p.displayName = p.discordNickname ? `${p.name} (${p.discordNickname})` : p.name;
      }
    }

    return list;
  }, [meetingData, attendanceData, myParticipantId]);
  /**
   * 회차가 시작했는지 — 저장된 일자 · 시각을 반 시간대 벽시계로 읽는다.
   * `new Date('yyyy-MM-ddTHH:mm')` 는 브라우저 시간대로 읽혀 PDT 사용자가 KST 반을 보면 16시간 어긋난다.
   * 고치는 중인 값(draft)이 아니라 저장된 값으로 본다 — 일자를 지난날로 고치는 순간 칸이 잠기면 안 된다.
   */
  const startedOf = (m: ProtoMeeting) =>
    meetingData?.meetings.find((row) => String(row.id) === m.id)?.started ||
    new Date(m.scheduledAt ?? zonedInstant(m.date, m.time ?? group.startAt, group.timeZone).toISOString()) <=
      new Date();
  const instantOf = (m: ProtoMeeting) =>
    new Date(
      drafts[m.id]?.scheduledAt ??
        m.scheduledAt ??
        zonedInstant(m.date, m.time ?? group.startAt, group.timeZone).toISOString(),
    );

  const value = (m: ProtoMeeting) =>
    drafts[m.id] ?? {
      date: m.date,
      time: m.time ?? group.startAt,
      title: m.title ?? (isKickoff(m) ? '킥오프' : ''),
      presenter1: m.presenter1 ?? '',
      presenter2: m.presenter2 ?? '',
    };
  const dirty = Object.keys(drafts).length > 0 || pendingAdds.length > 0;
  const changedIds = Object.keys(drafts).filter((id) => meetings.some((m) => m.id === id));
  const projected = meetings.map((m) => (drafts[m.id] ? { ...m, date: drafts[m.id]!.date } : m));

  const errorsOf = (m: ProtoMeeting): DraftErrors & { presenter2?: string } => {
    const d = drafts[m.id];
    if (!d) return {};
    const base = validateEdit(
      { date: d.date, time: d.time, title: d.title, scheduledAt: d.scheduledAt ?? m.scheduledAt },
      m.id,
      projected,
      group.timeZone,
    );
    const same =
      d.presenter1 && d.presenter1 === d.presenter2 ? { presenter2: '발표자1과 다른 사람을 골라 주세요.' } : {};
    return {
      ...base,
      ...same,
      ...(incompleteWalls[m.id] ? wallInputErrors(incompleteWalls[m.id].date, incompleteWalls[m.id].time, zone) : {}),
    };
  };

  const errorCount = changedIds.reduce((n, id) => {
    const m = meetings.find((x) => x.id === id);
    if (!m) return n;
    return n + Object.keys(errorsOf(m)).length;
  }, 0);

  useEffect(() => onDirty(dirty), [dirty, onDirty]);

  useEffect(() => {
    const body = bodyScrollRef.current;
    const header = headerScrollRef.current;
    if (!body || !header) return;
    const sync = () => {
      header.scrollLeft = body.scrollLeft;
    };
    body.addEventListener('scroll', sync);
    return () => body.removeEventListener('scroll', sync);
  }, []);
  const update = (m: ProtoMeeting, patch: Partial<(typeof drafts)[string]>) =>
    setDrafts((cur) => ({ ...cur, [m.id]: { ...value(m), ...patch } }));

  function shownWall(m: ProtoMeeting): { date: string; time: string } {
    return incompleteWalls[m.id] ?? wallParts(instantOf(m), zone);
  }

  function changeWall(m: ProtoMeeting, patch: { date?: string; time?: string }, selectedAt?: string) {
    setInputZone(zone);
    const nextShown = { ...shownWall(m), ...patch };
    const resolved = resolveWallInput(nextShown.date, nextShown.time, zone, [
      selectedAt,
      drafts[m.id]?.scheduledAt,
      m.scheduledAt,
    ]);
    if (!resolved.instant) {
      setIncompleteWalls((cur) => ({ ...cur, [m.id]: nextShown }));
      update(m, {});
      return;
    }
    setIncompleteWalls((cur) => {
      const next = { ...cur };
      delete next[m.id];
      return next;
    });
    const at = resolved.instant;
    update(m, { ...wallParts(at, group.timeZone), scheduledAt: at.toISOString() });
  }

  async function sign(m: ProtoMeeting, slot: 1 | 2, on: boolean) {
    const id = Number(m.id);
    const which = `발표자${slot}`;
    try {
      if (on) {
        await registerPresenter(Number(study.id), id, slot);
      } else {
        await unregisterPresenter(Number(study.id), id, slot);
      }
      setNotice(null);
      setAnnounce(
        on ? `${meetingLabel(m)} ${which}로 신청했습니다.` : `${meetingLabel(m)} ${which} 신청을 취소했습니다.`,
      );
    } catch {
      setNotice(`방금 다른 크루가 ${meetingLabel(m)} ${which}로 신청했습니다.`);
    }
    await refetchMeetings();
  }

  /** 킥오프·시작한 회차는 체크박스 없음 — 출석이 걸려 있어 지우지 않는다 */
  const deletable = canEdit
    ? meetings.filter((m) => {
        return !isKickoff(m) && !startedOf(m);
      })
    : [];
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

  async function remove() {
    if (saving) return;
    setBulkConfirm(false);
    const ids = picked.map((m) => m.id);
    setIncompleteWalls((cur) => Object.fromEntries(Object.entries(cur).filter(([id]) => !ids.includes(id))));
    // pending은 로컬에서만 제거, 저장된 것은 API 삭제
    const [localIds, apiIds] = ids.reduce<[string[], string[]]>(
      ([l, a], id) => (pendingIds.has(id) ? [[...l, id], a] : [l, [...a, id]]),
      [[], []],
    );
    if (localIds.length > 0) {
      setPendingAdds((cur) => cur.filter((m) => !localIds.includes(m.id)));
      setDrafts((cur) => {
        const next = { ...cur };
        for (const id of localIds) delete next[id];
        return next;
      });
    }
    if (apiIds.length > 0) {
      setSaving(true);
      try {
        await deleteStudyMeetings(Number(study.id), groupId, apiIds.map(Number));
      } catch (e) {
        // 409 는 막힌 회차 번호를 적어 준다 — 아무것도 지워지지 않았으니 목록을 다시 받아 시작한 줄을 잠근다
        setNotice(
          e instanceof ApiError && e.status === 409
            ? e.message
            : '회차를 지우지 못했습니다. 잠시 뒤 다시 시도해 주세요.',
        );
        await refetchMeetings();
        setSaving(false);
        return;
      }
      await refetchMeetings();
      setSaving(false);
    }
    setChecked(new Set());
    setAnnounce(
      picked.length === 1 ? `${meetingLabel(picked[0]!)}를 지웠습니다.` : `회차 ${picked.length}개를 지웠습니다.`,
    );
    setRevision((n) => n + 1);
  }

  const save = async () => {
    if (saving || errorCount > 0) return;
    setSaving(true);
    setNotice(null);
    const pendingByTitle = new Map<string, PendingMeeting[]>();
    pendingAdds.forEach((m) => {
      const draft = drafts[m.id];
      const cur = pendingByTitle.get(draft?.title ?? m.title) ?? [];
      cur.push({
        ...m,
        ...(draft
          ? { date: draft.date, time: draft.time, title: draft.title, scheduledAt: draft.scheduledAt ?? m.scheduledAt }
          : {}),
      });
      pendingByTitle.set(draft?.title ?? m.title, cur);
    });
    try {
      if (pendingByTitle.size > 0) {
        await Promise.all(
          [...pendingByTitle.entries()].map(([title, rows]) =>
            createStudyMeetings(Number(study.id), {
              studyGroupId: groupId,
              scheduledAts: rows.map((r) => r.scheduledAt),
              title: title || undefined,
            }),
          ),
        );
        // 만든 회차는 바로 비운다 — 뒤의 수정이 실패해 다시 저장해도 같은 회차를 또 만들지 않게
        setPendingAdds([]);
        setDrafts((cur) => Object.fromEntries(Object.entries(cur).filter(([id]) => !pendingIds.has(id))));
      }
      await Promise.all(
        Object.entries(drafts)
          .filter(([id]) => !pendingIds.has(id))
          .map(([id, draft]) =>
            updateStudyMeeting(Number(study.id), Number(id), {
              scheduledAt: draft.scheduledAt ?? apiMeetings.find((m) => m.id === id)!.scheduledAt!,
              title: draft.title,
              presenter1ParticipantId: draft.presenter1 ? Number(draft.presenter1) : null,
              presenter2ParticipantId: draft.presenter2 ? Number(draft.presenter2) : null,
            }),
          ),
      );
    } catch {
      // 고친 값은 그대로 두어 다시 저장할 수 있게 한다. 이미 반영된 것이 있을 수 있어 목록은 다시 읽는다
      setNotice('일정을 저장하지 못했습니다. 잠시 뒤 다시 저장해 주세요.');
      await refetchMeetings();
      setSaving(false);
      return;
    }
    await refetchMeetings();
    setDrafts({});
    setIncompleteWalls({});
    setPendingAdds([]);
    setAnnounce(meetings.length === 1 ? '회차를 저장했습니다.' : `회차 ${meetings.length}개를 저장했습니다.`);
    setRevision((n) => n + 1);
    setSaving(false);
  };

  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        {/* 표 제목 「일정」 (10-18 D10) — 제목 옆은 개수만, 고른 수는 작업 바에 */}
        <h2 className='type-title-md'>
          일정
          <span className='tnum ml-2 type-label-lg text-fg-muted'>
            전체 {meetings.filter((m) => !isKickoff(m)).length} · 예정{' '}
            {meetings.filter((m) => !isKickoff(m) && !startedOf(m)).length}
          </span>
        </h2>

        <div className='ml-auto flex items-center gap-2'>
          {canEdit ? (
            <label className='flex items-center gap-2 type-label-sm text-fg-muted'>
              시간대
              <Select
                size='sm'
                aria-label='시간대'
                value={zone}
                disabled={Object.keys(incompleteWalls).length > 0}
                onChange={(event) => setInputZone(event.target.value)}
              >
                {!SCHEDULE_ZONES.some((z) => z.iana === zone) && (
                  <option value={zone}>{scheduleZoneTitle(zone)}</option>
                )}
                {SCHEDULE_ZONES.map(({ iana, label }) => (
                  <option key={iana} value={iana}>
                    {label}
                  </option>
                ))}
              </Select>
            </label>
          ) : (
            <span className='type-label-sm text-fg-muted'>내 시간대: {scheduleZoneTitle(zone)}</span>
          )}
          {canEdit && (
            // 시간대를 고른 뒤 그 시간대로 회차를 더한다 — 셀렉트 오른쪽 (playground ScheduleManager 와 같은 순서)
            <Button size='sm' leadingIcon={<Plus size={15} />} onClick={() => setAdding(true)}>
              회차 추가
            </Button>
          )}
        </div>
      </div>

      {canEdit && <p className='type-label-sm text-fg-muted'>선택한 지역의 시간으로 입력해 주세요.</p>}

      {notice && (
        <p role='status' className='rounded-control bg-warning-50 px-3 py-2 type-label-lg text-warning-700'>
          {notice}
        </p>
      )}
      <p aria-live='polite' className='sr-only'>
        {announce}
      </p>

      {adding && (
        <AddMeetingForm
          key={viewerZone}
          inputZone={viewerZone}
          group={group}
          existing={meetings}
          onClose={() => setAdding(false)}
          onAdded={({ scheduledAts, title }) => {
            setPendingAdds((cur) => [
              ...cur,
              ...scheduledAts.map((scheduledAt, i) => {
                const at = new Date(scheduledAt);
                return {
                  id: `pending-${Date.now()}-${i}`,
                  ...wallParts(at, group.timeZone),
                  scheduledAt: at.toISOString(),
                  title,
                };
              }),
            ]);
            setAdding(false);
            setRevision((n) => n + 1);
          }}
        />
      )}

      {meetings.length === 0 ? (
        <div className='card px-6 py-10 text-center type-body-sm text-fg-muted'>아직 회차가 없습니다.</div>
      ) : (
        <div className='card overflow-clip'>
          {/* 액션바 + 컬럼 헤더 — sticky로 함께 고정, overflow-x-auto 밖에 위치 */}
          <div className='sticky top-[var(--table-action-bar-top,4rem)] z-20 bg-surface-raised'>
            {canEdit && (
              <TableActionBar
                className='border-b border-border px-4'
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
                      <Button size='sm' variant='tertiary' onClick={() => setChecked(new Set())}>
                        선택 해제
                      </Button>
                    )}
                  </>
                }
                save={
                  <>
                    {errorCount > 0 && <p className='mr-1 type-label-sm text-error-700'>고칠 칸 {errorCount}개</p>}
                    {dirty && (
                      <Button
                        variant='tertiary'
                        size='sm'
                        disabled={saving}
                        onClick={() => {
                          setDrafts({});
                          setIncompleteWalls({});
                          setPendingAdds([]);
                        }}
                      >
                        변경 취소
                      </Button>
                    )}
                    <Button size='sm' loading={saving} disabled={!dirty || errorCount > 0} onClick={() => void save()}>
                      저장
                    </Button>
                  </>
                }
              />
            )}
            {/* 헤더 테이블 — 바디 테이블과 가로 스크롤 동기화 */}
            <div ref={headerScrollRef} className='overflow-x-hidden'>
              <table className='w-full min-w-240 table-fixed border-separate border-spacing-0 type-body-sm'>
                <colgroup>
                  {canEdit && <col className='w-10' />}
                  <col className='w-[6%]' />
                  <col className='w-[18%]' />
                  <col className='w-[18%]' />
                  <col className='w-[28%]' />
                  <col className='w-[13%]' />
                  <col className='w-[13%]' />
                </colgroup>
                <thead>
                  <tr className='text-left type-label-sm text-fg-muted'>
                    {canEdit && (
                      <th className='border-b border-border py-3 pl-4 align-middle'>
                        <input
                          type='checkbox'
                          aria-label='지울 수 있는 회차 전체 선택'
                          className={CHECKBOX}
                          checked={allChecked}
                          disabled={deletable.length === 0}
                          ref={(el) => {
                            if (el) el.indeterminate = picked.length > 0 && !allChecked;
                          }}
                          onChange={() => setChecked(allChecked ? new Set() : new Set(deletable.map((m) => m.id)))}
                        />
                      </th>
                    )}
                    <th className='border-b border-border px-4 py-3 text-center'>회차</th>
                    <th className='border-b border-border px-2 py-3 text-center'>일자</th>
                    <th className='border-b border-border px-2 py-3 text-center'>시각 ({zoneLabel(zone)})</th>
                    <th className='border-b border-border min-w-56 px-2 py-3 text-center'>제목</th>
                    <th className='border-b border-border px-2 py-3 text-center'>발표자1</th>
                    <th className='border-b border-border px-2 py-3 text-center'>발표자2</th>
                  </tr>
                </thead>
              </table>
            </div>
          </div>
          {/* 바디 스크롤 컨테이너 */}
          <div ref={bodyScrollRef} className='overflow-x-auto'>
            <table className='w-full min-w-240 table-fixed border-separate border-spacing-0 type-body-sm'>
              <colgroup>
                {canEdit && <col className='w-10' />}
                <col className='w-[6%]' />
                <col className='w-[18%]' />
                <col className='w-[18%]' />
                <col className='w-[28%]' />
                <col className='w-[13%]' />
                <col className='w-[13%]' />
              </colgroup>
              <tbody>
                {meetings.map((m) => {
                  const v = value(m);
                  const started = startedOf(m);
                  const shown = shownWall(m);
                  const abbreviation = zoneLabel(zone, instantOf(m));
                  const timeChoices = wallTimeChoices(shown.date, shown.time, zone);
                  const selectedTime = incompleteWalls[m.id]
                    ? ''
                    : (timeChoices.find(
                        (choice) =>
                          Math.floor(Date.parse(choice.scheduledAt) / 60_000) ===
                          Math.floor(instantOf(m).getTime() / 60_000),
                      )?.scheduledAt ?? '');
                  const errors = errorsOf(m);
                  const changed = Boolean(drafts[m.id]) || pendingIds.has(m.id);
                  const canDelete = !isKickoff(m) && !started;
                  // 킥오프는 캡틴이 백오피스에서 정한다 — 이 화면에서는 고치지 않는다 (회차 스펙 결정 11)
                  const editable = canEdit && !started && !isKickoff(m);
                  const confirming = bulkConfirm && checked.has(m.id);
                  return (
                    <tr
                      key={m.id}
                      title={canEdit && isKickoff(m) ? '킥오프 일정은 캡틴이 정합니다.' : undefined}
                      className={cx(
                        'border-t border-border',
                        started && 'text-fg-muted',
                        isKickoff(m) && 'bg-surface-1',
                        changed && 'bg-brand-subtle/40',
                        confirming && 'bg-error-50',
                      )}
                    >
                      {canEdit && (
                        <td className='py-3 pl-4 align-middle'>
                          {canDelete && (
                            <input
                              type='checkbox'
                              aria-label={`${meetingLabel(m)} 선택`}
                              className={CHECKBOX}
                              checked={checked.has(m.id)}
                              onChange={() => toggle(m.id)}
                            />
                          )}
                        </td>
                      )}
                      <td className='px-4 py-3 text-center font-semibold'>{m.no === 0 ? '0' : `${m.no}`}</td>
                      <td className='px-2 py-3 text-center'>
                        {editable ? (
                          <Input
                            type='date'
                            aria-label={`${meetingLabel(m)} 일자 (${abbreviation})`}
                            size='sm'
                            value={shown.date}
                            error={errors.date}
                            onChange={(e) => changeWall(m, { date: e.target.value })}
                            className='w-full max-w-none px-2 py-1'
                          />
                        ) : (
                          dateWithDow(shown.date)
                        )}
                      </td>
                      <td className='px-2 py-3 text-center'>
                        <div className='flex items-center justify-center gap-1.5'>
                          {editable ? (
                            <Input
                              type='time'
                              aria-label={`${meetingLabel(m)} 시작 시각 (${abbreviation})`}
                              size='sm'
                              value={shown.time}
                              error={errors.time}
                              onChange={(e) => changeWall(m, { time: e.target.value })}
                              className='w-full max-w-none px-2 py-1'
                            />
                          ) : (
                            shown.time
                          )}
                          <span className='shrink-0 type-label-sm text-fg-muted'>{abbreviation}</span>
                        </div>
                        {editable && timeChoices.length > 1 && (
                          <div className='mt-2'>
                            <Select
                              size='sm'
                              aria-label={`${meetingLabel(m)} 시각 구분`}
                              value={selectedTime}
                              onChange={(e) => changeWall(m, {}, e.target.value)}
                            >
                              <option value='' disabled>
                                시각을 선택해 주세요
                              </option>
                              {timeChoices.map((choice) => (
                                <option key={choice.scheduledAt} value={choice.scheduledAt}>
                                  {choice.label.replace(`${shown.time} · `, '')}
                                </option>
                              ))}
                            </Select>
                          </div>
                        )}
                      </td>
                      <td className='px-2 py-3 text-center'>
                        {editable ? (
                          <Input
                            aria-label={`${meetingLabel(m)} 제목`}
                            size='sm'
                            placeholder='제목'
                            maxLength={50}
                            value={v.title}
                            error={errors.title}
                            onChange={(e) => update(m, { title: e.target.value })}
                            className='w-full px-2 py-1'
                          />
                        ) : (
                          v.title || <span className='block text-center text-fg-muted'>-</span>
                        )}
                      </td>
                      <td className='px-2 py-3 text-center'>
                        {isKickoff(m) ? (
                          <span className='block text-center text-fg-muted'>-</span>
                        ) : canEdit && !started ? (
                          <Select
                            aria-label={`${meetingLabel(m)} 발표자 1`}
                            size='sm'
                            value={v.presenter1}
                            onChange={(e) => update(m, { presenter1: e.target.value })}
                            className='w-full max-w-none px-2 py-1'
                          >
                            <option value=''>발표자 1</option>
                            {people
                              .filter(
                                (p) =>
                                  (!p.left || p.id === v.presenter1) &&
                                  (!v.presenter2 || p.id !== v.presenter2 || p.id === v.presenter1),
                              )
                              .map((p) => {
                                const label = p.me
                                  ? `${p.displayName} (나)`
                                  : p.left
                                    ? `${p.displayName} (참여 종료)`
                                    : p.displayName;
                                return (
                                  <option key={p.id} value={p.id} disabled={Boolean(p.left)}>
                                    {label}
                                  </option>
                                );
                              })}
                          </Select>
                        ) : (
                          <PresenterCell
                            label={`${meetingLabel(m)} 발표자1`}
                            slot={1}
                            slotValue={v.presenter1}
                            otherValue={v.presenter2}
                            myParticipantId={myParticipantId}
                            people={people}
                            started={started}
                            onSign={(on) => void sign(m, 1, on)}
                          />
                        )}
                      </td>
                      <td className='px-2 py-3 text-center'>
                        {isKickoff(m) ? (
                          <span className='block text-center text-fg-muted'>-</span>
                        ) : canEdit && !started ? (
                          <Select
                            aria-label={`${meetingLabel(m)} 발표자 2`}
                            size='sm'
                            value={v.presenter2}
                            error={errors.presenter2}
                            onChange={(e) => update(m, { presenter2: e.target.value })}
                            className='w-full max-w-none px-2 py-1'
                          >
                            <option value=''>발표자 2</option>
                            {people
                              .filter(
                                (p) =>
                                  (!p.left || p.id === v.presenter2) &&
                                  (!v.presenter1 || p.id !== v.presenter1 || p.id === v.presenter2),
                              )
                              .map((p) => {
                                const label = p.me
                                  ? `${p.displayName} (나)`
                                  : p.left
                                    ? `${p.displayName} (참여 종료)`
                                    : p.displayName;
                                return (
                                  <option key={p.id} value={p.id} disabled={Boolean(p.left)}>
                                    {label}
                                  </option>
                                );
                              })}
                          </Select>
                        ) : (
                          <PresenterCell
                            label={`${meetingLabel(m)} 발표자2`}
                            slot={2}
                            slotValue={v.presenter2}
                            otherValue={v.presenter1}
                            myParticipantId={myParticipantId}
                            people={people}
                            started={started}
                            onSign={(on) => void sign(m, 2, on)}
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 삭제 확인 모달 — 취소가 기본 포커스. Enter 로 지워지면 안 된다 */}
      <Modal
        open={bulkConfirm}
        onClose={() => setBulkConfirm(false)}
        title='회차 삭제'
        footer={
          <>
            <Button variant='secondary' data-autofocus onClick={() => setBulkConfirm(false)}>
              취소
            </Button>
            <Button variant='destructive' loading={saving} onClick={() => void remove()}>
              삭제
            </Button>
          </>
        }
      >
        <p className='type-body-sm text-fg-secondary'>
          {picked.length === 1
            ? `${meetingLabel(picked[0]!)}(${dayLabel(picked[0]!.date)})를 지울까요?`
            : `회차 ${picked.length}개(${picked.map((m) => meetingLabel(m)).join(', ')})를 지울까요?`}{' '}
          뒤 회차 번호는 당겨집니다. 되돌릴 수 없습니다.
        </p>
      </Modal>
    </div>
  );
}
