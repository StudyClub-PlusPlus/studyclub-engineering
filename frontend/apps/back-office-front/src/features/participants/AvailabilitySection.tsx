'use client';

import { useMemo, useState } from 'react';

import { HeatGrid, HelpPopover, Segmented, Switch, type HeatGridCell } from '@studyclub/ui';
import {
  NIGHT_END_HOUR,
  WEEKDAY_KEYS,
  WEEKDAY_LABELS_KO,
  availabilityOverlap,
  type AvailabilityPerson,
} from '@studyclub/utils';

import { DISPLAY_ZONES, zoneLabel } from '@/features/schedule/time';

export type AvailabilityPick = { day: number; hour: number; baseZone: string; ids: number[] };

// 시각을 줄(0 ~ 23시, 모두 적는다), 요일을 열로 둔다
const ROWS = Array.from({ length: 24 }, (_, h) => ({ key: String(h), label: String(h) }));
const COLS = WEEKDAY_KEYS.map((k) => ({ key: k, label: WEEKDAY_LABELS_KO[k] }));

/** 『월 21시 KST』 */
export function pickLabel(p: { day: number; hour: number; baseZone: string }): string {
  return `${WEEKDAY_LABELS_KO[WEEKDAY_KEYS[p.day]!]} ${p.hour}시 ${zoneLabel(p.baseZone)}`;
}

/**
 * 참여 가능 시간 — 크루가 고른 요일을 기준 시간대의 요일 × 시각 칸에 겹쳐 센다 (captain-assign-classes PRD §2 3).
 * 칸에 올리면 그 시각에 되는 크루 닉네임을 보이고, 칸을 고르면 그 참여 행 id 를 올려 보낸다.
 */
export function AvailabilitySection({
  people,
  pick,
  onPick,
}: {
  people: (AvailabilityPerson<number> & { name: string })[];
  pick: AvailabilityPick | null;
  onPick: (pick: AvailabilityPick | null) => void;
}) {
  const [baseZone, setBaseZone] = useState<string>(DISPLAY_ZONES[0].iana);
  const [excludeNight, setExcludeNight] = useState(true);
  const overlap = useMemo(
    () => availabilityOverlap(people, { baseZone, excludeNight }),
    [people, baseZone, excludeNight],
  );
  const names = useMemo(() => new Map(people.map((p) => [p.id, p.name])), [people]);
  const selected = pick && pick.baseZone === baseZone ? { row: pick.hour, col: pick.day } : null;
  const cellAt = (hour: number, day: number) => overlap.cells[day]![hour]!;

  function describe(hour: number, day: number): string {
    const cell = cellAt(hour, day);
    const head = `${WEEKDAY_LABELS_KO[WEEKDAY_KEYS[day]!]} ${hour}시 ${zoneLabel(baseZone)} · ${cell.ids.length}명`;
    const parts = Object.entries(cell.byZone)
      .sort((a, b) => b[1] - a[1])
      .map(([z, n]) => `${zoneLabel(z)} ${n}`);
    return parts.length > 1 ? `${head} (${parts.join(' · ')})` : head;
  }

  function who(hour: number, day: number): string {
    const ids = cellAt(hour, day).ids;
    return ids.length > 0 ? ids.map((id) => names.get(id) ?? String(id)).join(', ') : '이 시각에 되는 크루가 없습니다';
  }

  function select(cell: HeatGridCell | null) {
    if (!cell) return onPick(null);
    onPick({ day: cell.col, hour: cell.row, baseZone, ids: cellAt(cell.row, cell.col).ids });
  }

  return (
    <section aria-label='참여 가능 시간' className='card flex flex-col gap-3 px-4 py-4'>
      <div className='flex flex-wrap items-center gap-x-3 gap-y-2'>
        <h2 className='flex items-center gap-1.5 font-semibold'>
          참여 가능 시간
          <span className='tnum type-label-lg text-fg-muted'>{overlap.counted}명</span>
          <HelpPopover label='참여 가능 시간 설명'>
            신청서는 요일만 받습니다. 고른 요일은 그 크루 현지의 하루 전체로 보고, 기준 시간대의 요일 · 시각으로 옮겨
            셉니다. 프로필 시간대가 없는 크루는 한국 시간으로 봅니다. 북미 서머타임은 이번 주 날짜로 계산합니다.
          </HelpPopover>
        </h2>
        <div className='ml-auto flex flex-wrap items-center gap-3'>
          <Segmented
            size='sm'
            shape='pill'
            aria-label='기준 시간대'
            options={DISPLAY_ZONES.map((z) => ({ value: z.iana as string, label: z.label }))}
            value={baseZone}
            onChange={(z) => {
              setBaseZone(z);
              onPick(null);
            }}
          />
          <Switch
            label={`현지 밤(0~${NIGHT_END_HOUR}시) 빼기`}
            checked={excludeNight}
            onCheckedChange={(next) => {
              setExcludeNight(next);
              onPick(null);
            }}
          />
        </div>
      </div>
      <HeatGrid
        aria-label={`참여 가능 인원 · 시각 × 요일 (${zoneLabel(baseZone)})`}
        rows={ROWS}
        columns={COLS}
        value={(h, d) => cellAt(h, d).ids.length}
        max={overlap.max}
        unit='명'
        describe={describe}
        tooltip={who}
        selected={selected}
        onSelect={select}
        hint='칸을 누르면 그 시각에 되는 크루만 명단에 남습니다.'
      />
    </section>
  );
}
