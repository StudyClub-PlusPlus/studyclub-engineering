import type { MemberRegion, Study } from "./index";

/**
 * 크루(참여자)·회차·출석 mock.
 *
 * 실제 데이터는 백엔드에 없으므로 **스터디 id 로부터 결정적으로 생성**한다. 난수를 쓰면 서버 렌더와
 * 클라이언트 렌더 결과가 달라지고, 새로고침마다 명단이 바뀌어 화면을 판단할 수 없다.
 *
 * TODO(api): GET /api/studies/{id}/crew · /meetings · /attendance
 */

/** 출석 상태. 값이 없으면 미체크. */
export type AttendanceStatus = "present" | "late" | "absent" | "excused";

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

/** 회차. ERD `STUDY_MEETING`. 영어는 meeting (로그인 SESSION과 구분). */
export type StudyMeeting = {
  id: string;
  no: number;
  /** 예정일 (ERD STUDY_MEETING.SCHEDULED_AT 의 날짜). 실제 시작·종료는 반장이 열 때. */
  date: string; // yyyy-mm-dd
};

export type StudyCrewData = {
  capacity: number;
  crew: Crew[];
  meetings: StudyMeeting[];
  /** crewId → meetingId → 상태. 값이 없으면 아직 체크하지 않은 것. */
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

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function mondayOf(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const dow = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - (dow === 0 ? 6 : dow - 1));
  return d.toISOString().slice(0, 10);
}

const KO_DOW: Record<string, number> = { 월: 1, 화: 2, 수: 3, 목: 4, 금: 5, 토: 6 };

/** 일정 문구에서 요일을 읽는다. "매일"의 일은 요일이 아니다. */
function weekdaysOf(study: Study, seed: number): number[] {
  const ko = study.schedule?.ko ?? "";
  const found: number[] = [];
  for (const name of ["월", "화", "수", "목", "금", "토"] as const) {
    if (ko.includes(name)) found.push(KO_DOW[name]);
  }
  if (/(?:매주|격주)\s*일|일요일/.test(ko)) found.push(0);
  if (found.length) return [...new Set(found)];
  return [pick(seed + 53, 7)];
}

function dateOnWeek(monday: string, utcDow: number): string {
  return addDays(monday, utcDow === 0 ? 6 : utcDow - 1);
}

/** 월별 클럽 기수(id 가 `-g1`·`-g2`·`-g3`)는 그 달 안의 회차만 만든다. */
function monthRangeMeetings(study: Study, seed: number): StudyMeeting[] | undefined {
  if (!study.date || !/-g[123]$/.test(study.id)) return undefined;
  const start = study.date;
  const [y, mo] = start.split("-").map(Number);
  const end = new Date(Date.UTC(y, mo, 0)).toISOString().slice(0, 10);
  const weekdays = weekdaysOf(study, seed);
  const meetings: StudyMeeting[] = [];
  let no = 1;
  for (let iso = start; iso <= end; iso = addDays(iso, 1)) {
    const dow = new Date(`${iso}T00:00:00Z`).getUTCDay();
    if (!weekdays.includes(dow)) continue;
    meetings.push({ id: `${study.id}-s${no}`, no, date: iso });
    no += 1;
  }
  return meetings.length ? meetings : undefined;
}

function addWeeks(iso: string, weeks: number): string {
  return addDays(iso, weeks * 7);
}

/**
 * 프로토 크루 화면의 나와의 관계. `joined.ts` lifeStatus 와 같은 스터디 id 를 쓴다.
 * - upcoming  : 시작전 — 회차는 전부 미래, 출석 칸은 비움
 * - active    : 참여중 — 지난 회차만 채움
 * - completed : 완주 — 회차는 전부 과거, 칸을 다 채움
 * - left      : 참여 중단 — 지난 회차만 채움, 완주 아님
 */
export type DemoCrewRelation = "upcoming" | "active" | "completed" | "left";

const LEFT_EARLY_IDS = new Set(["renaissance-club", "system-design-interview-ongoing"]);
const FORCE_ACTIVE_IDS = new Set(["ai-paper-study"]);
const MISS_ONE_IDS = new Set(["weeklyx-g2", "daily-leetcode-g2"]);
const PARTIAL_COMPLETE_IDS = new Set(["sql-for-data-analysis"]);

export function demoCrewRelation(study: Study): DemoCrewRelation {
  if (LEFT_EARLY_IDS.has(study.id)) return "left";
  if (FORCE_ACTIVE_IDS.has(study.id)) return "active";
  if (study.status === "closed") return "completed";
  if (study.status === "recruiting") return "upcoming";
  return "active";
}

function weeksOf(study: Study, seed: number): number {
  const ko = study.schedule?.ko ?? "";
  const weeks = ko.match(/(\d+)\s*주/);
  if (weeks) return Number(weeks[1]);
  // "4회" 같은 과정 길이만. "주 1회 회고"는 주기다.
  const times = ko.match(/·\s*(\d+)\s*회/);
  if (times) return Number(times[1]);
  // LeetCode150 전회 예시: 화·목 × 5주 = 10회
  if (study.id === "leetcode150-2026") return 5;
  return 6 + pick(seed + 41, 3) * 2; // 6 · 8 · 10
}

