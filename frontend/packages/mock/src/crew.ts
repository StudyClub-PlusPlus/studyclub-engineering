import type { MemberRegion, Study } from "./index";

/**
 * 크루(참여자)·회차·출석 mock.
 *
 * 실제 데이터는 백엔드에 없으므로 **스터디 id 로부터 결정적으로 생성**한다. 난수를 쓰면 서버 렌더와
 * 클라이언트 렌더 결과가 달라지고, 새로고침마다 명단이 바뀌어 화면을 판단할 수 없다.
 *
 * TODO(api): GET /api/studies/{id}/crew · /sessions · /attendance
 */

/** 출석 상태. */
export type AttendanceStatus = "present" | "late" | "absent";

/**
 * 크루 상태.
 * - pending  : 승인 대기
 * - active   : 승인됨 — 출석부에 오른다
 * - waitlist : 정원이 차서 대기
 * - rejected : 거절
 */
export type CrewStatus = "pending" | "active" | "waitlist" | "rejected";

export type Crew = {
  id: string;
  name: string;
  email: string;
  region: MemberRegion;
  status: CrewStatus;
  appliedAt: string;
  /** 지난 스터디 참여 횟수 */
  pastStudies: number;
  /** 지난 스터디 완주율(%). 참여 이력이 없으면 undefined — 0% 로 표기하면 성실하지 않은 사람으로 오독된다. */
  completionRate?: number;
  /** 일정 미정 스터디에서 고른 가능 시간 */
  cells?: string[];
  motivation?: string;
};

export type StudySession = {
  id: string;
  no: number;
  date: string; // yyyy-mm-dd
};

export type StudyCrewData = {
  capacity: number;
  crew: Crew[];
  sessions: StudySession[];
  /** crewId → sessionId → 상태. 값이 없으면 아직 체크하지 않은 것. */
  attendance: Record<string, Record<string, AttendanceStatus>>;
};

const CLEAN_NAMES = [
  "지원", "민서", "도윤", "서연", "하준", "예린", "시우", "수아", "지호", "채원",
  "건우", "유나", "민준", "소율", "준서", "다인", "현우", "지안", "태윤", "은서",
  "성민", "가온", "루아", "세아", "정우",
];

const REGIONS: MemberRegion[] = ["KR", "KR", "KR", "NA", "KR", "NA", "ETC", "KR", "NA", "KR"];

/** 문자열 → 정수 해시. 같은 스터디는 항상 같은 명단을 만든다. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** seed 로부터 0 이상 max 미만 정수. */
function pick(seed: number, max: number): number {
  return Math.abs(Math.imul(seed ^ 0x9e3779b9, 2654435761)) % max;
}

const FALLBACK_DATE = "2026-08-01";

