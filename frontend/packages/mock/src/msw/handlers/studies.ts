import { HttpResponse } from 'msw';

import { apiStudies, findApiStudyDetail, findApiApplicationForm, type ApiPage, type ApiStudy } from '../data';
import { mockClient, type MockResolveContext } from '../utils';

const emptyPage: ApiPage<ApiStudy> = { items: [], total: 0, offset: 0, limit: 100 };

export const studiesHandlers = mockClient.createHandlerGroup('/api/studies', [
  {
    method: 'POST',
    path: '/:id/applications',
    presets: [
      {
        label: '신청 성공',
        status: 201,
        response: () => new HttpResponse(null, { status: 201, headers: { Location: '/api/studies/1/applications/1' } }),
      },
      {
        label: '이미 신청',
        status: 409,
        response: { errorCode: 'CONFLICT', errorMessage: '이미 신청한 스터디입니다.' },
      },
      {
        label: '모집 마감',
        status: 409,
        response: { errorCode: 'CONFLICT', errorMessage: '모집이 마감되었습니다.' },
      },
      {
        label: '정원 초과',
        status: 409,
        response: { errorCode: 'CONFLICT', errorMessage: '정원이 가득 찼습니다.' },
      },
      {
        label: '디스코드 미연동',
        status: 403,
        response: { errorCode: 'FORBIDDEN', errorMessage: '디스코드 연동이 필요합니다.' },
      },
      {
        label: '이미 참여 중',
        status: 409,
        response: { errorCode: 'CONFLICT', errorMessage: '이미 참여 중인 스터디입니다.' },
      },
      {
        label: '서버 오류',
        status: 500,
        response: { errorCode: 'INTERNAL_ERROR', errorMessage: '서버 오류가 발생했습니다.' },
      },
    ],
  },
  {
    method: 'GET',
    path: '/:id/applications/me',
    presets: [
      {
        label: '신청 안 함',
        status: 200,
        response: { applied: false, applicationId: null, submittedAt: null },
      },
      {
        label: '신청함',
        status: 200,
        response: { applied: true, applicationId: 1, submittedAt: '2026-10-01T12:00:00Z' },
      },
      {
        label: '서버 오류',
        status: 500,
        response: { errorCode: 'INTERNAL_ERROR', errorMessage: '서버 오류가 발생했습니다.' },
      },
    ],
  },
  {
    method: 'GET',
    path: '/:id/application-form',
    presets: [
      {
        label: '정상',
        status: 200,
        response: ({ params }: MockResolveContext) => {
          const form = findApiApplicationForm(Number(params.id));
          if (!form)
            return HttpResponse.json({ errorMessage: '스터디를 찾을 수 없습니다.' }, { status: 404 });
          return form;
        },
      },
      { label: '찾을 수 없음', status: 404, response: { errorMessage: '스터디를 찾을 수 없습니다.' } },
      { label: '서버 오류', status: 500, response: { errorMessage: '서버 오류가 발생했습니다.' } },
    ],
  },
  {
    method: 'GET',
    path: '/',
    presets: [
      {
        label: '정상',
        status: 200,
        response: ({ request }: MockResolveContext) => {
          const url = new URL(request.url);
          let items = [...apiStudies];

          const keyword = url.searchParams.get('keyword')?.toLowerCase();
          if (keyword)
            items = items.filter(
              (s) =>
                s.title.toLowerCase().includes(keyword) ||
                s.oneLineSummary.toLowerCase().includes(keyword),
            );

          const status = url.searchParams.get('status');
          if (status) items = items.filter((s) => s.phase === status);

          const category = url.searchParams.get('category');
          if (category) items = items.filter((s) => s.category === category);

          const timezone = url.searchParams.get('timezone');
          if (timezone) items = items.filter((s) => s.timezone === timezone);

          const sort = url.searchParams.get('sort');
          if (sort === 'DEADLINE')
            items = items.sort((a, b) =>
              (a.recruitDeadlineAt ?? '').localeCompare(b.recruitDeadlineAt ?? ''),
            );
          else if (sort === 'PARTICIPANTS')
            items = items.sort((a, b) => b.currentApplicants - a.currentApplicants);

          return { items, total: items.length, offset: 0, limit: 100 } satisfies ApiPage<ApiStudy>;
        },
      },
      { label: '빈 목록', status: 200, response: emptyPage },
      { label: '서버 오류', status: 500, response: { errorMessage: '서버 오류가 발생했습니다.' } },
    ],
  },
  {
    method: 'GET',
    path: '/:id',
    presets: [
      {
        label: '정상',
        status: 200,
        response: ({ params }: MockResolveContext) => {
          const detail = findApiStudyDetail(Number(params.id));
          if (!detail)
            return HttpResponse.json(
              { errorMessage: '스터디를 찾을 수 없습니다.' },
              { status: 404 },
            );
          return detail;
        },
      },
      {
        label: '찾을 수 없음',
        status: 404,
        response: { errorMessage: '스터디를 찾을 수 없습니다.' },
      },
      { label: '서버 오류', status: 500, response: { errorMessage: '서버 오류가 발생했습니다.' } },
    ],
  },
  {
    method: 'PATCH',
    path: '/:id',
    presets: [
      { label: '성공', status: 200, response: null },
      { label: '서버 오류', status: 500, response: { errorMessage: '수정에 실패했습니다.' } },
    ],
  },
  {
    method: 'DELETE',
    path: '/:id',
    presets: [
      { label: '성공', status: 200, response: null },
      { label: '서버 오류', status: 500, response: { errorMessage: '삭제에 실패했습니다.' } },
    ],
  },
]);

