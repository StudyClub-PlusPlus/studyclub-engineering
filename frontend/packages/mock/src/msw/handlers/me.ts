import { HttpResponse } from 'msw';

import { CATEGORY_DISPLAY } from '../../constants/study';
import { studies } from '../../data';
import { getStudyCrew } from '../../data/crew';
import { mockClient, type MockResolveContext } from '../utils';

/** 스터디 카테고리 표시명 → API 키 (역매핑) */
const CATEGORY_KEY: Record<string, string> = Object.fromEntries(
  Object.entries(CATEGORY_DISPLAY).map(([k, v]) => [v, k])
);

function meetingScheduledAt(date: string, study: (typeof studies)[number]): string {
  const time =
    study.schedule?.ko
      .match(/(\d{1,2}):(\d{2})/)
      ?.slice(1)
      .join(':') ?? '20:00';
  return `${date}T${time}:00+09:00`;
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

type MyStudyRelation = 'UPCOMING' | 'ONGOING' | 'COMPLETED' | 'WITHDRAWN';

const ACCEPTED_IDS = new Set([1, 3, 9, 11, 18, 19, 20, 22, 23, 24, 25, 26, 28]);
const WITHDRAWN_IDS = new Set([19]);
const LEADER_IDS = new Set([11]);
const CAPTAIN_IDS = new Set([1, 20]);

const GROUP_ID_OFFSET = 1000;

function groupIdOf(studyId: number) {
  return studyId + GROUP_ID_OFFSET;
}

function studyOf(id: string | string[] | undefined) {
  const studyId = Number(Array.isArray(id) ? id[0] : id);
  return studies.find((study) => study.study_id === studyId);
}

function relationOf(study: (typeof studies)[number]): MyStudyRelation {
  if (WITHDRAWN_IDS.has(study.study_id)) return 'WITHDRAWN';
  if (study.status === 'closed') return 'COMPLETED';
  if (study.status === 'recruiting') return 'UPCOMING';
  return 'ONGOING';
}

function participantStatusOf(relation: MyStudyRelation) {
  return relation === 'WITHDRAWN' ? 'WITHDRAWN' : relation === 'COMPLETED' ? 'COMPLETED' : 'ACTIVE';
}

function studyStatusOf(study: (typeof studies)[number]) {
  return study.status === 'closed' ? 'ENDED' : study.status === 'ongoing' ? 'ONGOING' : 'OPEN';
}

/**
 * TODO(api): GET /api/me/studies
 * TODO(api): GET /api/me/studies/:id
 */
function attendanceStatusFor(
  relation: MyStudyRelation,
  studyId: number,
  index: number,
  meetingDate: string
): 'PRESENT' | 'LATE' | 'ABSENT' | null {
  if (relation === 'COMPLETED') {
    // 완주 스터디: 80% 이상의 출석률을 보장하도록 적절한 출석 상태 부여
    if (studyId === 22) return 'PRESENT';
    if (studyId === 23) return index === 2 ? 'LATE' : 'PRESENT';
    if (studyId === 24) return index === 4 ? 'ABSENT' : 'PRESENT';
    if (studyId === 25) return index === 1 ? 'LATE' : index === 5 ? 'ABSENT' : 'PRESENT';
    return (index + studyId) % 7 === 0 ? 'LATE' : 'PRESENT';
  }

  if (relation === 'WITHDRAWN') {
    return index < 2 ? 'PRESENT' : null;
  }

  if (relation === 'ONGOING') {
    const isPast = new Date(meetingDate).getTime() < Date.now();
    if (!isPast) return null;
    return (index + studyId) % 6 === 0 ? 'LATE' : 'PRESENT';
  }

  return null;
}

export const meStudiesHandlers = mockClient.createHandlerGroup('/api/me', [
  {
    method: 'GET',
    path: '/studies',
    presets: [
      {
        label: '정상',
        status: 200,
        response: () => ({
          items: studies
            .filter((study) => ACCEPTED_IDS.has(study.study_id))
            .map((study) => {
              const relation = relationOf(study);
              const crewMeetings = getStudyCrew(study).meetings;
              const firstDate = crewMeetings[0]?.date;
              const kickoffDate =
                study.startAt?.slice(0, 10) ?? (firstDate ? addDays(firstDate, -7) : null);
              const kickoff = kickoffDate
                ? [
                    {
                      meetingId: 0,
                      sequence: 0,
                      scheduledAt: meetingScheduledAt(kickoffDate, study),
                      startAt: null,
                      endAt: null,
                      attendanceStatus:
                        relation === 'COMPLETED' || relation === 'WITHDRAWN'
                          ? ('PRESENT' as const)
                          : new Date(kickoffDate).getTime() < Date.now()
                            ? ('PRESENT' as const)
                            : null,
                      countedInRate: false,
                    },
                  ]
                : [];
              const regularMeetings = crewMeetings.map((m, i) => ({
                meetingId: i + 1,
                sequence: m.no,
                scheduledAt: meetingScheduledAt(m.date, study),
                startAt: null,
                endAt: null,
                attendanceStatus: attendanceStatusFor(relation, study.study_id, i, m.date),
                countedInRate: true,
              }));
              const regularStatuses = regularMeetings.map((m) => m.attendanceStatus);
              const attendedCount = regularStatuses.filter((s) => s === 'PRESENT' || s === 'LATE').length;
              const totalCount = regularStatuses.filter((s) => s !== null).length;
              const attendanceRate = totalCount > 0 ? Math.round((attendedCount / totalCount) * 100) / 100 : null;

              return {
                studyId: study.study_id,
                title: study.title.ko,
                category: CATEGORY_KEY[study.category ?? ''] ?? 'OTHER',
                studyKind: study.kind === 'club' ? 'CLUB' : 'STUDY',
                startAt: study.startAt ?? null,
                endAt: study.date ? `${study.date}T23:59:59Z` : null,
                relation,
                participantStatus: participantStatusOf(relation),
                participantRole: LEADER_IDS.has(study.study_id) ? 'LEADER' : 'MEMBER',
                captain: CAPTAIN_IDS.has(study.study_id),
                discordChannelUrl: study.discord_url ?? null,
                driveUrl: study.driveUrl ?? null,
                attendanceRate,
                meetings: [...kickoff, ...regularMeetings],
              };
            }),
        }),
      },
      { label: '빈 목록', status: 200, response: { items: [] } },
      { label: '로그인 필요', status: 401, response: { errorMessage: '로그인이 필요합니다.' } },
      {
        label: '서버 오류',
        status: 500,
        response: { errorMessage: '내 스터디를 불러오지 못했습니다.' },
      },
    ],
  },
  {
    method: 'GET',
    path: '/studies/:id',
    presets: [
      {
        label: '정상',
        status: 200,
        response: ({ params }: MockResolveContext) => {
          const study = studyOf(params.id);
          if (!study)
            return HttpResponse.json(
              { errorCode: 'NOT_FOUND', errorMessage: '스터디를 찾을 수 없습니다.' },
              { status: 404 }
            );
          const relation = relationOf(study);
          return {
            cohortId: groupIdOf(study.study_id),
            studyId: study.study_id,
            title: study.title.ko,
            studyStatus: studyStatusOf(study),
            participantStatus: participantStatusOf(relation),
            className: '내 스터디 분반',
            timezone: 'Asia/Seoul',
            leaderName: '운영진',
            completedMeetingCount: 0,
            totalMeetingCount: 0,
            attendanceRate: null,
            startsOn: study.startAt?.slice(0, 10) ?? null,
            nextMeeting: null,
            attendance: [],
            driveUrl: study.driveUrl ?? null,
          };
        },
      },
      {
        label: '권한 없음',
        status: 403,
        response: { errorCode: 'FORBIDDEN', errorMessage: '참여 중인 스터디가 아닙니다.' },
      },
      {
        label: '찾을 수 없음',
        status: 404,
        response: { errorCode: 'NOT_FOUND', errorMessage: '스터디를 찾을 수 없습니다.' },
      },
    ],
  },
]);
