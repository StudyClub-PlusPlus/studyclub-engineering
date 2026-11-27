import { HttpResponse } from 'msw';

import { CAPTAIN_STUDY_IDS, NAVIGATOR_STUDY_IDS, getStudyMeetingIds } from './meetings';
import { studies } from '../../data';
import { getStudyCrew } from '../../data/crew';
import { currentUserName, mockClient, type MockResolveContext } from '../utils';

/**
 * 미팅 회고 목 — specs/meeting-retro/spec.md.
 * 다른 참여자는 끝난 회차마다 열에 여섯 꼴로 썼고, 나(participantId 1)는 가장 최근에 끝난 회차만 아직 안 썼다.
 * 캡틴 스터디(CAPTAIN_STUDY_IDS)에서는 내가 쓸 사람이 아니다.
 */

const SECTIONS = ['GOOD', 'IMPROVE', 'FEELING'] as const;
type Section = (typeof SECTIONS)[number];
const MEETING_MINUTES = 120;
const LAST_MEETING_EXTRA_DAYS = 7;
const ME = 1;

const GOOD = [
  '같은 예제로 비교해 줘서 차이가 바로 보였어요.',
  '발표자가 예제를 직접 만들어 와서 토론이 구체적이었어요.',
  '표로 정리한 비교 자료가 좋았어요.',
  '실무 사례 이야기가 도움이 됐어요.',
  '시간 안에 딱 끝나서 집중이 잘 됐어요.',
];
const IMPROVE = [
  '실습 코드를 미리 공유해 주면 따라가기 쉬울 것 같아요.',
  '마지막 장까지는 시간이 부족했어요.',
  '화면 공유 글씨가 작았어요.',
  '토론 주제를 미리 알려 주세요.',
  '시작 시간이 자꾸 늦어져요.',
];
const FEELING = ['첫 발표라 떨렸는데 끝나고 나니 뿌듯해요.', '', '점점 스터디가 습관이 되는 느낌이에요.', '다음 주가 기다려져요.', ''];

type StoredRetro = {
  retroId: number;
  participantId: number;
  displayName: string;
  role: string;
  good: string;
  improve: string;
  feeling: string;
  writtenAt: string;
  likes: Record<Section, number>;
};

/** studyId → meetingId → 회고. 처음 열 때 가정 데이터로 채운다. */
const retroState = new Map<number, Map<number, StoredRetro[]>>();
/** 내가 누른 👍 — `${retroId}:${section}` */
const myLikes = new Set<string>();
let nextRetroId = 900_000;

function seed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return Math.abs(h);
}

function idOf(value: string | string[] | undefined) {
  return Number(Array.isArray(value) ? value[0] : value);
}

function error(status: number, errorCode: string, errorMessage: string) {
  return HttpResponse.json({ errorCode, errorMessage }, { status });
}

function contextOf(params: MockResolveContext['params'], request?: Request) {
  const studyId = idOf(params.studyId);
  const study = studies.find((s) => s.study_id === studyId);
  if (!study) return undefined;
  const captain = CAPTAIN_STUDY_IDS.has(studyId);
  const navigator = NAVIGATOR_STUDY_IDS.has(studyId);
  const people = [
    ...(captain ? [] : [{ participantId: ME, name: currentUserName(request), role: navigator ? 'LEADER' : 'MEMBER' }]),
    ...getStudyCrew(study).crew.map((p, i) => ({ participantId: i + 2, name: p.name, role: 'MEMBER' })),
  ];
  const regular = getStudyMeetingIds(studyId, study)
    .filter((m) => m.type !== 'KICKOFF')
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  const meetings = regular.map((m, i) => {
    const end = new Date(m.scheduledAt).getTime() + MEETING_MINUTES * 60_000;
    const next = regular[i + 1];
    const deadline = next ? new Date(next.scheduledAt).getTime() : end + LAST_MEETING_EXTRA_DAYS * 86_400_000;
    return { id: m.id, end, deadline };
  });
  return { studyId, captain, navigator, people, meetings };
}

type Ctx = NonNullable<ReturnType<typeof contextOf>>;

