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
  | 'crew.approve'
  | 'study.alert'
  | 'attendance.check'
  | 'attendance.edit'
  | 'event.manage'
  | 'notice.publish'
  | 'user.view'
  | 'user.role';

export const PERMISSIONS: { key: PermissionKey; label: string; desc: string }[] = [
  { key: 'study.create', label: '스터디 개설', desc: '새 스터디를 만든다' },
  { key: 'study.edit', label: '스터디 정보 수정', desc: '제목·일정·모집 정보를 고친다' },
  { key: 'crew.approve', label: '신청 승인 · 내보내기', desc: '스터디 참여 신청을 처리한다' },
  { key: 'study.alert', label: '스터디 알럿 발송', desc: '스터디 디스코드 채널에 알림을 보낸다' },
  {
    key: 'attendance.check',
    label: '출석 체크',
    // 신규 방식: 보이스룸에서 네비게이터가 `/StudyStart` → 시작 10분 뒤 자동 체크.
    // 현재는 참석자 화면을 캡처해 구글 시트에 옮겨 적는다.
    desc: '디스코드 명령어로 출석을 기록한다',
  },
  { key: 'attendance.edit', label: '출석 현황 수정', desc: '기록된 출석을 고친다' },
  { key: 'event.manage', label: '행사 관리', desc: '행사를 등록·수정한다' },
  { key: 'notice.publish', label: '공지 발행', desc: '사용자 사이트에 공지를 올린다' },
  { key: 'user.view', label: '유저 명단 열람', desc: '유저 목록과 참여 이력을 본다' },
  { key: 'user.role', label: '역할 부여', desc: '다른 유저의 역할·권한을 바꾼다' },
];

/**
 * 역할별 기본 권한.
 *
 * `user.role` 은 캡틴에게만 있다 — 역할을 줄 수 있는 사람이 여럿이면 권한이 조용히 번진다.
 */
export const ROLE_PERMISSIONS: Record<RoleKey, PermissionKey[]> = {
  captain: [
    'study.create',
    'study.edit',
    'crew.approve',
    'study.alert',
    'attendance.check',
    'attendance.edit',
    'event.manage',
    'notice.publish',
    'user.view',
    'user.role',
  ],
  // 네비게이터는 **맡은 스터디를 굴리는 데 필요한 것**만 갖는다.
  // 신청 승인·내보내기는 없다 — 누가 들어오는지는 캡틴이 정한다.
  navigator: ['study.edit', 'study.alert', 'attendance.check', 'attendance.edit', 'user.view'],
  crew: [],
};

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
