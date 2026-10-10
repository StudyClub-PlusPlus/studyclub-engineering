// 역할별 기본 권한표 목 — specs/admin-users/spec.md 「역할별 기본 권한표 조회」 응답 예시 그대로.
// 화면은 이 응답을 그대로 그린다. 행·그룹이 늘어도 화면 코드는 고치지 않는다.
import { mockClient } from '../utils';

export type ApiRolePermissions = {
  groups: {
    scope: string;
    roles: string[];
    permissions: { key: string; label: string; allowedRoles: string[] }[];
  }[];
};

export const mockRolePermissions: ApiRolePermissions = {
  groups: [
    {
      scope: 'STUDY',
      roles: ['ADMIN', 'LEADER', 'MEMBER'],
      permissions: [
        { key: 'CREW_VIEW', label: '스터디 크루 명단 열람', allowedRoles: ['ADMIN', 'LEADER'] },
        { key: 'STUDY_EDIT', label: '스터디 정보 수정', allowedRoles: ['ADMIN', 'LEADER'] },
        { key: 'ATTENDANCE_EDIT', label: '출석 현황 수정', allowedRoles: ['ADMIN', 'LEADER'] },
        {
          key: 'MEETING_MANAGE',
          label: '회차 관리 (추가·수정·삭제) — 담당 반에 한해',
          allowedRoles: ['ADMIN', 'LEADER'],
        },
        { key: 'NOTICE_STUDY', label: '스터디 공지 발행', allowedRoles: ['ADMIN', 'LEADER'] },
      ],
    },
    {
      scope: 'SITE',
      roles: ['ADMIN', 'MEMBER'],
      permissions: [
        { key: 'STUDY_CREATE', label: '스터디 등록', allowedRoles: ['ADMIN'] },
        { key: 'STUDY_PUBLISH', label: '스터디 공개', allowedRoles: ['ADMIN'] },
        { key: 'CREW_MANAGE', label: '반 편성', allowedRoles: ['ADMIN'] },
        { key: 'EVENT_MANAGE', label: '행사 등록 및 수정', allowedRoles: ['ADMIN'] },
        { key: 'NOTICE_SITE', label: '사이트 공지 발행', allowedRoles: ['ADMIN'] },
        { key: 'USER_VIEW', label: '전체 유저 명단 열람', allowedRoles: ['ADMIN'] },
        { key: 'USER_ROLE', label: '유저 역할 수정', allowedRoles: ['ADMIN'] },
      ],
    },
  ],
};

export const rolePermissionsHandlers = mockClient.createHandlerGroup('/api/admin/role-permissions', [
  {
    method: 'GET',
    path: '/',
    presets: [
      { label: '정상', status: 200, response: mockRolePermissions },
      {
        label: '403 캡틴 아님',
        status: 403,
        response: { errorCode: 'FORBIDDEN', errorMessage: '캡틴만 사용할 수 있는 기능입니다.' },
      },
    ],
  },
]);