function retrosOf(ctx: Ctx, meetingId: number): StoredRetro[] {
  const byMeeting = retroState.get(ctx.studyId) ?? new Map<number, StoredRetro[]>();
  retroState.set(ctx.studyId, byMeeting);
  const existing = byMeeting.get(meetingId);
  if (existing) return existing;
  const now = Date.now();
  const ended = ctx.meetings.filter((m) => m.end <= now);
  const meeting = ended.find((m) => m.id === meetingId);
  const list: StoredRetro[] = [];
  if (meeting) {
    const latest = ended.at(-1)?.id;
    for (const p of ctx.people) {
      const s = seed(`${meetingId}|${p.participantId}`);
      const wrote = p.participantId === ME ? meetingId !== latest : s % 10 < 6;
      if (!wrote) continue;
      list.push({
        retroId: nextRetroId++,
        participantId: p.participantId,
        displayName: p.name,
        role: p.role,
        good: GOOD[s % GOOD.length],
        improve: IMPROVE[(s >> 3) % IMPROVE.length],
        feeling: FEELING[(s >> 5) % FEELING.length],
        writtenAt: new Date(meeting.end + ((s >> 7) % 900) * 60_000).toISOString(),
        likes: { GOOD: s % 5, IMPROVE: (s >> 2) % 4, FEELING: 0 },
      });
    }
    for (const r of list) if (!r.feeling) r.likes.FEELING = 0;
    list.sort((a, b) => a.writtenAt.localeCompare(b.writtenAt));
  }
  byMeeting.set(meetingId, list);
  return list;
}

function ensure(ctx: Ctx, meetingId: number) {
  const meeting = ctx.meetings.find((m) => m.id === meetingId);
  if (!meeting || Date.now() < meeting.end)
    return { fail: error(409, 'RETRO_NOT_OPEN', '미팅이 끝나면 회고를 쓸 수 있어요.') };
  return { meeting };
}

/**
 * TODO(api): 실제 API 는 specs/meeting-retro/spec.md — 개발 서버에서만 이 목이 대신 답한다.
 */
export const meetingRetroMeHandlers = mockClient.createHandlerGroup('/api/me/studies', [
  {
    method: 'GET',
    path: '/:studyId/retros/status',
    presets: [
      {
        label: '정상',
        status: 200,
        response: ({ params, request }: MockResolveContext) => {
          const ctx = contextOf(params, request);
          if (!ctx) return error(404, 'NOT_FOUND', '스터디를 찾을 수 없습니다.');
          const now = Date.now();
          const all = getStudyMeetingIds(ctx.studyId, studies.find((s) => s.study_id === ctx.studyId)!).sort((a, b) =>
            a.scheduledAt.localeCompare(b.scheduledAt),
          );
          return {
            meetings: all.map((m) => {
              const r = ctx.meetings.find((x) => x.id === m.id);
              if (!r)
                return { meetingId: m.id, meetingEndAt: null, retroDeadline: null, retroOpen: null, retroMine: null };
              const mine = r.end <= now && retrosOf(ctx, r.id).some((x) => x.participantId === ME);
              return {
                meetingId: m.id,
                meetingEndAt: new Date(r.end).toISOString(),
                retroDeadline: new Date(r.deadline).toISOString(),
                retroOpen: r.end <= now && now < r.deadline,
                retroMine: ctx.captain ? null : mine,
              };
            }),
          };
        },
      },
    ],
  },
  {
    method: 'GET',
    path: '/:studyId/meetings/:meetingId/retros',
    presets: [
      {
        label: '정상',
        status: 200,
        response: ({ params, request }: MockResolveContext) => {
          const ctx = contextOf(params, request);
          if (!ctx) return error(404, 'NOT_FOUND', '스터디를 찾을 수 없습니다.');
          const meetingId = idOf(params.meetingId);
          const { fail } = ensure(ctx, meetingId);
          if (fail) return fail;
          const list = retrosOf(ctx, meetingId);
          const liked: Record<string, Record<string, boolean>> = {};
          for (const r of list) {
            const row = Object.fromEntries(SECTIONS.map((s) => [s, myLikes.has(`${r.retroId}:${s}`)]));
            if (Object.values(row).some(Boolean)) liked[String(r.retroId)] = row;
          }
          return {
            participantId: ctx.captain ? null : ME,
            retroId: list.find((r) => r.participantId === ME)?.retroId ?? null,
            liked,
          };
        },
      },
    ],
  },
  {
    method: 'PUT',
    path: '/:studyId/meetings/:meetingId/retro',
    presets: [
      {
        label: '성공',
        status: 200,
        response: async ({ params, request }: MockResolveContext) => {
          const ctx = contextOf(params, request);
          if (!ctx) return error(404, 'NOT_FOUND', '스터디를 찾을 수 없습니다.');
          if (ctx.captain) return error(403, 'FORBIDDEN', '회고를 쓸 사람이 아닙니다.');
          const meetingId = idOf(params.meetingId);
          const { fail, meeting } = ensure(ctx, meetingId);
          if (fail) return fail;
          if (Date.now() >= meeting.deadline) return error(409, 'RETRO_CLOSED', '작성 기한이 지났어요.');
          const body = (await request.json()) as { good?: string; improve?: string; feeling?: string };
          const good = (body.good ?? '').trim();
          const improve = (body.improve ?? '').trim();
          const feeling = (body.feeling ?? '').trim();
          if (!good || !improve || good.length > 500 || improve.length > 500 || feeling.length > 500)
            return error(400, 'VALIDATION', '입력값을 확인해 주세요.');
          const list = retrosOf(ctx, meetingId);
          const mine = list.find((r) => r.participantId === ME);
          const writtenAt = new Date().toISOString();
          if (mine) {
            Object.assign(mine, { good, improve, feeling, writtenAt });
            if (!feeling) mine.likes.FEELING = 0;
            list.sort((a, b) => a.writtenAt.localeCompare(b.writtenAt));
            return new HttpResponse(null, { status: 200 });
          }
          const me = ctx.people.find((p) => p.participantId === ME)!;
          list.push({
            retroId: nextRetroId++,
            participantId: ME,
            displayName: me.name,
            role: me.role,
            good,
            improve,
            feeling,
            writtenAt,
            likes: { GOOD: 0, IMPROVE: 0, FEELING: 0 },
          });
          return new HttpResponse(null, { status: 201 });
        },
      },
      {
        label: '기한 지남',
        status: 409,
        response: { errorCode: 'RETRO_CLOSED', errorMessage: '작성 기한이 지났어요.' },
      },
    ],
  },
]);

