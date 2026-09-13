/**
 * 역할 · 권한 모델 (프로토).
 *
 * "캡틴은 유저에게 서로 다른 역할과 권한을 줄 수 있다" 를 화면에서 확인하기 위한 최소 모델이다.
 * 실제 권한 판정은 백엔드가 해야 한다 — 여기 값은 **PRD 를 쓰기 전에 화면 위에서 합의하기 위한
 * 초안**이며, 확정되면 `backend/.../auth/Role.java` 와 맞춘다.
 *
 * TODO(api): GET/PATCH /api/users/{id}/role
 *
 * **역할이 권한 묶음을 결정한다.** 유저마다 권한을 하나씩 켜 주면 규칙이 운영자 머릿속에만 남아
 * 몇 달 뒤 누가 무엇을 할 수 있는지 아무도 모른다. 줄 수 있는 것은 역할뿐이다.
 */

export type RoleKey = 'captain' | 'navigator' | 'crew';

export const ROLES: { key: RoleKey; label: string; scope: string; desc: string }[] = [
  {
    key: 'captain',
    label: '캡틴',
    scope: '플랫폼 전체',
    desc: '스터디·행사·회원을 모두 관리한다. 역할을 부여할 수 있는 유일한 역할.',
  },
  {
    key: 'navigator',
    label: '네비게이터',
    scope: '맡은 스터디',
    // 현장에서 부르는 이름은 「반장」이다. 화면 표기는 네비게이터로 통일한다.
    desc: '맡은 스터디를 진행한다 — 알럿·출석·정보 수정. 참여 신청 처리는 하지 않는다.',
  },
  {
    key: 'crew',
    label: '크루',
    scope: '본인',
    desc: '스터디에 참여한다. 콘솔 권한은 없다.',
  },
];

export const ROLE_LABEL: Record<RoleKey, string> = {
  captain: '캡틴',
  navigator: '네비게이터',
  crew: '크루',
};

/** 권한 키 — `대상.행위`. 화면 하나가 아니라 **행위** 단위로 쪼갠다. */
export type PermissionKey =
  | 'study.create'
  | 'study.edit'
  | 'study.publish'
  | 'crew.manage'
  | 'notice.study'
  | 'attendance.edit'
  | 'event.create'
  | 'event.edit'
  | 'notice.site'
  | 'user.view'
  | 'user.role';

/**
 * 권한이 붙는 행위만 담는다.
 *
 * **출석 체크는 여기 없다.** 보이스룸에서 `/StudyStart` 로 그날 출석을 여는 일은 누구나 할 수 있어
 * 역할로 가르지 않는다. 권한이 필요한 것은 **이미 기록된 출석을 고치는 일**(attendance.edit)이다.
 */
export const PERMISSIONS: { key: PermissionKey; label: string; desc: string }[] = [
  // **대상으로 묶는다** — 스터디에 하는 일, 행사에 하는 일, 사이트와 사람에 하는 일 순.
  // 역할 경계(네비게이터가 어디까지 되는가)로 묶지 않는다. 경계는 체크 열이 이미 말한다.
  // 묶음 안에서는 개설 → 고치기 → 굴리기 → 알리기 순으로 둔다.
  { key: 'study.create', label: '스터디 개설', desc: '새 스터디를 만든다' },
  { key: 'study.edit', label: '스터디 정보 수정', desc: '제목·일정·모집 정보를 고친다' },
  // 공개는 정보 수정에 딸려 있지 않다. 딸려 있으면 담당 스터디를 굴리는 네비게이터가
  // 사이트에 스터디를 세울 수 있게 된다 — 세우는 일은 캡틴의 판단이다.
  { key: 'study.publish', label: '스터디 공개', desc: '등록한 스터디를 사용자 사이트에 세우거나 내린다' },
  { key: 'crew.manage', label: '반 편성', desc: '반을 만들고 크루를 반에 넣거나 옮긴다' },
  { key: 'attendance.edit', label: '출석 현황 수정', desc: '기록된 출석을 고친다' },
  { key: 'notice.study', label: '스터디 공지 발행', desc: '스터디 크루에게 공지를 보낸다 (디스코드 채널)' },
  { key: 'event.create', label: '행사 개설', desc: '새 행사를 만든다' },
  { key: 'event.edit', label: '행사 정보 수정', desc: '날짜·장소·모집 정보를 고친다' },
  { key: 'notice.site', label: '사이트 공지 발행', desc: '사용자 사이트 공지사항에 글을 올린다' },
  { key: 'user.view', label: '전체 유저 명단 열람', desc: '가입한 유저 전체 목록과 참여 이력을 본다' },
  { key: 'user.role', label: '역할 부여', desc: '다른 유저의 역할·권한을 바꾼다' },
];

