// 백오피스 회원 API 목 — specs/admin-users/spec.md 의 응답 모양 그대로.
//
// 서버가 하는 일(필터·정렬·페이지·마스킹·잠금 사유)을 목에서도 같은 순서로 흉내 낸다.
// 화면이 목에서만 도는 규칙에 기대지 않게, 응답 필드는 스펙 이름 그대로 둔다.
// 이메일은 example.com 만 쓴다 — 실제 개인정보를 넣지 않는다.
import { HttpResponse } from 'msw';

import { mockClient, type MockResolveContext } from '../utils';

export type ApiSystemRole = 'ADMIN' | 'MEMBER';

export type ApiAdminAccount = {
  id: number;
  /** 온보딩 전이면 null — 화면은 maskedEmail 의 로컬파트를 적는다. */
  name: string | null;
  maskedEmail: string;
  systemRole: ApiSystemRole;
  navigatorOf: { studyId: number; title: string }[];
  dormant: boolean;
  joinedAt: string;
  roleChangeBlockedReason: 'CANNOT_CHANGE_OWN_ROLE' | 'LAST_ADMIN_REQUIRED' | null;
};

export type ApiAdminAccountPage = {
  items: ApiAdminAccount[];
  total: number;
  offset: number;
  limit: number;
};

/** 서버가 DB 에서 읽는 값. 응답에는 이 중 일부만 가공해 내보낸다. */
type MockAccountRecord = {
  id: number;
  nickname: string | null;
  email: string;
  systemRole: ApiSystemRole;
  navigatorOf: { studyId: number; title: string }[];
  /** 참여 중인 스터디 수 — 정렬과 dormant 판정에 쓴다. */
  participating: number;
  joinedAt: string;
};

/** 목에서 「로그인한 캡틴」으로 치는 계정. 이 행은 CANNOT_CHANGE_OWN_ROLE 로 잠긴다. */
export const MOCK_ACTOR_ID = 3;

const NAMES = [
  '가온', '하늘', '다온', '라온', '마루', '바다', '사랑', '아름', '자람', '차오름',
  '카리', '타미', '파랑', '하람', '서윤', '도윤', '지우', '시우', '예준', '민서',
  '하준', '유진', '수아', '지호', '서연', '현우', '지민', '은우', '채원', '주원',
  '소율', '건우', '다은', '우진', '나윤', '태오', '연우', '리아', '세아', '준서',
  '하린', '이안', '로아', '선우', '보라', '나래',
];

const LOCALS = [
  'gaon', 'haneul', 'daon', 'raon', 'maru', 'bada', 'sarang', 'areum', 'jaram', 'chaoreum',
  'kari', 'tami', 'parang', 'haram', 'seoyun', 'doyun', 'jiu', 'siu', 'yejun', 'minseo',
  'hajun', 'yujin', 'sua', 'jiho', 'seoyeon', 'hyunwoo', 'jimin', 'eunwoo', 'chaewon', 'juwon',
  'soyul', 'geonwoo', 'daeun', 'ujin', 'nayun', 'taeo', 'yeonwoo', 'ria', 'sea', 'junseo',
  'harin', 'ian', 'roa', 'sunwoo', 'bora', 'narae',
];

const STUDIES = {
  ai: { studyId: 21, title: 'AI 논문 리딩' },
  algo: { studyId: 9, title: '알고리즘 스터디' },
  sysdesign: { studyId: 14, title: '시스템 디자인 클럽' },
  rust: { studyId: 5, title: 'Rust 입문' },
  front: { studyId: 31, title: '프론트엔드 심화' },
  data: { studyId: 2, title: '데이터 분석 스터디' },
};

/** 계정 id → 담당 스터디(편입 최신순). 없으면 담당 스터디가 없는 사람이다. */
const NAVIGATOR_OF: Record<number, { studyId: number; title: string }[]> = {
  2: [STUDIES.ai, STUDIES.algo],
  5: [STUDIES.sysdesign],
  7: [STUDIES.rust],
  11: [STUDIES.front],
  18: [STUDIES.data],
  24: [STUDIES.ai],
  33: [STUDIES.algo, STUDIES.sysdesign, STUDIES.rust],
};

