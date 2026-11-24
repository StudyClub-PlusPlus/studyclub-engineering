import {
  daysIn,
  isoDay,
  monthOf,
  prevMonth,
  type ClubBook,
  type ClubConfig,
  type ClubMember,
  type Month,
  type PastCohort,
} from '@console/lib/clubs';
import type { AttendanceStatus } from '@studyclub/types';

/**
 * 클럽 운영 프로토의 가짜 데이터 — 화면 규칙과 섞지 않는다.
 * TODO(api): 이 파일 전체가 서버 응답으로 바뀐다.
 *   명단 · 출석: GET /api/admin/studies/{studyId}/attendances · 지난 기수: GET /api/admin/clubs/{programId}/cohorts
 */

/** 프로토의 「오늘」 두 가지 — 다음 기수 초안이 만들어지기 전과 뒤. */
export type DemoDay = 'before' | 'after';
export const DEMO_TODAY: Record<DemoDay, string> = { before: '2026-12-10', after: '2026-12-16' };

const NAMES = [
  '새벽세시',
  '모닝커피',
  '코딩하는곰',
  '꾸준함',
  '하루한걸음',
  '오늘도출근',
  '데이터덕후',
  '느린거북',
  '알고리즘초보',
  '산책러',
  '책벌레',
  '밤샘금지',
];

const WAKE = [
  '05:30',
  '06:00',
  '06:00',
  '05:00',
  '06:30',
  '05:45',
  '06:00',
  '07:00',
  '05:30',
  '06:15',
  '06:00',
  '05:30',
];

/** 이번 기수 명단. 클럽마다 사람 수와 중단한 사람이 조금씩 다르다. */
export function seedMembers(club: ClubConfig): ClubMember[] {
  const size = club.key === 'earlybird' ? 12 : club.key === 'weeklyx' ? 10 : 9;
  return NAMES.slice(0, size).map((name, i) => ({
    id: `${club.key}-${i + 1}`,
    name,
    // 신청 답 — 프로토 가정 값
    extra: !club.rosterQuestion
      ? undefined
      : club.key === 'earlybird'
        ? WAKE[i]
        : `lc_${['dawn', 'bear', 'step', 'turtle', 'walker', 'owl', 'data', 'book', 'cup'][i] ?? i}`,
    leftOn: i === 7 ? '2026-12-08' : undefined,
    joined: i < size - 3 ? 'carried' : 'applied',
  }));
}

/**
 * 이번 달 출석 — 캡틴이 시트와 함께 쓰므로 빈 날이 섞여 있다.
 * 1일부터 「오늘 − 3일」까지만 채운다 (시트에서 옮기는 데 며칠 걸린다).
 */
export function seedBook(club: ClubConfig, members: ClubMember[], today: string, full = false): ClubBook {
  const m = monthOf(today);
  const last = full ? daysIn(m) : Number(today.slice(8, 10)) - 3;
  const book: ClubBook = {};
  members.forEach((mem, i) => {
    const row: Record<string, AttendanceStatus> = {};
    for (let d = 1; d <= last; d++) {
      const day = isoDay(m, d);
      if (mem.leftOn && day > mem.leftOn) break;
      const r = (i * 7 + d * 13) % 17;
      let s: AttendanceStatus = r < 11 ? 'present' : r < 14 ? 'absent' : 'excused';
      if (club.statuses.includes('late') && r === 3) s = 'late';
      if (mem.leftOn && r > 6) s = 'absent';
      row[day] = s;
    }
    book[mem.id] = row;
  });
  return book;
}

/** 지난 기수 6개 — 최신 순. 프로토 가정 숫자 */
export function pastCohorts(club: ClubConfig, current: Month): PastCohort[] {
  const base = club.key === 'earlybird' ? 14 : club.key === 'weeklyx' ? 11 : 10;
  const out: PastCohort[] = [];
  let m = prevMonth(current);
  for (let i = 0; i < 6; i++) {
    const members = base - (i % 3);
    const withdrawn = 1 + ((i + club.key.length) % 3);
    const completed = members - withdrawn;
    out.push({
      month: m,
      members,
      completed,
      withdrawn,
      carried: completed - (i % 2),
      rate: 70 + ((i * 7 + base) % 15),
    });
    m = prevMonth(m);
  }
  return out;
}

/** 끝난 기수의 명단 · 출석 — 그 달 전체가 채워져 있다 */
export function seedPast(club: ClubConfig, m: Month): { members: ClubMember[]; book: ClubBook } {
  const members = seedMembers(club).map((mem) => (mem.leftOn ? { ...mem, leftOn: isoDay(m, 8) } : mem));
  return { members, book: seedBook(club, members, isoDay(m, daysIn(m)), true) };
}
