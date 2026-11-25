import type { Study, StudyKind } from '@studyclub/types';

/**
 * 스터디 상세(운영 콘솔)에서 **종류마다 다른 것**을 한 표에 모은다.
 * 화면은 `study.program.kind` 를 직접 보지 않고 이 표만 본다 — 종류가 늘거나 규칙이 바뀌면 여기만 고친다.
 *
 * 클럽마다 다른 것(시간대 · 명단에 보이는 질문 · 정원)은 여기가 아니라 클럽 설정(`ClubConfig`)이다.
 */
export type KindRules = {
  /** 숨기는 탭 — 클럽은 모임 시각 · 킥오프가 없어 일정 탭이 없다 */
  hiddenTabs: readonly string[];
  /** 신청자 탭에서 반을 나누는가 — 클럽은 기본 반 하나라 반을 드러내지 않는다 */
  grouping: boolean;
  /** 위 출석률 칸 아래 줄 — 무엇을 셌는지 */
  rateScope: string;
  /** 끝난 뒤 「이 내용으로 새 스터디」를 띄우는가 — 스터디는 기수가 1개라 새 공고가 곧 새 프로그램이다 */
  reusable: boolean;
  /** 머리의 다음 기수 링크 — 클럽의 다음 기수는 클럽 운영이 만든다 (POL-0012) */
  nextCohort?: { label: string; href: string };
};

export const KIND_RULES: Record<StudyKind, KindRules> = {
  study: {
    hiddenTabs: [],
    grouping: true,
    rateScope: '모든 반 · 지각 포함',
    reusable: true,
  },
  club: {
    hiddenTabs: ['schedule'],
    grouping: false,
    rateScope: '이번 기수 · 지각 0.5일',
    reusable: false,
    nextCohort: { label: '다음 기수 · 클럽 운영', href: '/proto/console/clubs' },
  },
};

export function kindOf(study: Pick<Study, 'program' | 'kind'>): StudyKind {
  return study.program?.kind ?? study.kind ?? 'study';
}

export function kindRules(study: Pick<Study, 'program' | 'kind'>): KindRules {
  return KIND_RULES[kindOf(study)];
}
