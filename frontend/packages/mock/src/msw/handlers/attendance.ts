import { HttpResponse } from 'msw';

import { getStudyMeetingIds, CAPTAIN_STUDY_IDS, NAVIGATOR_STUDY_IDS, withdrawnState, getWithdrawnParticipants } from './meetings';
import { studies } from '../../data';
import { getStudyCrew } from '../../data/crew';
import { currentUserName, mockClient, type MockResolveContext } from '../utils';

const STATUS: Record<string, string> = {
  present: 'PRESENT',
  late: 'LATE',
  absent: 'ABSENT',
  excused: 'EXCUSED',
};
const attendanceState = new Map<number, Map<number, Map<number, string>>>();
const MY_CYCLE = ['PRESENT', 'LATE', 'PRESENT', 'LATE', 'ABSENT', 'EXCUSED'];

function responseFor({
  params,
  request,
}: Pick<MockResolveContext, 'params'> & { request?: Request }) {
  const studyId = Number(Array.isArray(params.studyId) ? params.studyId[0] : params.studyId);
  const study = studies.find((item) => item.study_id === studyId);
  if (!study) return undefined;
  const crew = getStudyCrew(study);
  const saved = attendanceState.get(studyId);
  const withdrawnSet = getWithdrawnParticipants(studyId);
  const myName = currentUserName(request);

  // meetings.ts 의 meetingState 와 동일한 ID 목록 — 새로 추가된 회차도 포함됨
  const allMeetings = getStudyMeetingIds(studyId, study);
  const pastMeetings = allMeetings.filter((m) => new Date(m.scheduledAt).getTime() <= Date.now());

  // 원본 crew.meetings: scheduledAt 으로 현재 meeting ID 를 찾는다
  const time =
    study.schedule?.ko
      .match(/(\d{1,2}):(\d{2})/)
      ?.slice(1)
      .join(':') ?? '20:00';
  const origScheduledAtToId = new Map<string, number>(
    crew.meetings.map((m) => {
      const sat = `${m.date}T${time}:00+09:00`;
      const current = allMeetings.find((am) => am.scheduledAt === sat);
      return [m.id, current?.id ?? -1] as [string, number];
    })
  );

  const isCaptain = CAPTAIN_STUDY_IDS.has(studyId);
  const isNavigator = NAVIGATOR_STUDY_IDS.has(studyId);

  const myBaseAttendances = new Map<number, string>(
    pastMeetings.map((m, i) => [m.id, MY_CYCLE[i % MY_CYCLE.length]])
  );

  function buildAttendances(participantId: number, baseMap: Map<number, string>) {
    const map = new Map(baseMap);
    const savedForP = saved?.get(participantId);
    if (savedForP) {
      for (const [mId, st] of savedForP.entries()) {
        map.set(mId, st);
      }
    }
    return Array.from(map.entries()).map(([meetingId, status]) => ({ meetingId, status }));
  }

  function getPersonBaseAttendances(person?: (typeof crew.crew)[number]) {
    const map = new Map<number, string>();
    if (!person) return map;
    for (const [origId, status] of Object.entries(crew.attendance[person.id] ?? {})) {
      const meetingId = origScheduledAtToId.get(origId);
      if (meetingId !== undefined && meetingId !== -1) {
        map.set(meetingId, STATUS[status] ?? status.toUpperCase());
      }
    }
    return map;
  }

  const gaonCrew = crew.crew.find((p) => p.name === '가온') ?? crew.crew[0];
  const soyulCrew = crew.crew.find((p) => p.name === '소율') ?? crew.crew[0];

  let participants: Array<{
    participantId: number;
    displayName: string;
    /** 스터디클럽 디스코드 서버 별명 — 출석부 「디스코드 닉네임」 열. 회원 탈퇴면 null. */
    discordNickname: string | null;
    participantRole: string;
    captain: boolean;
    participantStatus: string;
    leftAt: string | null;
    attendances: Array<{ meetingId: number; status: string }>;
    attendanceRate: number | null;
  }>;

  if (isCaptain) {
    participants = [
      {
        participantId: 1,
        displayName: myName,
        discordNickname: null,
        participantRole: 'MEMBER',
        captain: true,
        participantStatus: withdrawnSet.has(1) ? 'WITHDRAWN' : 'ACTIVE',
        leftAt: withdrawnSet.has(1) ? new Date().toISOString() : null,
        attendances: buildAttendances(1, myBaseAttendances),
        attendanceRate: null,
      },
      {
        participantId: 2,
        displayName: '가온',
        discordNickname: gaonCrew?.discordNickname ?? null,
        participantRole: 'LEADER',
        captain: false,
        participantStatus: withdrawnSet.has(2) ? 'WITHDRAWN' : 'ACTIVE',
        leftAt: withdrawnSet.has(2) ? new Date().toISOString() : null,
        attendances: buildAttendances(2, getPersonBaseAttendances(gaonCrew)),
        attendanceRate: null,
      },
      ...crew.crew
        .filter((person) => person.name !== '가온')
        .map((person, index) => {
          const participantId = index + 3;
          return {
            participantId,
            displayName: person.name,
            discordNickname: person.discordNickname ?? null,
            participantRole: 'MEMBER',
            captain: false,
            participantStatus: withdrawnSet.has(participantId) ? 'WITHDRAWN' : 'ACTIVE',
            leftAt: withdrawnSet.has(participantId) ? new Date().toISOString() : null,
            attendances: buildAttendances(participantId, getPersonBaseAttendances(person)),
            attendanceRate: null,
          };
        }),
    ];
  } else if (isNavigator) {
    participants = [
      {
        participantId: 1,
        displayName: myName,
        discordNickname: null,
        participantRole: 'LEADER',
        captain: false,
        participantStatus: withdrawnSet.has(1) ? 'WITHDRAWN' : 'ACTIVE',
        leftAt: withdrawnSet.has(1) ? new Date().toISOString() : null,
        attendances: buildAttendances(1, myBaseAttendances),
        attendanceRate: null,
      },
      ...crew.crew.map((person, index) => {
        const participantId = index + 2;
        return {
          participantId,
          displayName: person.name,
          discordNickname: person.discordNickname ?? null,
          participantRole: 'MEMBER',
          captain: false,
          participantStatus: withdrawnSet.has(participantId) ? 'WITHDRAWN' : 'ACTIVE',
          leftAt: withdrawnSet.has(participantId) ? new Date().toISOString() : null,
          attendances: buildAttendances(participantId, getPersonBaseAttendances(person)),
          attendanceRate: null,
        };
      }),
    ];
  } else {
    participants = [
      {
        participantId: 1,
        displayName: myName,
        discordNickname: null,
        participantRole: 'MEMBER',
        captain: false,
        participantStatus: withdrawnSet.has(1) ? 'WITHDRAWN' : 'ACTIVE',
        leftAt: withdrawnSet.has(1) ? new Date().toISOString() : null,
        attendances: buildAttendances(1, myBaseAttendances),
        attendanceRate: null,
      },
      {
        participantId: 2,
        displayName: '소율',
        discordNickname: soyulCrew?.discordNickname ?? null,
        participantRole: 'LEADER',
        captain: false,
        participantStatus: withdrawnSet.has(2) ? 'WITHDRAWN' : 'ACTIVE',
        leftAt: withdrawnSet.has(2) ? new Date().toISOString() : null,
        attendances: buildAttendances(2, getPersonBaseAttendances(soyulCrew)),
        attendanceRate: null,
      },
      ...crew.crew
        .filter((person) => person.name !== '소율')
        .map((person, index) => {
          const participantId = index + 3;
          return {
            participantId,
            displayName: person.name,
            discordNickname: person.discordNickname ?? null,
            participantRole: 'MEMBER',
            captain: false,
            participantStatus: withdrawnSet.has(participantId) ? 'WITHDRAWN' : 'ACTIVE',
            leftAt: withdrawnSet.has(participantId) ? new Date().toISOString() : null,
            attendances: buildAttendances(participantId, getPersonBaseAttendances(person)),
            attendanceRate: null,
          };
        }),
    ];
  }

  return {
    study: {
      id: studyId,
      title: study.title.ko,
      participantCount: participants.length,
      totalMeetings: allMeetings.length,
      avgAttendanceRate: null,
    },
    meetings: allMeetings,
    participants,
  };
}

