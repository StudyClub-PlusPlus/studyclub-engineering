// 백오피스 회원 목록·권한 타입. 응답 모양은 specs/admin-users/spec.md 와 1:1 이다.
//
// 값은 DB enum 그대로(`ADMIN`·`MEMBER`) 받는다. 화면 이름(캡틴·크루)으로 바꾸는 일은 labels.ts 한 곳에서 한다.

export type SystemRole = 'ADMIN' | 'MEMBER';

/** 이 행의 권한을 지금 바꿀 수 없는 이유. 판정은 서버가 하고 화면은 문구만 띄운다. */
export type RoleChangeBlockedReason = 'CANNOT_CHANGE_OWN_ROLE' | 'LAST_ADMIN_REQUIRED';

export type ApiAdminAccount = {
  id: number;
  /** 온보딩 전이면 null — 화면은 `maskedEmail` 의 로컬파트(`n***`)를 적는다. */
  name: string | null;
  /** 서버가 가린 이메일. 원본은 「보기」(POST …/email-reveals)로만 받는다. */
  maskedEmail: string;
  systemRole: SystemRole;
  /** 담당 스터디. 없으면 `[]`. 편입 최신순. */
  navigatorOf: { studyId: number; title: string }[];
  /** 「휴면」 표기 — 참여 중인 스터디가 없다. */
  dormant: boolean;
  joinedAt: string;
  roleChangeBlockedReason: RoleChangeBlockedReason | null;
};

export type ApiAdminAccountPage = {
  items: ApiAdminAccount[];
  /** 걸러진 뒤 전체 수 — 「총 N명」. 지금 페이지의 행 수가 아니다. */
  total: number;
  offset: number;
  limit: number;
};

export type ApiEmailReveal = { id: number; email: string };

export type ApiRoleChange = { id: number; systemRole: SystemRole };

/** 서버 `Permission` 정의를 그대로 내려받은 것. 그룹·열·행을 화면 코드에 박지 않는다. */
export type ApiRolePermissions = {
  groups: {
    scope: string;
    roles: string[];
    permissions: { key: string; label: string; allowedRoles: string[] }[];
  }[];
};

/**
 * 목록의 역할 필터 = 화면 탭 (`role` 쿼리 값). 서로 배타적이지 않다 — 네비게이터도 계정은 크루라
 * 「크루」 탭에 함께 나온다. 응답의 `systemRole`(ADMIN·MEMBER)과 값이 다르다(탭에는 계정 권한이 아닌 네비게이터가 있다).
 */
export type UserRole = 'ALL' | 'CAPTAIN' | 'NAVIGATOR' | 'CREW';

/** 목록 조건. 비우면 그 조건을 걸지 않는다. 쿼리 키에 그대로 들어간다. */
export type UserFilter = {
  /** 생략하면 `ALL`. */
  role?: UserRole;
  q?: string;
  offset: number;
  limit: number;
};

/** 화면은 20명 고정(스펙). */
export const USER_PAGE_SIZE = 20;
