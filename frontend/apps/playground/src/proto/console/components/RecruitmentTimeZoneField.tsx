'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';

import { memberTimeZones, zoneLabel, zoneSearchText } from '@core/lib/time-zones';
import type { RecruitmentTimeZones } from '@studyclub/types';
import { Button, Checkbox, FilterChip, Input } from '@studyclub/ui';
import { ChevronDown } from 'lucide-react';

import { useMemberTimeZones } from '@/proto/lib/use-member-timezones';


export function RecruitmentTimeZoneField({ value, onChange, error }: {
  value: RecruitmentTimeZones;
  onChange: (value: RecruitmentTimeZones) => void;
  error?: string;
}) {
  const usedZones = useMemberTimeZones();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [worldwide, setWorldwide] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const searchId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const options = useMemo(() => memberTimeZones('', 'ko', worldwide ? undefined : [...usedZones, ...value.zones]), [worldwide, value.zones, usedZones]);
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const groups = new Map<string, string[]>();
  for (const zone of options.filter((zone) => words.every((word) => zoneSearchText(zone).includes(word)))) {
    const country = zoneLabel(zone, 'ko').split(' · ')[0];
    groups.set(country, [...(groups.get(country) ?? []), zone]);
  }
  useEffect(() => {
    if (!open) return;
    document.getElementById(searchId)?.focus();
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [open, searchId]);

  return (
    <div className='flex flex-col gap-1.5'>
      <span className='type-label-lg text-neutral-800'>모집 시간대</span>
      <div role='radiogroup' aria-label='모집 시간대' className='flex flex-wrap gap-1.5'>
        {([['unset', '미정'], ['all', '모든 시간대에서 모집'], ['selected', '특정 시간대 선택']] as const).map(([mode, label]) => (
          <FilterChip key={mode} role='radio' selected={value.mode === mode} selectMode='single'
            onClick={() => { onChange({ mode, zones: mode === 'selected' ? value.zones : [] }); setOpen(false); }}>
            {label}
          </FilterChip>
        ))}
      </div>
      {value.mode === 'selected' && <div ref={root} className='relative mt-1'
        onBlur={(event) => { if (!root.current?.contains(event.relatedTarget as Node | null)) setOpen(false); }}
        onKeyDown={(event) => { if (event.key === 'Escape' && open) { event.stopPropagation(); setOpen(false); trigger.current?.focus(); } }}>
        <button
          // ui-native: 선택값을 표시하고 체크박스 검색 패널을 여는 시간대 전용 선택기
          ref={trigger} type='button' aria-label='모집 시간대 선택' aria-expanded={open} aria-haspopup='dialog'
          onClick={() => { if (!open) setWorldwide(false); setOpen(!open); setQuery(''); }}
          className='flex min-h-10 w-full items-center justify-between gap-3 rounded-control border border-border-strong bg-bg px-3.5 py-2 text-left type-label-lg'>
          <span>{value.zones.length ? memberTimeZones('', 'ko', value.zones).map((zone) => zoneLabel(zone, 'ko')).join(' / ') : '시간대를 선택해 주세요'}</span>
          <ChevronDown size={16} className='shrink-0 text-fg-muted' />
        </button>
        {open && <div
          // ui-native: 검색 입력과 복수 체크박스를 포함한 비모달 선택 패널. 도움말이나 확인 모달이 아님
          role='dialog' aria-label='모집 시간대 선택 목록'
          className='absolute left-0 right-0 top-full z-40 mt-1.5 rounded-card border border-border bg-bg p-2 shadow-lg'>
          <Input id={searchId} size='sm' aria-label='모집 시간대 검색' placeholder='도시 또는 국가 검색'
            value={query} onChange={(event) => setQuery(event.target.value)} />
          <div className='mt-2 max-h-64 overflow-y-auto'>
            {[...groups].map(([country, zones]) => <div key={country} role='group' aria-label={country}>
              <div className='bg-surface-2 px-3 py-1.5 type-label-sm font-semibold text-fg-muted'>{country}</div>
              {zones.map((zone) => <div key={zone} className='px-3 py-2.5'>
                <Checkbox label={zoneLabel(zone, 'ko').split(' · ').slice(1).join(' · ') || country}
                  checked={value.zones.includes(zone)} onChange={(event) => onChange({ mode: 'selected', zones: event.target.checked ? [...value.zones, zone] : value.zones.filter((item) => item !== zone) })} />
              </div>)}
            </div>)}
            {!groups.size && <p role='status' className='px-3 py-2.5 type-label-sm text-fg-muted'>검색 결과가 없습니다.</p>}
          </div>
          <div className='mt-2 flex items-center justify-between border-t border-border pt-2'>
            <Button size='sm' variant='tertiary' onClick={() => setWorldwide(!worldwide)}>{worldwide ? '회원이 있는 시간대만 보기' : '전체 시간대에서 찾기'}</Button>
            <Button size='sm' variant='secondary' onClick={() => { setOpen(false); trigger.current?.focus(); }}>완료</Button>
          </div>
        </div>}
      </div>}
      {error && <p role='alert' className='type-label-sm text-error-700'>{error}</p>}
    </div>
  );
}
