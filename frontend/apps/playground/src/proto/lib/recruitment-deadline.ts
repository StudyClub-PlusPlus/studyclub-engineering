import { wallParts } from '@core/lib/meetings';
import { zoneAbbreviation } from '@core/lib/schedule-timezone';
import type { RecruitState, Study } from '@studyclub/types';

import seed from './recruitment-deadlines.seed.json';

/** 기존 날짜 전용 mock에 한해 KST 일말로 명시한 고정 표본. 실제 API의 UTC 순간은 그대로 쓴다. */
export function recruitmentDeadlineAt(study: Study): string | undefined {
  const raw = study.recruitment?.deadline;
  if (!raw) return undefined;
  if (/T.*(?:Z|[+-]\d{2}:\d{2})$/i.test(raw) && Number.isFinite(Date.parse(raw))) return new Date(raw).toISOString();
  const fixture = (seed as Record<string, { source: string; at: string }>)[study.id];
  return fixture?.source === raw ? fixture.at : undefined;
}

/** 전 지역에서 동일한 순간에 닫힌다. 서버가 이미 닫은 모집은 다시 열지 않는다. */
export function recruitState(study: Study, now = Date.now()): RecruitState {
  if (study.status !== 'recruiting' || study.recruitment?.status === 'closed') return 'closed';
  const at = recruitmentDeadlineAt(study);
  return at && now >= Date.parse(at) ? 'closed' : 'apply';
}

export function recruitmentDeadlineDate(study: Study, zone: string): string | undefined {
  const at = recruitmentDeadlineAt(study);
  return at ? wallParts(new Date(at), zone).date : undefined;
}

export function recruitmentDeadlineLabel(study: Study, zone: string): string | undefined {
  const at = recruitmentDeadlineAt(study);
  if (!at) return undefined;
  const date = new Date(at);
  const wall = wallParts(date, zone);
  return `${wall.date} ${wall.time} ${zoneAbbreviation(zone, date)}`;
}

/** D-day는 현지 달력 날짜 차이. 신청 가능 여부 판정에 사용하지 않는다. */
export function recruitmentDaysLeft(study: Study, zone: string, now = Date.now()): number | undefined {
  const deadline = recruitmentDeadlineDate(study, zone);
  if (!deadline) return undefined;
  const today = wallParts(new Date(now), zone).date;
  return Math.round((Date.parse(`${deadline}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}
