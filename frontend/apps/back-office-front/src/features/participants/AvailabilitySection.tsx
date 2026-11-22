'use client';

import { useId, useMemo, useState } from 'react';

import { Button, FilterChip, HeatGrid, HelpPopover, Segmented, Switch, type HeatGridCell } from '@studyclub/ui';
import {
  NIGHT_END_HOUR,
  WEEKDAY_KEYS,
  WEEKDAY_LABELS_KO,
  availabilityOverlap,
  bestSlots,
  type AvailabilityPerson,
} from '@studyclub/utils';
import { ArrowDown, ChevronDown } from 'lucide-react';

import { DISPLAY_ZONES, zoneLabel } from '@/features/schedule/time';

/** 고른 시각 — 칸 하나면 `hour` 만, 「가장 많이 되는 시간」 구간이면 `endHour` 까지 */
export type AvailabilityPick = { day: number; hour: number; endHour?: number; baseZone: string; ids: number[] };

// 시각을 줄(모두 적는다), 요일을 열로 둔다. 기준 시간대 0 ~ 6시는 스터디를 열지 않는 시각이라 처음엔 숨긴다
const ALL_HOURS = Array.from({ length: 24 }, (_, h) => h);
const DAY_HOURS = ALL_HOURS.filter((h) => h >= NIGHT_END_HOUR);
const COLS = WEEKDAY_KEYS.map((k) => ({ key: k, label: WEEKDAY_LABELS_KO[k] }));
const BEST_LIMIT = 3;

/** 『월 21시 KST』 · 『일 7~23시 KST』 */
export function pickLabel(p: { day: number; hour: number; endHour?: number; baseZone: string }): string {
  const hours = p.endHour !== undefined && p.endHour !== p.hour ? `${p.hour}~${p.endHour}` : String(p.hour);
  return `${WEEKDAY_LABELS_KO[WEEKDAY_KEYS[p.day]!]} ${hours}시 ${zoneLabel(p.baseZone)}`;
}

/**
 * 참여 가능 시간 — 크루가 고른 요일을 기준 시간대의 시각 × 요일 칸에 겹쳐 센다 (captain-assign-classes PRD §2 3).
 * 맨 위에 「가장 많이 되는 시간」을 먼저 보이고, 칸에 올리면 그 시각에 되는 크루 닉네임을,
 * 칸이나 추천 시간을 고르면 그 참여 행 id 를 올려 보낸다.
 */
