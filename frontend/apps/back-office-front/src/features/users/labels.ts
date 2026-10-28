// 회원 화면의 이름표와 문구 — 서버 값(DB enum)을 화면 이름으로 바꾸는 곳은 여기 한 곳이다.
import type { BadgeTone } from '@studyclub/ui';

import type { ApiAdminAccount, RoleChangeBlockedReason, SystemRole, UserRole } from '@/features/users/types';

/** 역할 키 → 화면 이름. 권한표의 열 이름도 같은 맵을 쓴다. 맵에 없는 키는 키 그대로 보인다. */
export const ROLE_LABEL: Record<string, string> = {
  ADMIN: '캡틴',
  LEADER: '네비게이터',
  MEMBER: '크루',
};

export function roleLabel(key: string): string {
  return ROLE_LABEL[key] ?? key;
}

/** 캡틴과 크루를 색만으로 가르지 않는다 — 이름도 함께 적는다. */
export const ROLE_TONE: Record<SystemRole, BadgeTone> = { ADMIN: 'captain', MEMBER: 'member' };

/** 계정에 줄 수 있는 것은 둘뿐이다. 네비게이터는 스터디마다 서는 역할이라 여기 없다. 캡틴 → 크루 순. */
export const ACCOUNT_ROLES: SystemRole[] = ['ADMIN', 'MEMBER'];

/** 탭 값이 곧 `role` 쿼리 값이다 (1:1). */
export const TAB_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'ALL', label: '전체' },
  { value: 'CAPTAIN', label: '캡틴' },
  { value: 'NAVIGATOR', label: '네비게이터' },
  { value: 'CREW', label: '크루' },
];

/** 잠금 사유 → 툴팁 문구 (스펙 「roleChangeBlockedReason」). */
export const BLOCKED_REASON_MESSAGE: Record<RoleChangeBlockedReason, string> = {
  CANNOT_CHANGE_OWN_ROLE: '자기 역할은 스스로 바꿀 수 없습니다. 다른 캡틴에게 요청하세요.',
  LAST_ADMIN_REQUIRED: '마지막 캡틴입니다. 먼저 다른 캡틴을 세우세요.',
};

/**
 * 권한 변경 성공 뒤 띄우는 안내 — 디스코드 역할은 자동으로 바꾸지 않는다(스펙).
 * 임시 문구다. playground 에 반영되면 그 문구로 바꾼다.
 */
export const DISCORD_NOTICE = '디스코드 설정은 운영자에게 문의해 바꿔 주세요.';

/** 권한표 제목·제목 옆 한마디. 맵에 없는 `scope` 는 키 문자열을 그대로 제목으로 쓴다. */
export const SCOPE_TITLE: Record<string, { title: string; note?: string }> = {
  STUDY: { title: '스터디 단위 권한', note: '네비게이터 권한은 담당 스터디에 국한' },
  SITE: { title: '사이트 전체 권한' },
};

/** 이름이 없는(온보딩 전) 계정은 가린 이메일의 로컬파트(`n***`)를 이름 자리에 적는다. 원본을 쓰면 마스킹이 무너진다. */
export function displayName(account: Pick<ApiAdminAccount, 'name' | 'maskedEmail'>): string {
  if (account.name) return account.name;
  return account.maskedEmail.split('@')[0] || account.maskedEmail;
}
