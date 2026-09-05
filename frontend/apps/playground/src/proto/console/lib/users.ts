// 유저 로스터 (프로토 mock).
//
// 실제 가입 계정은 백엔드에 있지만(`/api/users`), 프로토는 **역할·권한을 부여하는 화면**을
// 판단하려는 것이라 실제 계정 수(현재 0~수 명)로는 화면을 볼 수 없다. 그래서 이미 있는
// 스터디 크루 mock 에서 결정적으로 로스터를 만든다 — 난수를 쓰면 새로고침마다 명단이 바뀐다.
//
// TODO(api): GET /api/users — role 포함한 유저 목록으로 교체.

import { getStudyCrew, studies } from '@studyclub/mock';
import type { MemberRegion } from '@studyclub/mock';

import type { RoleKey } from './roles';

export type UserStatus = 'active' | 'dormant';

export type ConsoleUser = {
  id: string;
  name: string;
  email: string;
  region: MemberRegion;
  role: RoleKey;
  /** 가입일 (yyyy-mm-dd). */
  joinedAt: string;
  /** 승인되어 참여 중인 스터디 id. */
  studyIds: string[];
  status: UserStatus;
};

/** 캡틴 — 운영진 계정. mock operators 와 같은 사람으로 둔다. */
const CAPTAINS: { id: string; name: string; email: string; region: MemberRegion; joinedAt: string }[] = [
  { id: 'alex', name: 'Alex', email: 'alex@studyclub-plusplus.com', region: 'NA', joinedAt: '2025-01-08' },
  { id: 'robin', name: 'Robin', email: 'robin@studyclub-plusplus.com', region: 'NA', joinedAt: '2025-02-19' },
];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** seed → 과거 날짜. 가입일은 순서를 만들기 위한 값이라 정확할 필요는 없고 흔들리지만 않으면 된다. */
function joinDate(seed: number): string {
  const start = Date.UTC(2025, 0, 1);
  const d = new Date(start + (seed % 420) * 86_400_000);
  return d.toISOString().slice(0, 10);
}

/**
 * 전 스터디의 크루를 이메일로 합쳐 유저 명단을 만든다.
 * 같은 사람이 여러 스터디에 있으면 한 줄로 접고 참여 스터디를 모은다.
 */
function buildRoster(): ConsoleUser[] {
  const byEmail = new Map<string, ConsoleUser>();

  for (const captain of CAPTAINS) {
    byEmail.set(captain.email, {
      ...captain,
      role: 'captain',
      studyIds: [],
      status: 'active',
    });
  }

  for (const study of studies) {
    const { crew } = getStudyCrew(study);
    for (const c of crew) {
      if (c.status === 'rejected') continue;
      const found = byEmail.get(c.email);
      if (found) {
        if (c.status === 'active' && !found.studyIds.includes(study.id)) found.studyIds.push(study.id);
        continue;
      }
      const seed = hash(c.email);
      byEmail.set(c.email, {
        id: c.id,
        name: c.name,
        email: c.email,
        region: c.region,
        role: 'crew',
        joinedAt: joinDate(seed),
        studyIds: c.status === 'active' ? [study.id] : [],
        status: 'active',
      });
    }
  }

  // 승인된 스터디가 하나도 없으면 휴면으로 본다 — 신청만 해 두고 참여하지 않은 계정.
  const rows = [...byEmail.values()].map((m) => ({
    ...m,
    status: (m.role === 'captain' || m.studyIds.length > 0 ? 'active' : 'dormant') as UserStatus,
  }));

  // 캡틴 먼저, 그다음 네비게이터, 그다음 참여 스터디가 많은 순 — 운영자가 손댈 사람이 위로.
  const rank: Record<RoleKey, number> = { captain: 0, navigator: 1, crew: 2 };
  rows.sort(
    (a, b) => rank[a.role] - rank[b.role] || b.studyIds.length - a.studyIds.length || a.name.localeCompare(b.name),
  );

  // 네비게이터 두 명을 시연용으로 세운다. 정렬 뒤에 얹어야 매번 같은 사람이 걸린다.
  const promotable = rows.filter((r) => r.role === 'crew' && r.studyIds.length > 0);
  promotable.slice(0, 2).forEach((r) => {
    r.role = 'navigator';
  });

  rows.sort(
    (a, b) => rank[a.role] - rank[b.role] || b.studyIds.length - a.studyIds.length || a.name.localeCompare(b.name),
  );
  return rows;
}

export const consoleUsers: ConsoleUser[] = buildRoster();

/** 스터디 id → 제목(ko). 참여 스터디를 이름으로 보여주기 위한 표. */
export const studyTitleById: Record<string, string> = Object.fromEntries(studies.map((s) => [s.id, s.title.ko]));