const ADMIN_IDS = new Set([3, 5, 12]);
/** 온보딩 전이라 이름이 없는 계정. */
const NO_NAME_IDS = new Set([9, 17, 27, 40]);

const DAY = 86_400_000;

function buildAccounts(): MockAccountRecord[] {
  return NAMES.map((name, i) => {
    const id = i + 1;
    const navigatorOf = NAVIGATOR_OF[id] ?? [];
    // 4의 배수는 참여 이력이 없는 휴면. 담당 스터디가 있으면 최소 그 수만큼 참여 중이다.
    const base = id % 4 === 0 ? 0 : (id * 7) % 5;
    return {
      id,
      nickname: NO_NAME_IDS.has(id) ? null : name,
      email: `${LOCALS[i]}@example.com`,
      systemRole: ADMIN_IDS.has(id) ? 'ADMIN' : 'MEMBER',
      navigatorOf,
      participating: Math.max(base, navigatorOf.length),
      joinedAt: new Date(Date.UTC(2026, 0, 5, 3, 41, 9) + id * 5 * DAY).toISOString().replace('.000Z', 'Z'),
    };
  });
}

export const mockAdminAccounts: MockAccountRecord[] = buildAccounts();

/** 앞 1자 + `***` + `@` 이후. */
export function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at <= 0) return '***';
  return `${email[0]}***${email.slice(at)}`;
}

function blockedReason(a: MockAccountRecord, accounts: MockAccountRecord[]): ApiAdminAccount['roleChangeBlockedReason'] {
  if (a.id === MOCK_ACTOR_ID) return 'CANNOT_CHANGE_OWN_ROLE';
  if (a.systemRole === 'ADMIN' && accounts.filter((x) => x.systemRole === 'ADMIN').length <= 1) {
    return 'LAST_ADMIN_REQUIRED';
  }
  return null;
}

function toApi(a: MockAccountRecord, accounts: MockAccountRecord[]): ApiAdminAccount {
  return {
    id: a.id,
    name: a.nickname,
    maskedEmail: maskEmail(a.email),
    systemRole: a.systemRole,
    navigatorOf: a.navigatorOf,
    dormant: a.participating === 0,
    joinedAt: a.joinedAt,
    roleChangeBlockedReason: blockedReason(a, accounts),
  };
}

/** 서버 정렬 — ADMIN 먼저 → 담당 스터디 있음 → 참여 수 많은 순 → 가입일 최신 → id 큰 순. */
function compare(a: MockAccountRecord, b: MockAccountRecord): number {
  return (
    Number(b.systemRole === 'ADMIN') - Number(a.systemRole === 'ADMIN') ||
    Number(b.navigatorOf.length > 0) - Number(a.navigatorOf.length > 0) ||
    b.participating - a.participating ||
    b.joinedAt.localeCompare(a.joinedAt) ||
    b.id - a.id
  );
}

const forbidden = { errorCode: 'FORBIDDEN', errorMessage: '캡틴만 사용할 수 있는 기능입니다.' };
const notFound = { errorCode: 'NOT_FOUND', errorMessage: '계정을 찾을 수 없습니다.' };
const cannotChangeOwnRole = {
  errorCode: 'CANNOT_CHANGE_OWN_ROLE',
  errorMessage: '자기 역할은 스스로 바꿀 수 없습니다. 다른 캡틴에게 요청하세요.',
};
const lastAdminRequired = {
  errorCode: 'LAST_ADMIN_REQUIRED',
  errorMessage: '마지막 캡틴입니다. 먼저 다른 캡틴을 세우세요.',
};

