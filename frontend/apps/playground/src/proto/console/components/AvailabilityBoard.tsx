'use client';

import { useMemo, useState } from 'react';

import { SCHEDULE_ZONES, zoneSymbol } from '@core/lib/schedule-timezone';
import { HeatGrid, HelpPopover, Segmented, Switch, type HeatGridCell } from '@studyclub/ui';
import {
  NIGHT_END_HOUR,
  WEEKDAY_KEYS,
  WEEKDAY_LABELS_KO,
  availabilityOverlap,
  type AvailabilityPerson,
} from '@studyclub/utils';

export type AvailabilityPick = { day: number; hour: number; baseZone: string; ids: string[] };

const ROWS = WEEKDAY_KEYS.map((k) => ({ key: k, label: WEEKDAY_LABELS_KO[k] }));
const COLS = Array.from({ length: 24 }, (_, h) => ({ key: String(h), label: h % 3 === 0 ? String(h) : undefined }));

/** 『월 21시 KST』 */
export function pickLabel(p: { day: number; hour: number; baseZone: string }): string {
  return `${WEEKDAY_LABELS_KO[WEEKDAY_KEYS[p.day]!]} ${p.hour}시 ${zoneSymbol(p.baseZone)}`;
}

/**
 * 참여 가능 시간 — 크루가 고른 요일을 기준 시간대의 요일 × 시각 칸에 겹쳐 센다.
 * 칸을 고르면 그 시각에 되는 크루 id 를 올려 보낸다 — 명단이 그 사람들로 걸러진다.
 */
export function AvailabilityBoard({
  people,
  pick,
  onPick,
}: {
  people: AvailabilityPerson<string>[];
  pick: AvailabilityPick | null;
  onPick: (pick: AvailabilityPick | null) => void;
}) {
  const [baseZone, setBaseZone] = useState<string>(SCHEDULE_ZONES[0]!.iana);
  const [excludeNight, setExcludeNight] = useState(true);
  const overlap = useMemo(
    () => availabilityOverlap(people, { baseZone, excludeNight }),
    [people, baseZone, excludeNight],
  );
  const selected = pick && pick.baseZone === baseZone ? { row: pick.day, col: pick.hour } : null;

  function describe(row: number, col: number): string {
    const cell = overlap.cells[row]![col]!;
    const head = `${WEEKDAY_LABELS_KO[WEEKDAY_KEYS[row]!]} ${col}시 ${zoneSymbol(baseZone)} · ${cell.ids.length}명`;
    const parts = Object.entries(cell.byZone)
      .sort((a, b) => b[1] - a[1])
      .map(([z, n]) => `${zoneSymbol(z)} ${n}`);
    return parts.length > 1 ? `${head} (${parts.join(' · ')})` : head;
  }

  function select(cell: HeatGridCell | null) {
    if (!cell) return onPick(null);
    onPick({ day: cell.row, hour: cell.col, baseZone, ids: overlap.cells[cell.row]![cell.col]!.ids });
  }

  // 기준 · 밤 빼기를 바꾸면 고른 칸의 사람이 달라진다 — 고른 칸은 푼다
  function changeZone(z: string) {
    setBaseZone(z);
    onPick(null);
  }
  function changeNight(next: boolean) {
    setExcludeNight(next);
    onPick(null);
  }

  return (
    <section data-anno='class:3' className='card flex flex-col gap-3 px-4 py-4'>
      <div className='flex flex-wrap items-center gap-x-3 gap-y-2'>
        <h2 className='flex items-center gap-1.5 type-title-md'>
          참여 가능 시간
          <span data-anno='class:3-1' className='tnum type-label-lg text-fg-muted'>
            {overlap.counted}명
          </span>
          <span data-anno='class:3-5'>
            <HelpPopover label='참여 가능 시간 설명'>
              신청서는 요일만 받습니다. 고른 요일은 그 크루 현지의 하루 전체로 보고, 기준 시간대의 요일 · 시각으로 옮겨
              셉니다. 북미 서머타임은 이번 주 날짜로 계산합니다.
            </HelpPopover>
          </span>
        </h2>
        <div className='ml-auto flex flex-wrap items-center gap-3'>
          <span data-anno='class:3-2'>
            <Segmented
              size='sm'
              shape='pill'
              aria-label='기준 시간대'
              options={SCHEDULE_ZONES.map((z) => ({ value: z.iana, label: zoneSymbol(z.iana) }))}
              value={baseZone}
              onChange={changeZone}
            />
          </span>
          <span data-anno='class:3-3'>
            <Switch
              label={`현지 밤(0~${NIGHT_END_HOUR}시) 빼기`}
              checked={excludeNight}
              onCheckedChange={changeNight}
            />
          </span>
        </div>
      </div>
      <div data-anno='class:3-4'>
        <HeatGrid
          aria-label={`참여 가능 인원 · 요일 × 시각 (${zoneSymbol(baseZone)})`}
          rows={ROWS}
          columns={COLS}
          value={(r, c) => overlap.cells[r]![c]!.ids.length}
          max={overlap.max}
          unit='명'
          describe={describe}
          selected={selected}
          onSelect={select}
          hint='칸을 누르면 그 시각에 되는 크루만 명단에 남습니다.'
        />
      </div>
      {overlap.noZone > 0 && (
        <p data-anno='class:3-6' className='type-label-sm text-fg-muted'>
          시간대가 없는 {overlap.noZone}명은 빼고 셌습니다 — 프로필에서 시간대를 정하지 않은 크루입니다.
        </p>
      )}
    </section>
  );
}
