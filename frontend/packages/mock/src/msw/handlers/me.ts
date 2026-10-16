import { HttpResponse } from 'msw';

import { studies } from '../../data';
import { mockClient, type MockResolveContext } from '../utils';

type MyStudyRelation = 'UPCOMING' | 'ONGOING' | 'COMPLETED' | 'WITHDRAWN';

const ACCEPTED_IDS = new Set([1, 3, 9, 11, 18, 19, 20, 22, 23, 24, 25, 26, 28]);
const WITHDRAWN_IDS = new Set([19]);
const LEADER_IDS = new Set([11]);
const CAPTAIN_IDS = new Set([1, 9, 20]);

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
            .map((study) => ({
              studyId: study.study_id,
              title: study.title.ko,
              category: 'OTHER',
              studyKind: study.kind === 'club' ? 'CLUB' : 'STUDY',
              startAt: study.startAt ?? null,
              endAt: study.date ? `${study.date}T23:59:59Z` : null,
              relation: relationOf(study),
              participantStatus: participantStatusOf(relationOf(study)),
              participantRole: LEADER_IDS.has(study.study_id) ? 'LEADER' : 'MEMBER',
              captain: CAPTAIN_IDS.has(study.study_id),
              discordChannelUrl: study.discord_url ?? null,
              driveUrl: study.driveUrl ?? null,
              attendanceRate: null,
              meetings: [],
            })),
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
