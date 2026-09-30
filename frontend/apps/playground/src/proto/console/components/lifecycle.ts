import type { LifecycleState } from '@studyclub/mock';

/** 스터디 상태 표시 문구. 코드값은 백엔드 `STUDY.STATUS` 와 같다. */
export const LIFECYCLE_LABEL: Record<LifecycleState, string> = {
  DRAFT: '작성 중',
  OPEN: '개설',
  ONGOING: '진행 중',
  ENDED: '종료',
  CLOSED: '운영 종료',
};

/** 배지 색. 모집 상태 배지(모집중/마감)와 색이 겹치지 않게 진행 단계 쪽 톤을 쓴다. */
export const LIFECYCLE_TONE: Record<LifecycleState, 'neutral' | 'recruiting' | 'inprogress' | 'absent' | 'closed'> = {
  DRAFT: 'neutral',
  OPEN: 'recruiting',
  ONGOING: 'inprogress',
  // 종료는 빨강 — 회색이면 운영 종료(CLOSED)·미공개와 구분되지 않는다. 팔레트의 빨강 톤(absent)을 빌려 쓴다.
  ENDED: 'absent',
  CLOSED: 'closed',
};

export const LIFECYCLE_ORDER: LifecycleState[] = ['DRAFT', 'OPEN', 'ONGOING', 'ENDED', 'CLOSED'];

/**
 * 상태 칩에 올렸을 때 보이는 설명 — 뜻, 다음 단계로 넘기는 주체, (있으면) 클럽에서 달라지는 조건.
 *
 * `clubNote` 는 「종료」·「운영 종료」에만 있다 — 클럽은 기수가 바뀌어도 디스코드 채널을 지우지 않고
 * 다음 기수가 그대로 물려받는다. 그래서 "채널 삭제 = 운영 종료"를 지나간 기수 하나하나에 적용할 수
 * 없다 — 그 프로그램에서 가장 최신 기수만 운영 종료로 넘어갈 수 있고, 나머지는 종료에 영구히 남는다.
 * 자세한 이유: docs/erd/STUDY.md#채널-삭제와-closed
 */
export const LIFECYCLE_HINT: Record<LifecycleState, { meaning: string; next?: string; clubNote?: string }> = {
  DRAFT: { meaning: '작성 중 · 모집 전. 사이트에 보이지 않는다.', next: '캡틴이 공개하며 모집을 시작하면 「개설」로 넘어간다.' },
  OPEN: { meaning: '스터디 개설 — 공개하면서 모집을 시작한 단계. 사이트에 노출된다.', next: '네비게이터가 첫 미팅을 등록하면 「진행 중」으로 넘어간다.' },
  ONGOING: {
    meaning: '(미팅) 진행 중.',
    next: '네비게이터가 종료 처리하거나 마지막 미팅으로부터 N주가 지나면 「종료」로 넘어간다.',
  },
  ENDED: {
    meaning: '(미팅) 종료.',
    next: '캡틴이 채널을 삭제하고 운영을 끝내면 「운영 종료」로 넘어간다.',
    clubNote: '클럽: 채널을 다음 기수가 그대로 물려받아 지우지 않는다 — 지나간 기수는 여기 영구히 남고, 운영 종료로 넘어갈 수 있는 건 이 프로그램의 최신 기수뿐이다.',
  },
  CLOSED: {
    meaning: '채널 삭제 완료 · 운영 종료.',
    clubNote: '클럽: 이 프로그램의 최신 기수만 여기로 올 수 있다 — 지나간 기수는 채널을 물려주고 「종료」에 머무른다.',
  },
};
