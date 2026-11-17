'use client';

import { studies } from '@studyclub/mock';

import { lifeStatus } from './joined';
import { getApplications, resetMemberData, setDiscord, addApplication } from './me';

export type DiscordOutcome = 'success' | 'error' | 'cancelled';
const OUTCOME_KEY = 'playground_discord_outcome';

export function getDiscordOutcome(): DiscordOutcome {
  const value = localStorage.getItem(OUTCOME_KEY);
  return value === 'error' || value === 'cancelled' ? value : 'success';
}

export function setDiscordOutcome(value: DiscordOutcome) {
  localStorage.setItem(OUTCOME_KEY, value);
}

/** Prototype uses the same participation lifecycle as 내 스터디룸. Unknown records fail closed.
 * TODO(api): 연결 해제 API에서 참여 상태를 원자적으로 재검증. 경로·상태 계약은 specs/profile-edit/spec.md 참조.
 */
export function hasDiscordParticipation(): boolean {
  return getApplications().some((application) => {
    const study = studies.find((item) => item.id === application.studyId);
    return !study || lifeStatus(study) !== 'ended';
  });
}

/** Explicit reviewer action only; normal page visits preserve the member's state. */
export function setDiscordFixture(state: 'unlinked' | 'linked' | 'participating' | 'ended') {
  resetMemberData();
  setDiscord(state === 'unlinked' ? null : 'jiwon_dev');
  if (state === 'participating' || state === 'ended') {
    addApplication({
      studyId: state === 'participating' ? 'ai-paper-study' : 'sql-for-data-analysis',
      status: 'accepted',
      appliedAt: '2026-10-25',
      region: 'KR',
    });
  }
}

/** Preserve a safe study URL while dropping only the automatic form-open intent. */
export function withoutApplyIntent(path: string): string {
  const url = new URL(path, 'https://playground.invalid');
  url.searchParams.delete('apply');
  return `${url.pathname}${url.search}${url.hash}`;
}