/** 마감일 표기가 흔들리거나 비어 있어도(예: "상시") 회차 계산이 깨지지 않게 한다. */
function baseDate(raw?: string): string {
  const m = raw?.trim().match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);
  if (!m) return FALLBACK_DATE;
  const iso = `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  return Number.isNaN(new Date(`${iso}T00:00:00Z`).getTime()) ? FALLBACK_DATE : iso;
}

function addWeeks(iso: string, weeks: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + weeks * 7);
  return d.toISOString().slice(0, 10);
}

/**
 * 스터디의 크루·회차·출석을 만든다.
 *
 * 회차는 **오늘까지 지난 것만 출석이 채워진다** — 앞으로 열릴 회차가 미리 체크돼 있으면
 * 운영자가 무엇을 해야 하는지 알 수 없다.
 */
export function getStudyCrew(study: Study, today = new Date().toISOString().slice(0, 10)): StudyCrewData {
  const seed = hash(study.id);
  const capacity = 12 + pick(seed, 3) * 4; // 12 · 16 · 20
  const activeCount = Math.max(5, capacity - 2 - pick(seed + 7, 5));
  // 마감된 스터디에도 처리되지 않은 신청은 남는다 — 승인 대기는 상태와 무관하게 존재한다
  const pendingCount = 1 + pick(seed + 13, 4);
  const waitlistCount = 0; // 대기 상태는 쓰지 않는다 — 승인하거나, 승인하지 않거나 둘뿐이다

  const crew: Crew[] = [];
  const total = activeCount + pendingCount + waitlistCount;
  for (let i = 0; i < total; i++) {
    const s = seed + i * 101;
    const past = pick(s + 3, 5); // 0~4
    const status: CrewStatus =
      i < activeCount ? "active" : i < activeCount + pendingCount ? "pending" : "waitlist";
    crew.push({
      id: `${study.id}-c${i + 1}`,
      name: CLEAN_NAMES[pick(s, CLEAN_NAMES.length)],
      email: `member${(pick(s + 1, 900) + 100).toString()}@example.com`,
      region: REGIONS[pick(s + 5, REGIONS.length)],
      status,
      appliedAt: addWeeks(baseDate(study.recruitment?.deadline), -1 - pick(s + 9, 3)),
      pastStudies: past,
      completionRate: past === 0 ? undefined : 60 + pick(s + 11, 5) * 10, // 60~100
      motivation: undefined,
    });
  }

  // 회차 — 일정이 적혀 있지 않아도 실제로는 회차를 돌린다. 출석부가 비면 화면을 볼 수 없다.
  //
  // 시작일을 **오늘 기준**으로 잡아 이미 몇 회차가 지난 상태로 만든다. 모집 마감일 이후로
  // 잡으면 모집 중인 스터디는 회차가 전부 미래라 출석이 한 칸도 없고, 출석부를 볼 수 없다.
  const weeks = 6 + pick(seed + 41, 3) * 2; // 6 · 8 · 10
  const doneCount = 2 + pick(seed + 47, weeks - 2); // 최소 2회차는 지나 있다
  const start = addWeeks(today, -(doneCount - 1));
  const sessions: StudySession[] = [];
  for (let i = 0; i < weeks; i++) {
    sessions.push({ id: `${study.id}-s${i + 1}`, no: i + 1, date: addWeeks(start, i) });
  }

  const diligence = 45 + pick(seed + 61, 9) * 5; // 45 · 50 … 85
  const attendance: StudyCrewData["attendance"] = {};
  for (const c of crew) {
    if (c.status !== "active") continue;
    const row: Record<string, AttendanceStatus> = {};
    for (const ses of sessions) {
      if (ses.date > today) continue; // 아직 오지 않은 회차는 비워 둔다
      // 스터디마다 성실도가 다르다(출석 확률 55~95%). 전부 같은 확률이면 카테고리별 출석률이
      // 전부 90% 언저리로 뭉쳐 그래프가 아무것도 말해주지 못한다.
      const r = pick(hash(c.id + ses.id), 100);
      row[ses.id] = r < diligence ? "present" : r < diligence + 12 ? "late" : "absent";
    }
    attendance[c.id] = row;
  }

  return { capacity, crew, sessions, attendance };
}

/**
 * 출석률(%).
 * - 분모: **체크된 회차만** — 아직 열리지 않은 회차 때문에 낮아 보이면 안 된다
 * - 분자: 출석 + 지각 — 늦게라도 참석한 것은 결석과 같지 않다
 */
export function attendanceRate(row: Record<string, AttendanceStatus> | undefined): number | undefined {
  if (!row) return undefined;
  const values = Object.values(row);
  if (values.length === 0) return undefined;
  return Math.round((values.filter((v) => v !== "absent").length / values.length) * 100);
}

/**
 * 인기 스터디 여부.
 *
 * TODO(policy): **기준 미정.** 지금은 "모집 중이면서 정원 대비 신청이 몰린 스터디"로 본다.
 * 조회수·북마크·신청 속도 중 무엇을 쓸지 정해지면 이 함수만 바꾸면 화면 전체가 따라온다.
 */
export function isHotStudy(study: Study): boolean {
  if (study.status !== "recruiting") return false;
  const { crew, capacity } = getStudyCrew(study);
  const applied = crew.filter((c) => c.status !== "rejected").length;
  return applied / capacity >= 0.85;
}
