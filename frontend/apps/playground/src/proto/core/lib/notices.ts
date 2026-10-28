import type { Announcement, L10n } from '@core/lib/content';

/**
 * 공지사항 — 공지 API 가 생기기 전까지 여기가 정본이다. 실제로 내보낸 공지만 둔다(예시 공지 금지).
 * 쓰는 법: docs/frontend-development-guide/ui-copy.md (줄표 금지 · 비용 단정 금지) + 해요체, 소제목 단위로 짧게.
 * 본문 블록: h(소제목) · p(문단) · ul(목록) · link(바로가기). 마크다운 렌더러를 들이지 않으려고 블록으로 둔다.
 */
export type NoticeBlock =
  | { h: L10n }
  | { p: L10n }
  | { ul: L10n[] }
  | { link: { label: L10n; href: string } };

export type Notice = Omit<Announcement, 'body'> & {
  /** 목록 카드에 두 줄로 보이는 요약 */
  summary: L10n;
  blocks: NoticeBlock[];
};

export const NOTICES: Notice[] = [
  {
    id: '2026-11-studyclub-open',
    tag: 'notice',
    pinned: true,
    // TODO(사람): 실제 게시일로 바꾼다. 오픈일이 11월 중 정해지면 같이 고친다
    date: '2026-11-01',
    title: { ko: '스터디클럽이 새 이름, 새 홈페이지로 문을 열어요', en: 'StudyClub opens with a new name and a new website' },
    summary: {
      ko: '11월, 스터디클럽이 새 이름으로 studyclub.life 에서 새 홈페이지를 열어요. 스터디를 찾고 바로 신청할 수 있어요.',
      en: 'In November, StudyClub opens a new website under its new name at studyclub.life, where you can find a study and apply right away.',
    },
    blocks: [
      { p: { ko: '안녕하세요, 스터디클럽 캡틴입니다.', en: 'Hello from the StudyClub organizers.' } },
      {
        p: {
          ko: '2024년 초 실리콘밸리에서 몇 명이 모여 시작한 스터디 모임이, 이제 미국·캐나다·한국의 개발자 2,800명 넘게 함께하는 커뮤니티가 되었어요. 그동안 디스코드와 구글 폼으로 스터디를 찾고 신청해 주신 모든 분께 감사드려요.',
          en: 'What began in early 2024 as a handful of people studying together in Silicon Valley is now a community of more than 2,800 engineers across the US, Canada, and Korea. Thank you to everyone who found and joined studies through Discord and Google Forms.',
        },
      },
      {
        p: {
          ko: '11월, 스터디클럽이 새 이름과 새 홈페이지로 정식 오픈해요. 바뀌는 점을 핵심만 안내드려요.',
          en: 'In November, StudyClub officially opens with a new name and a new website. Here is what changes.',
        },
      },
      { h: { ko: '이름과 주소가 바뀌어요', en: 'New name, new address' } },
      {
        ul: [
          { ko: '이름: 스터디클럽으로 바뀌었어요', en: 'Name: we are now StudyClub' },
          { ko: '주소: studyclub.life', en: 'Address: studyclub.life' },
          { ko: '예전 주소로 들어와도 새 주소로 이어져요.', en: 'The old address takes you to the new one.' },
        ],
      },
      { h: { ko: '홈페이지에서 스터디를 찾고 바로 신청해요', en: 'Find a study and apply on the website' } },
      {
        ul: [
          { ko: '모집 중인 스터디를 분야·모집 상태·시간대로 골라 볼 수 있어요.', en: 'Browse open studies by topic, recruiting status, and time zone.' },
          {
            ko: '구글 계정으로 로그인하고 스터디 페이지에서 신청서를 내면 바로 크루가 돼요.',
            en: "Sign in with Google and submit the application on the study's page. You're Crew right away.",
          },
          { ko: '이제 모집 글마다 구글 폼을 찾아다니지 않아도 돼요.', en: 'No more hunting for a Google Form for each study.' },
        ],
      },
      { link: { label: { ko: '모집 중인 스터디 보기', en: 'See open studies' }, href: '/studies' } },
      { h: { ko: '모임과 대화는 디스코드에서 그대로', en: 'Meetings and chat stay on Discord' } },
      {
        p: {
          ko: '스터디 모임과 대화는 지금처럼 디스코드에서 해요. 신청할 때 디스코드 서버 별명을 함께 적어 주세요.',
          en: 'Study sessions and conversations stay on Discord. Please add your Discord server nickname when you apply.',
        },
      },
      { h: { ko: '행사 기록과 가이드도 한곳에', en: 'Events and the guide in one place' } },
      {
        p: {
          ko: '지난 행사와 처음 오신 분을 위한 가이드를 홈페이지에 모았어요.',
          en: 'Past events and a guide for newcomers now live on the website.',
        },
      },
      { link: { label: { ko: '가이드 보기', en: 'Read the guide' }, href: '/guide' } },
      {
        p: {
          ko: '새 홈페이지는 계속 다듬어 갈게요. 불편한 점이나 아이디어는 디스코드 또는 contact@studyclub.life 로 알려 주세요. 감사합니다.',
          en: "We'll keep improving the site. Share any issues or ideas on Discord or at contact@studyclub.life. Thank you.",
        },
      },
    ],
  },
];

export function getNotice(id: string): Notice | undefined {
  return NOTICES.find((n) => n.id === id);
}
