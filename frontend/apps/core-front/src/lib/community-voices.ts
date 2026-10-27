import type { L10n } from '@/lib/content';

/**
 * 커뮤니티 후기 · 지난 스터디 — 홈·소개의 슬라이딩 띠와 행사 상세가 읽는다.
 *
 * 출처(2026-10-18 옮김): 운영진 「스터디클럽 소개」 문서의 후기 정리(2024-09) · 2024 회원 서베이 응답 ·
 * 「스터디·행사 현황」 시트. 문장은 원문 그대로 두고 괄호 보충만 걷었다.
 * 이름은 싣지 않는다 — 직군·도시까지만. 원문에 없는 후기를 지어 넣지 않는다.
 */
export type Voice = { quote: L10n; who?: L10n; from: L10n };

export const VOICES: Voice[] = [
  {
    quote: {
      ko: '꾸준하고 다양한 종류의 스터디가 있고, 무엇보다 열정적인 분위기가 인상적이었다.',
      en: 'Steady, varied studies, and above all, an energetic atmosphere.',
    },
    from: { ko: '회원 서베이', en: 'Member survey' },
  },
  {
    quote: {
      ko: '미국 중서부의 고립감을 디스코드 스터디로 해소할 수 있는 기회였다.',
      en: 'Discord studies broke the isolation of living in the Midwest.',
    },
    who: { ko: 'DS · St. Louis', en: 'DS · St. Louis' },
    from: { ko: '스터디 후기', en: 'Study review' },
  },
  {
    quote: {
      ko: '적절한 교재를 선정해서 좋았고 현업에서 겪은 경험을 공유한 것이 인상 깊었다.',
      en: 'Great choice of materials, and the real work stories stuck with me.',
    },
    who: { ko: 'DS · Alameda', en: 'DS · Alameda' },
    from: { ko: 'DS 인터뷰 스터디', en: 'DS Interview study' },
  },
  {
    quote: {
      ko: '현업이 바빠져도 스터디 덕분에 멱살 잡히면서 끝까지 완주할 수 있었다. 드디어 코세라 수료증을 취득했다.',
      en: 'Even when work got busy, the group dragged me to the finish line. I finally earned my Coursera certificate.',
    },
    who: { ko: 'HWE · San Jose', en: 'HWE · San Jose' },
    from: { ko: 'ML 기초 스터디', en: 'ML Basics study' },
  },
  {
    quote: {
      ko: '다른 사람들과 같이 으쌰으쌰 하면서 공부하고, 시간 기록하는 습관을 갖게 되어 하루를 더 알차게 보낼 수 있었다.',
      en: 'Studying alongside others built a habit of tracking my time, and my days got fuller.',
    },
    who: { ko: 'SWE · Mountain View', en: 'SWE · Mountain View' },
    from: { ko: 'Weekly X', en: 'Weekly X' },
  },
  {
    quote: {
      ko: '100일 이상 꾸준히 공부하면서 매일 공부할 수 있는 습관을 만들 수 있었다.',
      en: 'I studied for over 100 days straight and built a daily habit.',
    },
    who: { ko: 'SWE · San Jose', en: 'SWE · San Jose' },
    from: { ko: 'Weekly X', en: 'Weekly X' },
  },
  {
    quote: {
      ko: '열심히 공부하는 한국인 분들을 보며 큰 동기부여를 받고, 함께 공부하며 어려운 개념들을 빠르게 이해할 수 있어 좋았다.',
      en: 'Seeing fellow Korean engineers study hard kept me motivated, and hard concepts clicked faster together.',
    },
    who: { ko: 'DA · New York', en: 'DA · New York' },
    from: { ko: '스터디 후기', en: 'Study review' },
  },
  {
    quote: {
      ko: '매주 함께하는 분들이 있다 보니 끝까지 할 수 있었다.',
      en: 'Having people there every week is what got me to the end.',
    },
    who: { ko: 'SWE · 서울', en: 'SWE · Seoul' },
    from: { ko: 'ML 기초 스터디', en: 'ML Basics study' },
  },
  {
    quote: {
      ko: '정말 다양한 직군과 연차와 지역의 사람들이 있다는 점이 좋았다.',
      en: 'People from so many roles, career stages, and regions.',
    },
    from: { ko: '회원 서베이', en: 'Member survey' },
  },
  {
    quote: {
      ko: '같은 목표를 공유하는 분들과 같이 공부도 하고 네트워킹도 하는 점이 좋았어요!',
      en: 'Studying and networking with people who share the same goal.',
    },
    from: { ko: '회원 서베이', en: 'Member survey' },
  },
  {
    quote: {
      ko: '레퍼럴을 요청할 수 있는 공간이 마땅치 않은데, 레퍼럴할 수 있는 시스템이 있어서 좋았다.',
      en: "Referrals are hard to come by, and here there's a way to ask for one.",
    },
    from: { ko: '회원 서베이', en: 'Member survey' },
  },
  {
    quote: { ko: '딱딱하기보다는 따뜻한 느낌 나는 커뮤니티입니다.', en: 'A warm community, not a stiff one.' },
    from: { ko: '회원 서베이', en: 'Member survey' },
  },
  {
    quote: {
      ko: '다양한 게임과 맛있는 음식까지 세세하게 준비해 주셔서 즐거운 시간이었고, 모두들 직접 만나 뵙게 되어 반가웠다.',
      en: 'Games, great food, and finally meeting everyone in person.',
    },
    who: { ko: 'UX · San Jose', en: 'UX · San Jose' },
    from: { ko: '베이 에어리어 피크닉', en: 'Bay Area picnic' },
  },
];

/** 지금까지 열린 스터디 일부 — 「스터디·행사 현황」 시트(2024~2026)에서 이름만. 띠 하나에 너무 길지 않게 고른다. */
export const PAST_STUDIES: string[] = [
  'DDIA 2판',
  'Claude Code 소스코드',
  'System Design Interview',
  'Daily LeetCode',
  'AI 논문',
  'PyTorch 실전 코딩',
  'LLM Agents',
  'AI Engineering 북클럽',
  'ML 시스템 디자인 인터뷰',
  'Practical Causal Inference',
  'Streaming Systems',
  '실전 레디스',
  'AWS CPC',
  'Security',
  'SQL for Data Analysis',
  'Kaggle',
  'Efficient ML',
  '로봇 AI',
  'Golang',
  'React 초급',
  'UI Challenge',
  'Mobile App Growth',
  'Continuous Discovery Habits',
  'Thinking, Fast and Slow',
  '합격을 부르는 이력서',
  'Public Speaking',
  '독일어',
  '입문 중국어',
  '영자신문',
  '얼리버드',
  'Weekly X',
  '르네상스 클럽',
];
