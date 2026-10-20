import type { L10n } from '@core/lib/content';

/**
 * 행사 상세 본문 — 행사 API 가 생기기 전까지 여기서 읽는다.
 *
 * 출처(2026-10-18 옮김): 운영진 「스터디클럽 소개」 문서의 이벤트 설명·후기 정리, 2024 회원 서베이,
 * 「스터디·행사 현황」 시트. **근거가 있는 행사만** 채운다 — 없는 행사는 공통 안내만 보인다.
 * 후기는 원문 그대로, 이름은 싣지 않는다.
 */
export type EventDetail = { about: L10n[]; voices?: L10n[] };

const CAREER_TALK_ABOUT: L10n = {
  ko: '다른 직군이 어떤 일을 하는지 알면 함께 일하기가 쉬워져요. 직업탐방은 현직자가 자기 경험을 바탕으로 일과 커리어 이야기를 들려주는 자리예요.',
  en: "Knowing what other roles actually do makes working together easier. In Career Talks, working professionals share their jobs and career paths from their own experience.",
};

export const EVENT_DETAILS: Record<string, EventDetail> = {
  'career-talk-hwe-hr-ux': {
    about: [
      CAREER_TALK_ABOUT,
      {
        ko: '하드웨어 엔지니어(HWE), HR, UX 세 직군의 연사가 각자의 방식으로 일과 이직 이야기를 나눴어요.',
        en: 'Speakers from hardware engineering, HR, and UX each shared how they work and how job changes happen in their field.',
      },
    ],
    voices: [
      { ko: '연사분들이 본인의 경험을 바탕으로 이야기해 주셔서 와닿았고 도움이 되었다.', en: 'The speakers drew on their own experience, which made it land.' },
      { ko: '내 직업과 다른 직업군의 관점에서 생각해 보고 조언을 들을 수 있어 좋았다.', en: 'I got to think from another role’s point of view and hear their advice.' },
      { ko: '직무별로 이직이 어떻게 이뤄지는지 대략적으로 알 수 있어서 좋았다.', en: 'I learned roughly how job changes work in each role.' },
      { ko: '세 연사님의 다른 접근 방식이 흥미로웠고, 연사로 참여해 보고 싶다는 생각이 들었다.', en: 'Three different approaches. It made me want to speak next time.' },
    ],
  },
  'career-talk-swe-mle': {
    about: [
      CAREER_TALK_ABOUT,
      {
        ko: '소프트웨어 엔지니어(SWE)와 머신러닝 엔지니어(MLE) 직군을 다룬 직업탐방이에요.',
        en: 'This Career Talk covered software engineering (SWE) and machine learning engineering (MLE).',
      },
    ],
  },
  'design-thinking-101': {
    about: [
      {
        ko: '디자인 씽킹을 직접 해 보는 입문 워크샵이에요. 문제를 정의하고 아이디어를 내는 과정을 함께 연습해요.',
        en: 'A hands-on intro to design thinking. You practice defining a problem and generating ideas together.',
      },
      {
        ko: '1기 자리가 빨리 마감돼 다시 열어 달라는 요청이 이어졌고, 2기까지 진행했어요.',
        en: 'The first cohort filled up fast, and after many requests a second cohort followed.',
      },
    ],
    voices: [
      { ko: '사람이 빨리 마감된 워크샵이라, 다음 회에 한 번 더 열어 주셨으면 좋겠어요.', en: 'It filled up so fast. Please run it again.' },
    ],
  },
  'beyond-prompt-engineering': {
    about: [
      {
        ko: '프롬프트 엔지니어링 그다음을 다룬 온라인 세션이에요. 약 60명이 함께했어요.',
        en: 'An online session on what comes after prompt engineering, with about 60 attendees.',
      },
    ],
  },
};

/** 모든 행사 상세 아래에 붙는 공통 안내 — 스터디클럽 행사가 어떤 것들인지 */
export const EVENT_KINDS: { title: L10n; body: L10n }[] = [
  {
    title: { ko: '직업탐방', en: 'Career Talks' },
    body: { ko: '다른 직군의 일을 알면 협업이 쉬워져요. 현직자가 직무와 커리어를 이야기해요.', en: 'Working professionals talk about their roles and careers.' },
  },
  {
    title: { ko: '취업 세미나', en: 'Job-search seminars' },
    body: { ko: '최근 취업한 분들이 과정과 팁을 나눠요.', en: 'People who recently landed jobs share their process and tips.' },
  },
  {
    title: { ko: '네트워킹', en: 'Networking' },
    body: { ko: '커피챗·살롱으로 같은 분야 사람들과 만나요.', en: 'Coffee chats and salons with people in your field.' },
  },
  {
    title: { ko: '오프라인 모임', en: 'In person' },
    body: { ko: '피크닉과 복습 특강으로 온라인에서 보던 크루를 직접 만나요.', en: 'Picnics and review sessions to meet your crew in person.' },
  },
];

/** 행사 후기 — 특정 행사에 묶이지 않은 것(알고리즘 복습 특강·시스템 디자인·인터뷰 경험 공유 등) */
export const EVENT_VOICES: { quote: L10n; from: L10n }[] = [
  {
    quote: { ko: '이해하지 못했던 부분을 오프라인 복습 특강을 통해 이해할 수 있어서 많은 도움이 되었다.', en: 'The in-person review session cleared up what I had missed online.' },
    from: { ko: '알고리즘 복습 특강', en: 'Algorithm review session' },
  },
  {
    quote: { ko: '시스템 디자인에 대한 경력자들의 의견과 인터뷰 준비 요령을 들을 수 있어 도움이 되었다.', en: 'Hearing experienced engineers on system design and interview prep helped a lot.' },
    from: { ko: '시스템 디자인 인터뷰', en: 'System design interview' },
  },
  {
    quote: { ko: '코딩 테스트 준비를 짧은 기간에 어떻게 해야 하는지와 인터뷰에서 대화로 풀어 가는 방법을 배웠다.', en: 'I learned how to prep for coding tests fast and talk my way through an interview.' },
    from: { ko: 'Red Flags + 인터뷰 경험 공유', en: 'Red Flags + interview stories' },
  },
];
