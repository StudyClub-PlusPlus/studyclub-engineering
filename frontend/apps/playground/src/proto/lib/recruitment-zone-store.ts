'use client';

import { useMemo, useSyncExternalStore } from 'react';

import { isValidZone } from '@core/lib/schedule-timezone';
import type { RecruitmentTimeZones, Study } from '@studyclub/types';

const KEY = 'playground:study-recruitment-zones:v1';
const EVENT = 'playground:study-recruitment-zones-change';
function snapshot() {
  try { return window.localStorage.getItem(KEY) ?? '{}'; } catch { return '{}'; }
}
function parse(raw: string): Record<string, RecruitmentTimeZones> {
  try {
    const parsed = JSON.parse(raw);
    return Object.fromEntries(Object.entries(parsed).filter(([, value]) => {
      const v = value as RecruitmentTimeZones | null;
      return v && ['all', 'unset', 'selected'].includes(v.mode) && Array.isArray(v.zones) && v.zones.every(isValidZone);
    })) as Record<string, RecruitmentTimeZones>;
  } catch { return {}; }
}
function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener(EVENT, onChange);
  return () => { window.removeEventListener('storage', onChange); window.removeEventListener(EVENT, onChange); };
}
export function saveRecruitmentZones(id: string, value: RecruitmentTimeZones) {
  window.localStorage.setItem(KEY, JSON.stringify({ ...parse(snapshot()), [id]: value }));
  window.dispatchEvent(new Event(EVENT));
}
/** 다른 스터디를 저장해도 수정되지 않은 스터디 객체는 유지한다. */
export function createRecruitmentProjector() {
  const cache = new WeakMap<Study, { signature: string; result: Study }>();
  return <T extends Study>(studies: T[], values: Record<string, RecruitmentTimeZones>): T[] => studies.map((study) => {
    const value = values[study.id];
    if (!value) return study;
    const signature = JSON.stringify(value);
    const cached = cache.get(study);
    if (cached?.signature === signature) return cached.result as T;
    const result = { ...study, recruitmentTimeZones: value };
    cache.set(study, { signature, result });
    return result;
  });
}

/** 새 기수 폼을 여는 순간의 최신 저장값을 읽는다. */
export function withSavedRecruitmentZones<T extends Study>(study: T): T {
  const value = parse(snapshot())[study.id];
  return value ? { ...study, recruitmentTimeZones: value } : study;
}

export function useRecruitmentStudies<T extends Study>(studies: T[]): T[] {
  const raw = useSyncExternalStore(subscribe, snapshot, () => '{}');
  const project = useMemo(createRecruitmentProjector, []);
  return useMemo(() => project(studies, parse(raw)), [project, raw, studies]);
}