export const adminStudiesHandlers = mockClient.createHandlerGroup('/api/admin/studies', [
  {
    method: 'GET',
    path: '/:id',
    presets: [
      {
        label: '정상',
        status: 200,
        response: ({ params }: MockResolveContext) => {
          const detail = findApiStudyDetail(Number(params.id));
          if (!detail)
            return HttpResponse.json(
              { errorMessage: '스터디를 찾을 수 없습니다.' },
              { status: 404 },
            );
          return detail;
        },
      },
      {
        label: '찾을 수 없음',
        status: 404,
        response: { errorMessage: '스터디를 찾을 수 없습니다.' },
      },
      { label: '서버 오류', status: 500, response: { errorMessage: '서버 오류가 발생했습니다.' } },
    ],
  },
  {
    method: 'POST',
    path: '/',
    presets: [
      {
        label: '생성 성공',
        status: 201,
        response: () =>
          new HttpResponse(null, {
            status: 201,
            headers: { Location: '/api/admin/studies/1' },
          }),
      },
      { label: '서버 오류', status: 500, response: { errorMessage: '스터디 등록에 실패했습니다.' } },
    ],
  },
  {
    method: 'PATCH',
    path: '/:id',
    presets: [
      { label: '성공', status: 200, response: null },
      { label: '서버 오류', status: 500, response: { errorMessage: '수정에 실패했습니다.' } },
    ],
  },
  {
    method: 'DELETE',
    path: '/:id',
    presets: [
      { label: '성공', status: 200, response: null },
      { label: '서버 오류', status: 500, response: { errorMessage: '삭제에 실패했습니다.' } },
    ],
  },
]);

export const adminStudyProgramsHandlers = mockClient.createHandlerGroup(
  '/api/admin/study-programs',
  [
    {
      method: 'GET',
      path: '/',
      presets: [
        {
          label: '정상',
          status: 200,
          response: {
            items: [
              { id: 1, name: '웹 프론트엔드 심화 클럽', kind: 'CLUB', latestStudyId: 1 },
              { id: 2, name: '백엔드 아키텍처 클럽', kind: 'CLUB', latestStudyId: 2 },
            ],
          },
        },
        { label: '빈 목록', status: 200, response: { items: [] } },
        { label: '서버 오류', status: 500, response: { errorMessage: '서버 오류가 발생했습니다.' } },
      ],
    },
  ],
);

