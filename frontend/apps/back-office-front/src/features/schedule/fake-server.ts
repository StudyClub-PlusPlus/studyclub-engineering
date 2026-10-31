import type { ApiAttendance } from '@/features/attendance/repository';
import type { ParticipantsResponse } from '@/features/participants/types';
import type { ApiGroupMeetings } from '@/features/schedule/repository';

// 테스트용 가짜 서버 — 일정 · 출석 탭이 부르는 API 를 메모리로 흉내 낸다. 앱 코드는 import 하지 않는다.
// 경로 · 본문 · 응답 모양은 백엔드 컨트롤러와 같다 (specs/study-meeting · specs/attendance · specs/study-group).

type Status = 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED';

export type FakeMeeting = {
  id: number;
  groupId: number;
  type?: 'KICKOFF' | 'REGULAR';
  scheduledAt: string;
  title?: string | null;
  presenter1?: number | null;
  presenter2?: number | null;
};

export type FakeState = {
  participants: ParticipantsResponse;
  meetings: FakeMeeting[];
  rules: Record<number, string | null>;
  timezone: Record<number, string>;
  /** `${participantId}:${meetingId}` → 상태 */
  attendance: Record<string, Status>;
  leftAt: Record<number, string>;
};

export type FakeCall = { method: string; path: string; body: unknown };

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const noContent = () => new Response(null, { status: 204 });
const fail = (status: number, errorMessage: string) =>
  new Response(JSON.stringify({ errorCode: 'FAKE', errorMessage }), { status });

