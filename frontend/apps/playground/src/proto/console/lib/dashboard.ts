import { tx } from '@console/lib/l10n';
import {
  CATEGORY_DISPLAY,
  MEMBER_REGIONS,
  attendancePoint,
  categoriesOf,
  getStudyCrew,
  recruitState,
  site,
  studies,
  toISODate,
  todayISO,
  type MemberRegion,
} from '@studyclub/mock';

/**
 * 대시보드 집계.
 *
 * 전 스터디의 크루·회차·출석을 **한 번만 순회**해 화면이 필요한 값을 전부 뽑는다. 위젯마다 따로
 * 돌리면 같은 수를 서로 다르게 세게 된다.
 *
 * TODO(api): 위젯별 GET /api/admin/stats/* · /api/admin/studies 로 교체
 */

/** 추세 구간. 12주보다 짧으면 계절을, 길면 최근 변화를 못 본다. */
export const TREND_WEEKS = 12;

/** 마감 임박 기준. 이 안에 들면 이번 주에 손을 써야 한다. */
export const DEADLINE_SOON_DAYS = 7;

/** 사분면이 미리 보여주는 행 수. 넘으면 「외 N개」로 접는다. */
export const BOARD_PREVIEW = 4;

export type BoardStudy = {
  id: string;
  title: string;
  /** 모집중 — 모집 마감일. 상시 모집이면 undefined */
  deadline?: string;
};

export type TrendPoint = {
  weekStart: string;
  /** 그 주에 체크된 회차가 없으면 null — 0% 로 찍으면 쉬어간 주가 폭락으로 보인다 */
  rate: number | null;
  attended: number;
  target: number;
};

/** yyyy-mm-dd 기준 남은 일수. 지났으면 음수. */
export function daysUntil(iso: string, today = todayISO()): number {
  return Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}

function mondayOf(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const dow = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - (dow === 0 ? 6 : dow - 1));
  return d.toISOString().slice(0, 10);
}

function addWeeks(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n * 7);
  return d.toISOString().slice(0, 10);
}

/**
 * 주제 코드.
 *
 * 목록으로 넘길 때 **표시 라벨이 아니라 코드**를 쓴다. 라벨은 문구가 바뀌거나 영어로 뒤집히면
 * 링크가 깨진다. 코드는 API 가 쓰는 enum 이름 그대로다 — 새 이름을 따로 만들면 둘을 맞춰야 한다.
 */
export function categoryCode(label: string): string {
  const hit = Object.entries(CATEGORY_DISPLAY).find(([, name]) => name === label);
  return (hit?.[0] ?? 'OTHER').toLowerCase();
}

