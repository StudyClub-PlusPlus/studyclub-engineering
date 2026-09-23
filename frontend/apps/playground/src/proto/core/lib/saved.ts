import { getApplications } from '@core/lib/me';
import type { Study } from '@studyclub/mock';

/**
 * 찜한 스터디 — 모집 여부가 아니라 **스터디 진행 상태**로 나눈다.
 *
 * 하트를 누른 뒤에도 스터디는 모집·진행·종료로 흘러간다.
 * 크루가 다시 오는 이유는 "아직 신청할 수 있는 것"을 찾는 경우가 많아서
 * 기본 필터는 모집중이다.
 */
export type SavedFilter = 'all' | Study['status'];

export const FILTERS: { key: SavedFilter; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'recruiting', label: '모집중' },
  { key: 'ongoing', label: '진행중' },
  { key: 'closed', label: '종료' },
];

export const STATUS_LABEL: Record<Study['status'], string> = {
  recruiting: '모집중',
  ongoing: '진행중',
  closed: '종료',
};

export const STATUS_TONE: Record<Study['status'], 'recruiting' | 'inprogress' | 'ended'> = {
  recruiting: 'recruiting',
  ongoing: 'inprogress',
  closed: 'ended',
};

export const EMPTY: Record<SavedFilter, { title: string; description: string }> = {
  all: {
    title: '찜한 스터디가 없습니다',
    description: '스터디 카드의 하트를 누르면 여기에 모입니다.',
  },
  recruiting: {
    title: '모집중인 찜한 스터디가 없습니다',
    description: '아직 모집 중인 스터디를 담으면 여기에 모입니다.',
  },
  ongoing: {
    title: '진행 중인 찜한 스터디가 없습니다',
    description: '이미 시작된 스터디를 담으면 여기에 모입니다.',
  },
  closed: {
    title: '종료된 찜한 스터디가 없습니다',
    description: '끝난 스터디를 담으면 여기에 모입니다.',
  },
};

/**
 * 나와의 신청 관계. 찜과 참여는 다른 축이라 둘 다 있을 수 있다.
 * - none     : 신청하지 않음
 * - pending  : 승인 대기
 * - accepted : 참여 중(또는 참여했던)
 */
export type Relation = 'none' | 'pending' | 'accepted';

export function relationOf(studyId: string): Relation {
  const app = getApplications().find((a) => a.studyId === studyId);
  if (!app) return 'none';
  return app.status === 'accepted' ? 'accepted' : 'pending';
}
