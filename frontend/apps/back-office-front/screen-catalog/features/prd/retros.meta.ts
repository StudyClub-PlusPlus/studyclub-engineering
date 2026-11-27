import { pageOf, study } from './fixtures';
import type { Recipe, ScreenStateDef, ScreenStep } from '../../types';

// ST-040 백오피스 회고 탭 · ST-041 회고 모아보기 — 응답 모양은 src/features/meeting-retro/response-schema.ts.
// 시각은 카탈로그 고정 시각(2026-10-31T03:00:00Z) 앞뒤로 둔다: 1 · 2회차는 끝났고 3회차는 아직이다.
const studyPath = `/api/admin/studies/${study.id}`;
const participantsPath = `${studyPath}/participants`;
const statusPath = `/api/me/studies/${study.id}/retros/status`;
const listPath = (meetingId: number) => `/api/studies/${study.id}/meetings/${meetingId}/retros`;

const group = (groupId: number, name: string, i: number) => ({ groupId, name, isDefault: i === 0, canDelete: i > 0 });
const participants = (groups: ReturnType<typeof group>[]) => ({
  studyId: study.id, participantCount: 0, recruitmentCapacity: null, ownerCaptain: null, groups, participants: [],
});
const twoGroups = participants([group(1, 'A반', 0), group(2, 'B반', 1)]);

const meeting = (id: number, number: number, scheduledAt: string) => ({
  id, type: number === 0 ? 'KICKOFF' : 'REGULAR', number, scheduledAt, title: null, presenter1: null, presenter2: null, started: true,
});
const meetings = (groupId: number, list: ReturnType<typeof meeting>[]) => ({
  studyGroup: { id: groupId, name: '', timezone: 'Asia/Seoul', startTime: '20:00', navigatorName: null, rules: null, daysOfWeek: null },
  me: { participantId: null, canEdit: true }, participants: [], meetings: list,
});
const groupMeetings = meetings(1, [
  meeting(100, 0, '2026-10-08T11:00:00Z'),
  meeting(101, 1, '2026-10-15T11:00:00Z'),
  meeting(102, 2, '2026-10-29T11:00:00Z'),
  meeting(103, 3, '2026-11-05T11:00:00Z'),
]);
const status = {
  meetings: [
    { meetingId: 100, meetingEndAt: null, retroDeadline: null, retroOpen: null, retroMine: null },
    { meetingId: 101, meetingEndAt: '2026-10-15T13:00:00Z', retroDeadline: '2026-10-29T11:00:00Z', retroOpen: false, retroMine: null },
    { meetingId: 102, meetingEndAt: '2026-10-29T13:00:00Z', retroDeadline: '2026-11-05T11:00:00Z', retroOpen: true, retroMine: null },
    { meetingId: 103, meetingEndAt: '2026-11-05T13:00:00Z', retroDeadline: '2026-11-12T13:00:00Z', retroOpen: false, retroMine: null },
  ],
};
const retro = (retroId: number, participantId: number, displayName: string, good: string, improve: string, feeling: string,
  likes: { GOOD: number; IMPROVE: number; FEELING: number }, writtenAt: string) => ({
  retroId, author: { participantId, displayName, role: 'MEMBER' }, good, improve, feeling, writtenAt, likes,
});
const list = {
  meetingId: 102, deadline: '2026-11-05T11:00:00Z', open: true, targets: 4,
  retros: [
    retro(1, 11, '테스트크루', '같은 예제로 비교해 줘서 차이가 바로 보였어요.', '실습 코드를 미리 공유해 주세요.', '', { GOOD: 1, IMPROVE: 3, FEELING: 0 }, '2026-10-29T13:10:00Z'),
    retro(2, 12, '테스트크루2', '발표 자료가 깔끔했어요.', '마지막 장은 시간이 부족했어요.', '첫 발표라 떨렸는데 뿌듯해요.', { GOOD: 4, IMPROVE: 1, FEELING: 2 }, '2026-10-29T14:00:00Z'),
  ],
  missing: [{ participantId: 13, displayName: '테스트크루3' }, { participantId: 14, displayName: '테스트네비' }],
};

/** 회고 탭이 부르는 응답 — 반 목록 · 반 회차 · 회고 상태 · 고른 회차 목록. */
const retroTabApi = (overrides: NonNullable<Recipe['api']> = []): NonNullable<Recipe['api']> => [
  ...overrides,
  { path: participantsPath, json: twoGroups },
  { path: `${studyPath}/groups/1/meetings`, json: groupMeetings },
  { path: statusPath, query: { studyGroupId: '1' }, json: status },
  { path: listPath(102), json: list },
];