function listAccounts({ request }: MockResolveContext): ApiAdminAccountPage {
  const url = new URL(request.url);
  const role = url.searchParams.get('role') ?? 'ALL';
  const q = (url.searchParams.get('q') ?? '').trim().toLowerCase();
  const offset = Math.max(0, Number(url.searchParams.get('offset') ?? 0) || 0);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? 20) || 20));

  let rows = [...mockAdminAccounts];
  // 네 값은 배타적이지 않다 — CREW 는 MEMBER 계정이라 네비게이터도 함께 나온다
  if (role === 'CAPTAIN') rows = rows.filter((a) => a.systemRole === 'ADMIN');
  if (role === 'NAVIGATOR') rows = rows.filter((a) => a.navigatorOf.length > 0);
  if (role === 'CREW') rows = rows.filter((a) => a.systemRole === 'MEMBER');
  // 이름은 부분 일치, 이메일은 **전체 일치만** — 부분 검색으로 가린 이메일을 알아내지 못하게 (스펙)
  if (q) {
    rows = rows.filter((a) => (a.nickname?.toLowerCase().includes(q) ?? false) || a.email.toLowerCase() === q);
  }
  rows.sort(compare);

  return {
    items: rows.slice(offset, offset + limit).map((a) => toApi(a, mockAdminAccounts)),
    total: rows.length,
    offset,
    limit,
  };
}

async function revealEmail({ params }: MockResolveContext): Promise<{ id: number; email: string } | Response> {
  const account = mockAdminAccounts.find((a) => a.id === Number(params.accountId));
  if (!account) return HttpResponse.json(notFound, { status: 404 });
  return HttpResponse.json(
    { id: account.id, email: account.email },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

async function changeRole({ request, params }: MockResolveContext): Promise<{ id: number; systemRole: ApiSystemRole } | Response> {
  const body = (await request.json().catch(() => null)) as { systemRole?: string } | null;
  const next = body?.systemRole;
  if (next !== 'ADMIN' && next !== 'MEMBER') {
    return HttpResponse.json(
      { errorCode: 'INVALID_INPUT', errorMessage: 'systemRole 은 ADMIN 또는 MEMBER 여야 합니다.' },
      { status: 400 },
    );
  }
  const account = mockAdminAccounts.find((a) => a.id === Number(params.accountId));
  if (!account) return HttpResponse.json(notFound, { status: 404 });
  // 서버 처리 규칙 순서 그대로 — 본인 → 같은 값(변경 없이 200) → 마지막 캡틴
  if (account.id === MOCK_ACTOR_ID) return HttpResponse.json(cannotChangeOwnRole, { status: 409 });
  if (account.systemRole === next) return { id: account.id, systemRole: next };
  const adminCount = mockAdminAccounts.filter((a) => a.systemRole === 'ADMIN').length;
  if (account.systemRole === 'ADMIN' && adminCount <= 1) {
    return HttpResponse.json(lastAdminRequired, { status: 409 });
  }
  account.systemRole = next;
  return { id: account.id, systemRole: next };
}

export const accountsHandlers = mockClient.createHandlerGroup('/api/admin/users', [
  {
    method: 'GET',
    path: '/',
    presets: [
      { label: '정상', status: 200, response: listAccounts },
      {
        label: '빈 결과',
        status: 200,
        response: { items: [], total: 0, offset: 0, limit: 20 } satisfies ApiAdminAccountPage,
      },
      { label: '403 캡틴 아님', status: 403, response: forbidden },
    ],
  },
  {
    method: 'POST',
    path: '/:accountId/email-reveals',
    presets: [
      { label: '성공', status: 200, response: revealEmail },
      { label: '404 없는 계정', status: 404, response: notFound },
      { label: '403 캡틴 아님', status: 403, response: forbidden },
    ],
  },
  {
    method: 'PATCH',
    path: '/:accountId/system-role',
    presets: [
      { label: '성공', status: 200, response: changeRole },
      { label: '409 본인 변경', status: 409, response: cannotChangeOwnRole },
      { label: '409 마지막 캡틴', status: 409, response: lastAdminRequired },
      { label: '404 없는 계정', status: 404, response: notFound },
      { label: '403 캡틴 아님', status: 403, response: forbidden },
    ],
  },
]);