export function fakeServer(init: Partial<FakeState> & { participants: ParticipantsResponse }) {
  // 테스트끼리 같은 픽스처를 쓰므로 복사해 고친다
  const state: FakeState = {
    meetings: [],
    rules: {},
    timezone: {},
    attendance: {},
    leftAt: {},
    ...structuredClone(init),
  };
  const calls: FakeCall[] = [];
  let nextId = 1000;

  const active = (groupId: number) =>
    state.participants.participants.filter(
      (p) => p.groupId === groupId && (p.status === 'ACTIVE' || p.status === 'PAUSED'),
    );
  const nameOf = (id: number) => state.participants.participants.find((p) => p.participantId === id)?.nickname ?? '';
  const presenter = (id?: number | null) => (id ? { participantId: id, name: nameOf(id) } : null);

  function meetingsOf(groupId: number): ApiGroupMeetings {
    const group = state.participants.groups.find((g) => g.groupId === groupId)!;
    const rows = state.meetings.filter((m) => m.groupId === groupId);
    const kickoff = rows.filter((m) => m.type === 'KICKOFF');
    const regular = rows.filter((m) => m.type !== 'KICKOFF').sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
    const now = new Date().toISOString();
    return {
      studyGroup: {
        id: groupId,
        name: group.name,
        timezone: state.timezone[groupId] ?? 'Asia/Seoul',
        startTime: null,
        navigatorName: null,
        rules: state.rules[groupId] ?? null,
      },
      me: { participantId: null, canEdit: true },
      participants: active(groupId)
        .map((p) => ({ participantId: p.participantId, name: p.nickname }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      meetings: [...kickoff, ...regular].map((m) => ({
        id: m.id,
        type: m.type ?? 'REGULAR',
        number: m.type === 'KICKOFF' ? 0 : regular.indexOf(m) + 1,
        scheduledAt: m.scheduledAt,
        title: m.title ?? null,
        presenter1: presenter(m.presenter1),
        presenter2: presenter(m.presenter2),
        started: m.scheduledAt <= now,
      })),
    };
  }

  function attendanceOf(studyId: number, groupId: number): ApiAttendance {
    const meetings = state.meetings
      .filter((m) => m.groupId === groupId)
      .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
    const people = state.participants.participants.filter((p) => p.groupId === groupId);
    return {
      study: {
        id: studyId,
        title: '',
        participantCount: people.length,
        totalMeetings: meetings.length,
        avgAttendanceRate: null,
      },
      meetings: meetings.map((m) => ({ id: m.id, scheduledAt: m.scheduledAt })),
      participants: people.map((p) => ({
        participantId: p.participantId,
        displayName: p.nickname,
        participantRole: p.participantRole,
        captain: p.captain,
        participantStatus: p.status,
        leftAt: state.leftAt[p.participantId] ?? null,
        attendances: meetings.map((m) => ({
          meetingId: m.id,
          status: state.attendance[`${p.participantId}:${m.id}`] ?? null,
        })),
        attendanceRate: null,
      })),
    };
  }

  type Body = Record<string, unknown>;

  function handle(method: string, path: string, query: URLSearchParams, body: Body): Response {
    let m: RegExpMatchArray | null;
    if (method === 'GET' && (m = path.match(/^\/api\/admin\/studies\/\d+\/participants$/)))
      return ok(state.participants);
    if (method === 'GET' && (m = path.match(/^\/api\/admin\/studies\/\d+\/groups\/(\d+)\/meetings$/)))
      return ok(meetingsOf(Number(m[1])));
    if (method === 'PUT' && (m = path.match(/^\/api\/admin\/studies\/\d+\/groups\/(\d+)\/kickoff$/))) {
      const groupId = Number(m[1]);
      const kickoff = state.meetings.find((x) => x.groupId === groupId && x.type === 'KICKOFF');
      if (kickoff) kickoff.scheduledAt = body.scheduledAt as string;
      else
        state.meetings.push({
          id: nextId++,
          groupId,
          type: 'KICKOFF',
          scheduledAt: body.scheduledAt as string,
          title: '킥오프',
        });
      return noContent();
    }
    if (method === 'POST' && (m = path.match(/^\/api\/admin\/studies\/\d+\/groups\/(\d+)\/meetings$/))) {
      const groupId = Number(m[1]);
      for (const at of body.scheduledAts as string[])
        state.meetings.push({
          id: nextId++,
          groupId,
          scheduledAt: at,
          title: body.title as string | null,
        });
      return noContent();
    }
    if (method === 'PUT' && (m = path.match(/^\/api\/admin\/studies\/\d+\/groups\/(\d+)\/meetings\/(\d+)$/))) {
      const meeting = state.meetings.find((x) => x.id === Number(m![2]) && x.groupId === Number(m![1]));
      if (!meeting) return fail(404, '회차를 찾을 수 없습니다.');
      meeting.scheduledAt = body.scheduledAt as string;
      meeting.title = body.title as string | null;
      if ('presenter1ParticipantId' in body) meeting.presenter1 = body.presenter1ParticipantId as number | null;
      if ('presenter2ParticipantId' in body) meeting.presenter2 = body.presenter2ParticipantId as number | null;
      return noContent();
    }
    if (method === 'DELETE' && path.match(/^\/api\/admin\/studies\/\d+\/groups\/\d+\/meetings$/)) {
      const gone = new Set(body.meetingIds as number[]);
      state.meetings = state.meetings.filter((x) => !gone.has(x.id));
      return noContent();
    }
    if (method === 'PUT' && (m = path.match(/^\/api\/admin\/studies\/\d+\/groups\/(\d+)\/rules$/))) {
      state.rules[Number(m[1])] = body.rules as string | null;
      return noContent();
    }
    if ((m = path.match(/^\/api\/admin\/studies\/(\d+)\/attendances$/))) {
      if (method === 'GET') return ok(attendanceOf(Number(m[1]), Number(query.get('studyGroupId'))));
      const updates = (body.updates ?? []) as { meetingId: number; participantId: number; status: Status }[];
      for (const u of updates) state.attendance[`${u.participantId}:${u.meetingId}`] = u.status;
      const now = new Date().toISOString();
      for (const id of (body.withdrawals ?? []) as number[]) {
        const p = state.participants.participants.find((x) => x.participantId === id)!;
        p.status = 'WITHDRAWN';
        state.leftAt[id] = now;
        for (const meeting of state.meetings.filter((x) => x.scheduledAt > now)) {
          if (meeting.presenter1 === id) meeting.presenter1 = null;
          if (meeting.presenter2 === id) meeting.presenter2 = null;
        }
      }
      return noContent();
    }
    return fail(404, `가짜 서버에 없는 경로: ${method} ${path}`);
  }

  const fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    const method = init?.method ?? 'GET';
    const body = init?.body ? (JSON.parse(String(init.body)) as Body) : {};
    calls.push({ method, path: url.pathname, body });
    return handle(method, url.pathname, url.searchParams, body);
  };

  return { state, calls, fetch };
}