const adminRetro = (participantName: string, meetingNo: number, good: string, improve: string, feeling: string,
  likes: { GOOD: number; IMPROVE: number; FEELING: number }, writtenAt: string) => ({
  studyId: study.id, studyTitle: study.title, groupName: 'A반', meetingId: 100 + meetingNo, meetingNo,
  meetingStartAt: meetingNo === 1 ? '2026-10-15T11:00:00Z' : '2026-10-29T11:00:00Z', participantName, closed: meetingNo === 1,
  retro: { good, improve, feeling, likes, writtenAt },
});
const adminItems = [
  adminRetro('테스트크루2', 2, '발표 자료가 깔끔했어요.', '마지막 장은 시간이 부족했어요.', '첫 발표라 떨렸는데 뿌듯해요.', { GOOD: 4, IMPROVE: 1, FEELING: 2 }, '2026-10-29T14:00:00Z'),
  adminRetro('테스트크루', 2, '같은 예제로 비교해 줘서 차이가 바로 보였어요.', '실습 코드를 미리 공유해 주세요.', '', { GOOD: 1, IMPROVE: 3, FEELING: 0 }, '2026-10-29T13:10:00Z'),
  adminRetro('테스트크루', 1, '시간 안에 딱 끝나서 집중이 잘 됐어요.', '토론 주제를 미리 알려 주세요.', '다음 주가 기다려져요.', { GOOD: 2, IMPROVE: 2, FEELING: 1 }, '2026-10-15T15:00:00Z'),
];
const adminPage = (items: typeof adminItems) => ({
  summary: { rows: 8, written: items.length, closedRows: 4, closedWritten: items.filter((i) => i.closed).length,
    good: items.length, improve: items.length, feeling: items.filter((i) => i.retro.feeling).length },
  total: items.length, items,
});
const studyOptions = { path: '/api/admin/studies', query: { status: 'ONGOING', sort: 'TITLE_ASC' }, json: pageOf([{ studyId: study.id, title: study.title }]) };
const retrosPath = '/api/admin/retros';

const click = (selector: string): ScreenStep => ({ action: 'click', selector });
function state(id: string, scenario: string, pageId: string, url: string, text: string,
  api: NonNullable<Recipe['api']>, steps: ScreenStep[] = []): ScreenStateDef {
  return { id, label: text, pageId, prdScenarios: [scenario],
    rationale: 'PRD 연결 화면의 현재 코드 표시 상태. 서버 판정(쓸 사람 · 기한)은 이 캡처의 검증 범위가 아니다.',
    recipe: { render: { url }, api, steps }, viewports: ['desktop'], assertions: { text: { main: text } }, screenshot: { fullPage: true } };
}
const tabUrl = `/studies/${study.id}?tab=retro`;

export const prdRetroStates: ScreenStateDef[] = [
  state('study-detail--retro', 'BO-ST-040-S01', 'study-detail', tabUrl, '4명 중 2명 작성', retroTabApi()),
  state('study-detail--retro-no-ended', 'BO-ST-040-S01', 'study-detail', tabUrl, '이 반은 아직 끝난 미팅이 없습니다.',
    retroTabApi([{ path: statusPath, query: { studyGroupId: '1' }, json: { meetings: [status.meetings[0], status.meetings[3]] } }])),
  state('study-detail--retro-empty', 'BO-ST-040-S01', 'study-detail', tabUrl, '아직 이 회차에 남긴 회고가 없습니다.',
    retroTabApi([{ path: listPath(102), json: { ...list, retros: [], missing: [...list.missing, { participantId: 11, displayName: '테스트크루' }, { participantId: 12, displayName: '테스트크루2' }] } }])),
  state('retros--default', 'BO-ST-041-V01', 'retros', '/retros', '총 3건', [studyOptions, { path: retrosPath, json: adminPage(adminItems) }]),
  state('retros--table', 'BO-ST-041-V02', 'retros', '/retros?view=table', '총 3건', [studyOptions, { path: retrosPath, json: adminPage(adminItems) }]),
  state('retros--loading', 'BO-ST-041-V03', 'retros', '/retros', '회고 모아보기', [studyOptions, { path: retrosPath, pending: true }]),
  state('retros--empty', 'BO-ST-041-V04', 'retros', '/retros', '조건에 맞는 의견이 없어요.', [studyOptions, { path: retrosPath, json: adminPage([]) }]),
  state('retros--table-empty', 'BO-ST-041-V05', 'retros', '/retros?view=table', '조건에 맞는 회고가 없어요.', [studyOptions, { path: retrosPath, json: adminPage([]) }]),
  state('retros--error', 'BO-ST-041-V06', 'retros', '/retros', '회고를 불러오지 못했습니다.', [studyOptions, { path: retrosPath, status: 500, json: {} }]),
];
// 표시 상태가 함께 보여 주는 완료 기준(S) — 행동 전체가 아니라 화면 근거다
const alsoCovers: Record<string, string[]> = {
  'retros--default': ['BO-ST-041-S01', 'BO-ST-041-S03', 'BO-ST-041-S05'],
  'retros--table': ['BO-ST-041-S02', 'BO-ST-041-S04', 'BO-ST-041-S06', 'BO-ST-041-S07'],
  'retros--empty': ['BO-ST-041-S09'],
  'retros--table-empty': ['BO-ST-041-S09'],
};
for (const item of prdRetroStates) {
  item.prdScenarios = [...item.prdScenarios!, ...(alsoCovers[item.id] ?? [])];
  if (item.id === 'study-detail--retro') {
    item.assertions!.visible = ['[aria-label="작성 현황"]', 'nav[aria-label="반"]'];
    item.viewports = ['desktop', 'mobile'];
  }
  if (item.id === 'retros--default' || item.id === 'retros--table') item.viewports = ['desktop', 'mobile'];
  if (item.id === 'retros--empty' || item.id === 'retros--table-empty') item.assertions!.disabled = ['button:has-text("CSV 내려받기")'];
  if (item.id === 'retros--error') item.assertions!.visible = ['button:has-text("다시 시도")'];
}
// 회차 칩을 눌러 지난 회차를 본다 — 마감 문구가 「… 마감」으로 바뀐다
prdRetroStates.push({
  ...state('study-detail--retro-closed-meeting', 'BO-ST-040-S01', 'study-detail', tabUrl, '10.29 20:00 KST 마감',
    retroTabApi([{ path: listPath(101), json: { ...list, meetingId: 101, deadline: '2026-10-29T11:00:00Z', open: false } }]),
    [click('[role="radio"]:has-text("1회차")')]),
});