function likeResponse(liked: boolean) {
  return ({ params, request }: MockResolveContext) => {
    const ctx = contextOf(params, request);
    if (!ctx) return error(404, 'NOT_FOUND', '스터디를 찾을 수 없습니다.');
    const meetingId = idOf(params.meetingId);
    const { fail } = ensure(ctx, meetingId);
    if (fail) return fail;
    const section = String(params.section) as Section;
    const retro = retrosOf(ctx, meetingId).find((r) => r.retroId === idOf(params.retroId));
    if (!retro || !SECTIONS.includes(section)) return error(404, 'NOT_FOUND', '회고를 찾을 수 없습니다.');
    if (retro.participantId === ME) return error(403, 'FORBIDDEN', '내 회고에는 공감할 수 없어요.');
    if (section === 'FEELING' && !retro.feeling) return error(409, 'EMPTY_SECTION', '비운 소감에는 공감할 수 없어요.');
    const key = `${retro.retroId}:${section}`;
    if (liked && !myLikes.has(key)) {
      myLikes.add(key);
      retro.likes[section] += 1;
    } else if (!liked && myLikes.has(key)) {
      myLikes.delete(key);
      retro.likes[section] -= 1;
    }
    return { count: retro.likes[section], liked };
  };
}

export const meetingRetroHandlers = mockClient.createHandlerGroup('/api/studies', [
  {
    method: 'GET',
    path: '/:studyId/meetings/:meetingId/retros',
    presets: [
      {
        label: '정상',
        status: 200,
        response: ({ params, request }: MockResolveContext) => {
          const ctx = contextOf(params, request);
          if (!ctx) return error(404, 'NOT_FOUND', '스터디를 찾을 수 없습니다.');
          const meetingId = idOf(params.meetingId);
          const { fail, meeting } = ensure(ctx, meetingId);
          if (fail) return fail;
          const list = retrosOf(ctx, meetingId);
          const lead = ctx.captain || ctx.navigator;
          const wrote = new Set(list.map((r) => r.participantId));
          return {
            meetingId,
            deadline: new Date(meeting.deadline).toISOString(),
            open: Date.now() < meeting.deadline,
            targets: lead ? ctx.people.length : null,
            retros: list.map((r) => ({
              retroId: r.retroId,
              author: { participantId: r.participantId, displayName: r.displayName, role: r.role },
              good: r.good,
              improve: r.improve,
              feeling: r.feeling,
              writtenAt: r.writtenAt,
              likes: { ...r.likes },
            })),
            missing: lead
              ? ctx.people
                  .filter((p) => !wrote.has(p.participantId))
                  .map((p) => ({ participantId: p.participantId, displayName: p.name }))
              : [],
          };
        },
      },
    ],
  },
  {
    method: 'PUT',
    path: '/:studyId/meetings/:meetingId/retros/:retroId/likes/:section',
    presets: [{ label: '성공', status: 200, response: likeResponse(true) }],
  },
  {
    method: 'DELETE',
    path: '/:studyId/meetings/:meetingId/retros/:retroId/likes/:section',
    presets: [{ label: '성공', status: 200, response: likeResponse(false) }],
  },
]);