export function AvailabilitySection({
  people,
  pick,
  onPick,
  rosterId,
}: {
  people: (AvailabilityPerson<number> & { name: string })[];
  pick: AvailabilityPick | null;
  onPick: (pick: AvailabilityPick | null) => void;
  /** 「명단에서 보기」가 스크롤해 갈 명단 영역의 id */
  rosterId: string;
}) {
  const [baseZone, setBaseZone] = useState<string>(DISPLAY_ZONES[0].iana);
  const [excludeNight, setExcludeNight] = useState(true);
  const [showNightRows, setShowNightRows] = useState(false);
  // 표만 접는다 — 「가장 많이 되는 시간」과 고른 시각 줄은 접어도 남는다
  const [gridOpen, setGridOpen] = useState(true);
  const gridId = useId();
  const hours = showNightRows ? ALL_HOURS : DAY_HOURS;
  const overlap = useMemo(
    () => availabilityOverlap(people, { baseZone, excludeNight }),
    [people, baseZone, excludeNight],
  );
  const best = useMemo(() => bestSlots(overlap, { hours, limit: BEST_LIMIT }), [overlap, hours]);
  const names = useMemo(() => new Map(people.map((p) => [p.id, p.name])), [people]);
  const cellAt = (hour: number, day: number) => overlap.cells[day]![hour]!;
  const pickRow = pick && pick.baseZone === baseZone ? hours.indexOf(pick.hour) : -1;
  const selected = pick && pickRow >= 0 ? { row: pickRow, col: pick.day } : null;
  // 진하기의 기준은 보이는 줄의 최대 인원
  const max = Math.max(0, ...hours.flatMap((h) => WEEKDAY_KEYS.map((_, d) => cellAt(h, d).ids.length)));

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
    const hour = hours[cell.row]!;
    onPick({ day: cell.col, hour, baseZone, ids: cellAt(hour, cell.col).ids });
  }

  // 기준 · 새벽 빼기 · 줄 보기를 바꾸면 고른 칸의 사람이 달라질 수 있다 — 고른 칸은 푼다
  function change<T>(set: (v: T) => void) {
    return (v: T) => {
      set(v);
      onPick(null);
    };
  }

  function showRoster() {
    document.getElementById(rosterId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <section aria-label='참여 가능 시간' className='card flex flex-col gap-3 px-4 py-4'>
      <div className='flex flex-wrap items-center gap-x-3 gap-y-2'>
        <h2 className='flex items-center gap-1.5 font-semibold'>
          참여 가능 시간
          <span className='tnum type-label-lg text-fg-muted'>{overlap.counted}명</span>
          <HelpPopover label='참여 가능 시간 설명'>
            신청서는 요일만 받습니다. 고른 요일은 그 크루 현지의 하루 전체로 보고, 기준 시간대의 요일 · 시각으로 옮겨
            셉니다. 프로필 시간대가 없는 크루는 한국 시간으로 봅니다. 북미 서머타임은 이번 주 날짜로 계산합니다. 「크루
            새벽 빼기」는 크루 현지 0~{NIGHT_END_HOUR}시를 세지 않고, 「0~6시 줄 보기」는 기준 시간대의 0~6시 줄을
            펼칩니다.
          </HelpPopover>
        </h2>
        <div className='ml-auto flex flex-wrap items-center gap-3'>
          <Segmented
            size='sm'
            shape='pill'
            aria-label='기준 시간대'
            options={DISPLAY_ZONES.map((z) => ({ value: z.iana as string, label: z.label }))}
            value={baseZone}
            onChange={change(setBaseZone)}
          />
          <Switch label='크루 새벽 빼기' checked={excludeNight} onCheckedChange={change(setExcludeNight)} />
          <Switch label='0~6시 줄 보기' checked={showNightRows} onCheckedChange={change(setShowNightRows)} />
        </div>
      </div>
      <div className='flex flex-wrap items-center gap-2'>
        {best.length > 0 && (
          <div role='group' aria-label='가장 많이 되는 시간' className='flex flex-wrap items-center gap-2'>
            <span className='type-label-lg text-fg-secondary'>가장 많이 되는 시간</span>
            {best.map((b) => {
              const label = pickLabel({ day: b.day, hour: b.startHour, endHour: b.endHour, baseZone });
              const on =
                pick?.baseZone === baseZone &&
                pick.day === b.day &&
                pick.hour === b.startHour &&
                pick.endHour === b.endHour;
              return (
                <FilterChip
                  key={b.day}
                  selected={on}
                  onClick={() =>
                    onPick(on ? null : { day: b.day, hour: b.startHour, endHour: b.endHour, baseZone, ids: b.ids })
                  }
                >
                  {label} · <span className='tnum'>{b.ids.length}명</span>
                </FilterChip>
              );
            })}
          </div>
        )}
        <span className='ml-auto'>
          <Button
            variant='tertiary'
            size='sm'
            aria-expanded={gridOpen}
            aria-controls={gridId}
            trailingIcon={
              <ChevronDown
                aria-hidden
                className={gridOpen ? 'rotate-180 transition-transform' : 'transition-transform'}
              />
            }
            onClick={() => setGridOpen((o) => !o)}
          >
            {gridOpen ? '표 접기' : '표 펼치기'}
          </Button>
        </span>
      </div>
      <div id={gridId} hidden={!gridOpen}>
        <HeatGrid
          aria-label={`참여 가능 인원 · 시각 × 요일 (${zoneLabel(baseZone)})`}
          rows={hours.map((h) => ({ key: String(h), label: String(h) }))}
          columns={COLS}
          value={(r, d) => cellAt(hours[r]!, d).ids.length}
          max={max}
          unit='명'
          showValues
          describe={(r, d) => describe(hours[r]!, d)}
          tooltip={(r, d) => who(hours[r]!, d)}
          selected={selected}
          onSelect={select}
          hint='칸을 누르면 그 시각에 되는 크루만 명단에 남습니다.'
        />
      </div>
      {pick && pick.baseZone === baseZone && (
        <div className='flex flex-wrap items-center gap-2 border-t border-border pt-3'>
          <span className='type-body-sm text-fg'>
            {pickLabel(pick)}에 되는 크루 <span className='tnum font-semibold'>{pick.ids.length}명</span>
          </span>
          <Button variant='tertiary' size='sm' trailingIcon={<ArrowDown aria-hidden />} onClick={showRoster}>
            명단에서 보기
          </Button>
        </div>
      )}
    </section>
  );
}