/** 첫 회차가 속한 월요일. 관계에 맞춰 과거·미래를 가른다. */
function firstMondayOf(study: Study, weeks: number, seed: number, today: string): string {
  const thisMonday = mondayOf(today);
  const relation = demoCrewRelation(study);
  if (relation === "completed") {
    // 마지막 주 = 지난주. 완주 회차가 오늘 이후에 남지 않게 한다.
    return addWeeks(mondayOf(addDays(today, -7)), 1 - weeks);
  }
  if (relation === "upcoming") {
    return addWeeks(thisMonday, 1);
  }
  // 참여중·참여 중단: 지난주를 마지막으로 몇 주는 지나 있고, 최소 1주는 남긴다.
  const lastPastMonday = mondayOf(addDays(today, -7));
  const pastWeeks =
    weeks <= 1 ? 1 : Math.min(weeks - 1, Math.max(2, 2 + pick(seed + 47, Math.max(1, weeks - 3))));
  return addWeeks(lastPastMonday, 1 - pastWeeks);
}

const ACTIVE_CYCLE: AttendanceStatus[] = ["present", "late", "present", "late", "absent", "excused"];
const LEFT_CYCLE: AttendanceStatus[] = ["present", "late", "absent", "excused", "absent"];

/**
 * 내 출석 시드. 회차 칸 · 출석률 · 완주 점수판이 같은 시드를 본다.
 * 출석률은 지각을 0.5로 세고, 완주 점수판 n/n 은 출석+지각 횟수다.
 *
 * - 시작전: 비움
 * - 참여중: 지난 회차에 출석·지각·결석·휴가 순환. 미래는 비움
 * - 완주: 전회(LeetCode 등) 또는 일부 결석(SQL · g2 일부)
 * - 참여 중단: 지난 회차만 섞어서 채움
 */
export function demoMyAttendance(
  study: Study,
  meetings: StudyMeeting[],
  today: string,
): Record<string, AttendanceStatus> {
  const row: Record<string, AttendanceStatus> = {};
  const relation = demoCrewRelation(study);
  if (relation === "upcoming") return row;

  if (relation === "completed") {
    if (PARTIAL_COMPLETE_IDS.has(study.id)) {
      const attended = Math.max(1, Math.round(meetings.length * 0.6));
      meetings.forEach((m, i) => {
        row[m.id] = i < attended ? "present" : "absent";
      });
      return row;
    }
    const missOne = MISS_ONE_IDS.has(study.id);
    meetings.forEach((m, i) => {
      row[m.id] = missOne && i === meetings.length - 1 ? "absent" : "present";
    });
    return row;
  }

  const cycle = relation === "left" ? LEFT_CYCLE : ACTIVE_CYCLE;
  meetings
    .filter((m) => m.date < today)
    .forEach((m, i) => {
      row[m.id] = cycle[i % cycle.length];
    });
  return row;
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
  // 시작일은 나와의 관계에 맞춘다. 시작전은 전부 미래, 완주는 전부 과거, 참여중은 일부를 지나게.
  const monthMeetings = monthRangeMeetings(study, seed);
  const meetings: StudyMeeting[] = monthMeetings ?? [];
  if (!monthMeetings) {
    const weeks = weeksOf(study, seed);
    const weekdays = weekdaysOf(study, seed);
    const firstMonday = firstMondayOf(study, weeks, seed, today);
    let no = 1;
    for (let w = 0; w < weeks; w++) {
      const weekMon = addWeeks(firstMonday, w);
      for (const dow of weekdays) {
        meetings.push({ id: `${study.id}-s${no}`, no, date: dateOnWeek(weekMon, dow) });
        no += 1;
      }
    }
  }

  // 회차 생성 시 전원 ABSENT. 지난 회차에만 데모 상태를 덮는다. 미래 회차는 행을 두지 않아
  // 시작 전 결석이 화면에 안 나온다.
  const DEMO_CYCLE: AttendanceStatus[] = ["present", "late", "present", "late", "absent", "excused"];
  const attendance: StudyCrewData["attendance"] = {};
  for (const c of crew) {
    if (c.status !== "active") continue;
    const row: Record<string, AttendanceStatus> = {};
    let past = 0;
    for (const m of meetings) {
      if (m.date > today) continue;
      row[m.id] = DEMO_CYCLE[past % DEMO_CYCLE.length];
      past += 1;
    }
    attendance[c.id] = row;
  }

  return { capacity, crew, meetings, attendance };
}

/** 지각 가중치. 출석률 = (present + late × W) / 대상 회차. */
export const LATE_WEIGHT = 0.5;

/**
 * 출석률 분자에 넣는 점수. 출석 = 1, 지각 = W, 결석 = 0. 휴가는 분모에서 뺀다.
 */
export function attendancePoint(status: AttendanceStatus): number {
  if (status === "present") return 1;
  if (status === "late") return LATE_WEIGHT;
  return 0;
}

/**
 * 출석률(%).
 * - 분모: 대상 회차 — 휴가 제외. 아직 시작하지 않은 회차(키 없음)는 넣지 않는다
 * - 분자: present + late × W. W = 0.5
 */
export function attendanceRate(row: Record<string, AttendanceStatus> | undefined): number | undefined {
  if (!row) return undefined;
  const target = Object.values(row).filter((v) => v !== "excused");
  if (target.length === 0) return undefined;
  const score = target.reduce((sum, v) => sum + attendancePoint(v), 0);
  return Math.round((score / target.length) * 100);
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