/**
 * 권한이 미치는 범위.
 *
 * **네비게이터의 권한은 전부 「맡은 스터디」 안에서만 선다.** 허용·없음 두 값으로만 그리면
 * 「스터디 정보 수정 ✓」이 모든 스터디를 고칠 수 있다는 뜻으로 읽힌다.
 */
export type Scope = 'all' | 'own' | 'none';

export const SCOPE_LABEL: Record<Scope, string> = {
  all: '전체',
  own: '맡은 스터디',
  none: '없음',
};

/**
 * 역할별 기본 권한과 그 범위.
 *
 * `user.role` 은 캡틴에게만 있다 — 역할을 줄 수 있는 사람이 여럿이면 권한이 조용히 번진다.
 */
export const ROLE_PERMISSIONS: Record<RoleKey, Partial<Record<PermissionKey, Scope>>> = {
  captain: {
    'study.create': 'all',
    'study.edit': 'all',
    'study.publish': 'all',
    'crew.manage': 'all',
    'attendance.edit': 'all',
    'event.create': 'all',
    'event.edit': 'all',
    'notice.study': 'all',
    'notice.site': 'all',
    'user.view': 'all',
    'user.role': 'all',
  },
  // 네비게이터는 **맡은 스터디를 굴리는 데 필요한 것**만, 그 스터디 안에서만 갖는다.
  // 반 편성은 없다 — 누가 어느 반에 들어가는지는 캡틴이 정한다.
  // 전체 유저 명단도 없다 — 맡은 스터디의 크루 명단은 그 스터디를 굴리면 따라오는 것이라
  // 권한으로 가르지 않는다. 권한이 필요한 것은 **가입자 전체**를 보는 일이다.
  navigator: {
    'study.edit': 'own',
    'notice.study': 'own',
    'attendance.edit': 'own',
  },
  crew: {},
};

/** 이 역할이 이 권한을 어디까지 갖는가. */
export function scopeOf(role: RoleKey, key: PermissionKey): Scope {
  return ROLE_PERMISSIONS[role][key] ?? 'none';
}

export const PERMISSION_LABEL: Record<PermissionKey, string> = Object.fromEntries(
  PERMISSIONS.map((p) => [p.key, p.label]),
) as Record<PermissionKey, string>;

/**
 * 이 유저의 역할을 지금 바꿀 수 있는가. 막는 이유를 문자열로 돌려준다 —
 * 버튼만 흐리게 두면 운영자는 왜 안 되는지 몰라 문의를 남긴다.
 *
 * 「캡틴인가」는 묻지 않는다. 이 화면에 들어온 것 자체가 캡틴이라는 뜻이고,
 * 아닌 사람은 라우트에서 막힌다.
 */
export function assignBlockReason(args: { isSelf: boolean; targetRole: RoleKey; captainCount: number }): string | null {
  const { isSelf, targetRole, captainCount } = args;
  // 자기 역할을 스스로 내리면 되돌릴 사람이 자기 자신뿐인 상황이 생긴다.
  if (isSelf) return '자기 역할은 스스로 바꿀 수 없습니다. 다른 캡틴에게 요청하세요.';
  if (targetRole === 'captain' && captainCount <= 1) return '마지막 캡틴입니다. 먼저 다른 캡틴을 세우세요.';
  return null;
}
