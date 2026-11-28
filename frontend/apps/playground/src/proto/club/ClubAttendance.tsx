'use client';

import { useEffect, useState } from 'react';

import type { ClubConfig } from '@console/lib/clubs';
import { DEMO_DAYS, daysOfMonth, isoWeek, monthKey, monthLabel } from '@core/lib/my-club';
import { Button, Select } from '@studyclub/ui';

import { ClubBoard, boardWeeks } from './ClubBoard';
import { quietMembers, restingNext, useClubDemo, useClubRoom, type ClubRoom } from './room';

/**
 * 사용자 사이트 › 스터디 일정(클럽) › 출석 탭 — 스터디의 출석 탭과 같은 자리 · 같은 규칙.
 * 크루는 클럽 멤버 전원의 기록을 본다. 캡틴은 같은 판에서 고치고 「저장」으로 한 번에 반영한다.
 *
 * TODO(api): GET /api/clubs/{programId}/board?month= · 캡틴 저장은 PUT /api/admin/clubs/{programId}/checkins
 */
export function ClubAttendance({
  club,
  canEdit,
  onDirtyChange,
}: {
  club: ClubConfig;
  canEdit: boolean;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const [demo] = useClubDemo();
  const today = DEMO_DAYS[demo.day];
  const [room, setRoom] = useClubRoom(club, today, demo.resting);
  return (
    <ClubBookEditor
      key={`${club.key}-${today}-${demo.resting}`}
      room={room}
      onSave={(next) => setRoom(() => next)}
      canEdit={canEdit}
      onDirtyChange={onDirtyChange}
      anno='clubboard'
    />
  );
}

/**
 * 판 + (캡틴이면) 고치기 · 저장 · 살펴볼 사람. 사용자 사이트 출석 탭과 운영 콘솔 출석부가 함께 쓴다.
 * 저장 전 고친 칸은 테두리로 보이고, 저장하면 「캡틴이 고침」 표시가 남는다.
 */
export function ClubBookEditor({
  room,
  onSave,
  canEdit,
  onDirtyChange,
  anno,
  lead,
  nameExtra,
  toolbar,
}: {
  room: ClubRoom;
  onSave: (next: ClubRoom) => void | Promise<void>;
  canEdit: boolean;
  onDirtyChange?: (dirty: boolean) => void;
  /** 번호 이름공간 — 사용자 사이트 'clubboard' · 콘솔 'clubbook' */
  anno: string;
  lead?: Parameters<typeof ClubBoard>[0]['lead'];
  nameExtra?: Parameters<typeof ClubBoard>[0]['nameExtra'];
  /** 고르기 · 일괄 변경 같은 캡틴 도구 (콘솔) */
  toolbar?: (draft: ClubRoom, setDraft: (f: (r: ClubRoom) => ClubRoom) => void) => React.ReactNode;
}) {
  const [draft, setDraftState] = useState(room);
  const [saving, setSaving] = useState(false);
  const dirty = draft !== room;
  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);
  const setDraft = (f: (r: ClubRoom) => ClubRoom) => setDraftState((d) => f(d));

  const week = room.club.rules.judge === 'week';
  const weeks = boardWeeks(room.today);
  const [monday, setMonday] = useState(weeks[0]);
  const days = daysOfMonth(monthKey(room.today));
  const quiet = quietMembers(draft);
  const restNext = restingNext(draft);

  return (
    <div className='flex flex-col gap-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div className='flex flex-wrap items-center gap-2'>
          <h2 className='type-title-md text-fg'>
            {week ? `${isoWeek(monday)}주차` : `${monthLabel(monthKey(room.today))}`} 출석
          </h2>
          <span className='tnum type-label-sm text-fg-muted'>멤버 {room.members.length}</span>
          {week && (
            <span data-anno={`${anno}:1-1`}>
              <Select size='sm' aria-label='주' value={monday} onChange={(e) => setMonday(e.target.value)}>
                {weeks.map((w, i) => (
                  <option key={w} value={w}>
                    {isoWeek(w)}주차{i === 0 ? ' (이번 주)' : ''}
                  </option>
                ))}
              </Select>
            </span>
          )}
        </div>
        {canEdit && (
          <span data-anno={`${anno}:4`} className='flex items-center gap-2'>
            {dirty && (
              <Button variant='tertiary' size='sm' disabled={saving} onClick={() => setDraftState(room)}>
                변경 취소
              </Button>
            )}
            <Button
              size='sm'
              loading={saving}
              disabled={!dirty}
              onClick={async () => {
                setSaving(true);
                await onSave(draft);
                setSaving(false);
              }}
            >
              저장
            </Button>
          </span>
        )}
      </div>

      {canEdit && (quiet.length > 0 || restNext.length > 0) && (
        <div data-anno={`${anno}:5`} className='card flex flex-col gap-1.5 px-4 py-3 type-body-sm'>
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

      {toolbar?.(draft, setDraft)}

      <ClubBoard
        room={canEdit ? draft : room}
        days={days}
        week={monday}
        onRoom={canEdit ? setDraft : undefined}
        baseline={canEdit ? room : undefined}
        showCounts={room.club.rules.judge === 'day'}
        lead={lead}
        nameExtra={nameExtra}
        anno={{
          table: `${anno}:3`,
          name: `${anno}:3-1`,
          extra: `${anno}:3-2`,
          dayHead: `${anno}:3-3`,
          cell: `${anno}:3-4`,
          total: `${anno}:3-5`,
          counts: `${anno}:3-6`,
          legend: `${anno}:2`,
        }}
      />
    </div>
  );
}