export function aggregate(today = todayISO()) {
  const regionCount: Record<MemberRegion, number> = { KR: 0, NA: 0, ETC: 0 };
  // 주제는 **중복해서 달 수 있다.** 그래서 규모를 사람 수로 세지 않는다 — 한 사람이 여러 줄에
  // 잡혀 합계가 총원을 넘고, 같은 화면의 「활성 크루」와 어긋나 보인다. 라벨이 몇 번 붙었는가,
  // 즉 **스터디 수**로 센다.
  const byCategory = new Map<string, { running: number; total: number }>();
  const weekStarts = Array.from({ length: TREND_WEEKS }, (_, i) => addWeeks(mondayOf(today), i - (TREND_WEEKS - 1)));
  const weekIndex = new Map(weekStarts.map((w, i) => [w, i]));
  const weekly = weekStarts.map(() => ({ attended: 0, target: 0 }));

  const ongoing: BoardStudy[] = [];
  const recruiting: BoardStudy[] = [];

  // **사람**과 **참여 건**을 따로 센다. 한 사람이 스터디 둘에 들어가 있으면 사람은 1, 참여는 2다.
  // 1인당 참여 스터디의 분모는 아래 activeCrew 와 같은 집합이어야 한다 — 모수가 갈리면
  // 같은 화면의 두 카드가 서로 다른 전체를 말하게 된다.
  const activePeople = new Set<string>();
  const enrollments = new Set<string>();
  let present = 0;
  let checked = 0;

  for (const study of studies) {
    const { crew, attendance, meetings } = getStudyCrew(study);
    const active = crew.filter((c) => c.status === 'active');
    const running = study.status !== 'closed';
    const categories = categoriesOf(study);
    // 주제는 중복해서 달 수 있다 — 한 스터디가 여러 줄에 잡히는 것이 정상이다.
    for (const category of categories.length > 0 ? categories : ['기타']) {
      const cat = byCategory.get(category) ?? { running: 0, total: 0 };
      cat.total += 1;
      if (running) cat.running += 1;
      byCategory.set(category, cat);
    }

    for (const c of active) {
      if (running) {
        // 같은 사람이 같은 스터디에 두 번 잡혀 있어도 참여는 한 건이다.
        activePeople.add(c.email);
        enrollments.add(`${c.email}|${study.id}`);
        regionCount[c.region] += 1;
      }
      for (const [meetingId, v] of Object.entries(attendance[c.id] ?? {})) {
        // 휴가는 분모에서 빠진다 — 미리 알리고 빠진 것을 결석과 같이 세면 성실한 사람이 손해를 본다
        if (v === 'excused') continue;
        const pt = attendancePoint(v);
        checked += 1;
        present += pt;
        const date = meetings.find((m) => m.id === meetingId)?.date;
        const wi = date === undefined ? undefined : weekIndex.get(mondayOf(date));
        if (wi !== undefined) {
          weekly[wi]!.target += 1;
          weekly[wi]!.attended += pt;
        }
      }
    }
    if (running) {
      ongoing.push({ id: study.id, title: tx(study.title) });
    }

    if (recruitState(study) === 'apply') {
      recruiting.push({ id: study.id, title: tx(study.title), deadline: toISODate(study.recruitment?.deadline) });
    }
  }

  const trend: TrendPoint[] = weekStarts.map((weekStart, i) => {
    const w = weekly[i]!;
    return {
      weekStart,
      rate: w.target === 0 ? null : Math.round((w.attended / w.target) * 100),
      attended: Math.round(w.attended),
      target: w.target,
    };
  });

  // 전주 대비는 **주 단위 기록이 있는 값만** 낼 수 있다. 활성 크루·진행 중 스터디·커뮤니티 멤버는
  // 지난주 스냅샷이 없으므로 델타를 만들지 않는다 — 없는 수를 지어내면 화면이 거짓말을 한다.
  // TODO(api): 주간 스냅샷이 생기면 나머지 셋도 델타를 붙인다
  const lastTwo = trend.filter((p) => p.rate !== null).slice(-2);
  const rateDelta = lastTwo.length === 2 ? lastTwo[1]!.rate! - lastTwo[0]!.rate! : undefined;

  const activeCrew = activePeople.size;

  return {
    updatedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
    kpi: {
      activeCrew,
      attendanceRate: checked === 0 ? 0 : Math.round((present / checked) * 100),
      // 크루 1인당 참여 스터디 = 진행 중 스터디의 참여 건수 ÷ 활성 크루
      studiesPerCrew: activeCrew === 0 ? 0 : Math.round((enrollments.size / activeCrew) * 10) / 10,
      communityMembers: site.community.member_count,
      communityRegion: tx(site.community.region),
      rateDelta,
    },
    board: {
      // 이름순. 순서에 뜻을 담으려면 그 기준이 화면에 보여야 하는데, 여기는 이름만 있다.
      ongoing: ongoing.sort((a, b) => a.title.localeCompare(b.title, 'ko')),
      // 마감이 가까운 것부터. 상시 모집(마감일 없음)은 급할 게 없으므로 끝으로.
      recruiting: recruiting.sort(
        (a, b) =>
          (a.deadline ? daysUntil(a.deadline, today) : 9999) - (b.deadline ? daysUntil(b.deadline, today) : 9999),
      ),
    },
    regions: MEMBER_REGIONS.map((r) => ({ key: r.key, count: regionCount[r.key] })),
    categories: [...byCategory.entries()].map(([category, v]) => ({
      category,
      code: categoryCode(category),
      running: v.running,
      total: v.total,
    })),
    trend,
  };
}