/**
 * TODO(api): GET /api/me/studies/:studyId/attendances
 * TODO(api): POST /api/me/studies/:studyId/attendances — body: { studyGroupId, updates, withdrawals }
 */
export const attendanceHandlers = mockClient.createHandlerGroup('/api/me/studies', [
  {
    method: 'GET',
    path: '/:studyId/attendances',
    presets: [
      {
        label: '정상',
        status: 200,
        response: (context: MockResolveContext) =>
          // 참여자 discordNickname 은 스펙에 있고(10-18 D6) 백엔드가 아직 내리지 않는다 — 목은 먼저 채워 둔다
          responseFor(context) ??
          HttpResponse.json(
            { errorCode: 'NOT_FOUND', errorMessage: '스터디를 찾을 수 없습니다.' },
            { status: 404 }
          ),
      },
      {
        label: '권한 없음',
        status: 403,
        response: { errorCode: 'FORBIDDEN', errorMessage: '권한이 없습니다.' },
      },
    ],
  },
  {
    method: 'POST',
    path: '/:studyId/attendances',
    presets: [
      {
        label: '성공',
        status: 204,
        response: async ({ request, params }: MockResolveContext) => {
          const studyId = Number(
            Array.isArray(params.studyId) ? params.studyId[0] : params.studyId
          );
          const body = (await request.json()) as {
            updates?: Array<{ meetingId: number; participantId: number; status: string }>;
            withdrawals?: number[];
          };
          if (body.updates) {
            const saved = attendanceState.get(studyId) ?? new Map<number, Map<number, string>>();
            for (const update of body.updates) {
              const participant = saved.get(update.participantId) ?? new Map<number, string>();
              participant.set(update.meetingId, update.status);
              saved.set(update.participantId, participant);
            }
            attendanceState.set(studyId, saved);
          }
          if (body.withdrawals && body.withdrawals.length > 0) {
            const currentWithdrawn = withdrawnState.get(studyId) ?? new Set<number>();
            for (const pId of body.withdrawals) {
              currentWithdrawn.add(pId);
            }
            withdrawnState.set(studyId, currentWithdrawn);
          }
          return null;
        },
      },
      {
        label: '권한 없음',
        status: 403,
        response: { errorCode: 'FORBIDDEN', errorMessage: '권한이 없습니다.' },
      },
    ],
  },
]);
