import type { ScreenStateDef } from '../../types';
import { authScreenStates } from '../auth/login.meta';
import { joinedScheduleScreenStates } from '../my/joinedSchedule.meta';
import { siteScreenStates } from '../site/site.meta';

function existing(states: ScreenStateDef[], id: string): ScreenStateDef {
  const state = states.find((item) => item.id === id);
  if (!state) throw new Error(`Missing catalog state: ${id}`);
  return state;
}

const profile = existing(authScreenStates, 'my--default');
const schedule = existing(joinedScheduleScreenStates, 'my-joined-schedule--navigator');
const attendance = existing(joinedScheduleScreenStates, 'my-joined-attendance--crew');
const terms = existing(siteScreenStates, 'terms--default');

export const prdScreenStates: ScreenStateDef[] = [
  {
    ...profile,
    id: 'my--editing',
    prdScenarios: ['CORE-ST-012-V02', 'CORE-ST-012-S02'],
    label: '내 정보 — 닉네임·시간대 편집',
    rationale: 'ST-012: 편집 진입과 취소·저장 버튼을 확인한다. 저장 성공은 별도 행동 검증 대상이다.',
    recipe: { ...profile.recipe, steps: [{ action: 'click', selector: 'button[aria-label="내 정보 수정"]' }] },
    assertions: { visible: ['input[aria-label="닉네임"]', 'button:has-text("취소")', 'button:has-text("저장")'] },
  },
  {
    ...schedule,
    id: 'my-joined-schedule--create',
    prdScenarios: ['CORE-ST-015-S04'],
    label: '내 스터디 일정 — 회차 추가 창',
    rationale: 'ST-015: 회차 추가 창의 일자·시각·반복 입력을 확인한다. 생성 결과는 검증하지 않는다.',
    recipe: { ...schedule.recipe, steps: [{ action: 'click', selector: 'button:has-text("회차 추가")' }] },
    assertions: {
      visible: ['[role="dialog"]', '[role="dialog"] h2:has-text("회차 추가")', '[role="group"][aria-label="반복"]'],
    },
  },
  {
    ...attendance,
    id: 'my-joined-attendance--presenter-help',
    prdScenarios: ['CORE-ST-010-S03', 'CORE-ST-017-S13'],
    label: '출석 — 발표 표시 설명',
    rationale: 'ST-010·017: 발표 표시 설명 버튼으로 마이크 표시와 발표 횟수의 설명을 연다.',
    recipe: { ...attendance.recipe, steps: [{ action: 'click', selector: 'button[aria-label="발표 표시 설명"]' }] },
    assertions: {
      visible: ['[role="dialog"][aria-label="발표 표시 설명"]'],
      text: { '#presenter-help': '그 회차 발표자' },
    },
  },
  {
    ...terms,
    id: 'terms--english',
    prdScenarios: ['CORE-ST-014-V02'],
    label: '이용약관 — 영문 제목·한국어 원문',
    rationale: 'ST-014: en 로케일에서 제목은 영어, 법률 본문은 한국어로 표시한다.',
    recipe: { render: { url: '/en/terms' } },
    assertions: { visible: ['h1:has-text("Terms of Service")'], text: { main: '제1조' } },
  },
];
