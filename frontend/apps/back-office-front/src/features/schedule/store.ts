import { isKickoff, type GroupTime, type Meeting, type ScheduleGroup } from './meetings';
import { wallParts, zonedInstant } from './time';

/**
 * 일정 탭의 저장소 — **지금은 브라우저(localStorage)에만 남는다.**
 *
 * 서버 API 는 반쪽만 있다 (beta, PR #312):
 *  - 읽기  GET /api/admin/studies/{studyId}/groups/{groupId}/meetings — 캡틴이면 어느 스터디 · 어느 반이든.
 *          사이트 목록과 같은 응답이다. 화면 모양으로 바꾸는 건 `api.ts` 의 `toMeetings`.
 *  - 킥오프 PUT /api/admin/studies/{studyId}/groups/{groupId}/kickoff — `api.ts` 의 `useSetKickoff`.
 * 둘 다 서버의 반 ID 를 경로에 받는다. 반 목록은 참여 명단(`GET /api/admin/studies/{id}/participants`)의 `groups[]` 에서
 * 받아 반 칩을 그리고(`groups.ts`), 이 저장소의 회차 · 규칙 · 출석도 그 반 ID 로 묶는다. 다만 그 GET 이 BE 에
 * 아직 없어(목업에만 있다) 회차는 아직 이 파일에 남는다. 반 목록을 못 받으면 이 저장소의 「기본반」 하나로 그린다.
 *
 * 회차 추가 · 수정 · 삭제는 사이트 API(`/api/studies/{id}/meetings`)만 있고, 그 스터디를 만든 캡틴만 통과한다 —
 * 다른 캡틴은 403. 백오피스 쓰기 API(`/api/admin/...`)는 스펙 미확정이다 (specs/study-meeting/spec.md 「미확정」).
 *
 * 화면은 이 파일의 함수만 부른다. API 가 생기면 여기만 바꾼다.
 * TODO(api): GET    /api/admin/studies/{studyId}/participants — BE 구현 대기 (반 목록은 이미 여기서 읽는다)
 *                   ← BE 에 붙으면 회차 읽기 · 킥오프를 서버로 (`api.ts`)
 *            PATCH  /api/admin/studies/{studyId}/groups/{groupId} — daysOfWeek · startTime · timezone
 *                   (경로는 있지만 지금은 name 만 받는다. 시간 칸은 DAYS_OF_WEEK 마이그레이션 뒤)
 *            회차 추가 · 수정 · 삭제 · 규칙 — 백오피스 쓰기 API 미정
 *
 * 출석 탭도 같은 저장소를 쓴다 — 출석부의 열이 이 회차들이다. 서버 출석 API(`/api/admin/studies/{id}/attendances`)는
 * 서버의 반 ID(`studyGroupId`)를 받는데, 반 목록 API 가 없어 백오피스는 그 ID 를 모른다. 또 그 경로는 `withdrawals[]` 를 받지 않는다(400).
 * TODO(api): GET  /api/admin/studies/{studyId}/attendances?studyGroupId=&includeWithdrawn=true
 *            POST /api/admin/studies/{studyId}/attendances — { studyGroupId, updates[], withdrawals[] } 한 트랜잭션
 */

/** 출석 칸 값. 칸이 없으면 미체크. */
export type AttendanceStatus = 'present' | 'late' | 'absent' | 'excused';

/** 그 반의 출석부 — 참가자 ID → 회차 ID → 상태. */
export type AttendanceBook = Record<string, Record<string, AttendanceStatus>>;

type StoredMeeting = {
  id: string;
  kind?: 'kickoff';
  scheduledAt: string;
  title?: string;
  presenter1?: string;
  presenter2?: string;
  /** 반복으로 한꺼번에 만든 회차의 묶음 ID — 화면은 쓰지 않는다. */
  seriesId?: string;
};

type StudyBook = {
  groups: ScheduleGroup[];
  meetings: Record<string, StoredMeeting[]>;
  rules: Record<string, string>;
  /** 반 ID → 출석부. 일정 탭이 먼저 만든 저장값에는 없다. */
  attendance?: Record<string, AttendanceBook>;
  /** 반 ID → 참가자 ID → 참여 중단 시각(UTC ISO). 되돌리지 않는다. */
  withdrawn?: Record<string, Record<string, string>>;
};

/** 처음엔 흔한 규칙 예시가 들어 있다. 킥오프에서 고친다. */
export const DEFAULT_RULES = `1. 각 주차에 최대 2명(발표자1, 발표자2)이 발표를 진행합니다.
2. 발표자1이 메인으로 발표하고, 발표자2는 부족한 점을 보충하거나 덧붙입니다.
3. 발표 자료는 언어 무관, 단 1장이라도 같이 볼 수 있는 자료를 준비합니다.
4. 발표 1시간(2명), Q&A 20분. 질문은 각자 1개씩 준비하면 좋습니다(강제 아님).`;

const EMPTY_TIME: GroupTime = { weekdays: [], time: '', tz: 'Asia/Seoul' };

const keyOf = (studyId: number) => `bo_schedule:${studyId}`;

/** 스터디를 만들면 「기본반」이 하나 생기고 신청한 크루는 모두 거기 들어온다 — 지금은 그 반 하나로 시작한다. */
function seed(): StudyBook {
  return { groups: [{ id: 'g1', title: '기본반', time: EMPTY_TIME }], meetings: {}, rules: {} };
}

function read(studyId: number): StudyBook {
  if (typeof window === 'undefined') return seed();
  try {
    const raw = localStorage.getItem(keyOf(studyId));
    return raw ? (JSON.parse(raw) as StudyBook) : seed();
  } catch {
    return seed();
  }
}

function write(studyId: number, book: StudyBook) {
  try {
    localStorage.setItem(keyOf(studyId), JSON.stringify(book));
  } catch {
    // 저장 실패해도 화면 동작은 막지 않는다
  }
}

function update(studyId: number, fn: (book: StudyBook) => void) {
  const book = read(studyId);
  fn(book);
  write(studyId, book);
}

/**
 * 서버 반(참여 명단 `groups[]`)에 이 저장소의 스터디 시간을 얹는다. 반 ID 는 서버 반 ID 그대로(문자열)다 —
 * 회차 · 규칙 · 출석도 그 ID 로 묶인다. 반 만들기 · 이름 · 삭제는 신청자 탭(서버)이 정본이다.
 * 스터디 시간은 서버가 아직 받지 않아(`PATCH …/groups` 는 이름만) 여기에 남는다.
 */
export function groupsFromServer(studyId: number, server: { groupId: number; name: string }[]): ScheduleGroup[] {
  const local = read(studyId).groups;
  return server.map((g) => {
    const id = String(g.groupId);
    return { id, title: g.name, time: local.find((l) => l.id === id)?.time ?? EMPTY_TIME };
  });
}

/** 서버 반 목록이 없을 때(참여 명단 API 가 없거나 실패) 쓰는 이 저장소의 반 — 처음엔 「기본반」 하나. */
export function listGroups(studyId: number): ScheduleGroup[] {
  return read(studyId).groups;
}

/** 스터디 시간만 바꾼다. 회차는 더하지도 다시 깔지도 않는다 — 회차는 일정 표의 「회차 추가」로만 만든다. */
export function saveGroupTime(studyId: number, group: ScheduleGroup, time: GroupTime) {
  update(studyId, (book) => {
    // 서버 반은 저장소에 처음 시간을 정할 때 들어온다
    book.groups = book.groups.some((g) => g.id === group.id)
      ? book.groups.map((g) => (g.id === group.id ? { ...g, title: group.title, time } : g))
      : [...book.groups, { ...group, time }];
  });
}

/** 킥오프를 맨 앞에, 정규 회차는 일정순으로 1부터. 일자·시각은 반 시간대로 계산한다. */
export function listMeetings(studyId: number, group: ScheduleGroup): Meeting[] {
  const rows = read(studyId).meetings[group.id] ?? [];
  const toMeeting = (m: StoredMeeting, no: number): Meeting => ({
    id: m.id,
    no,
    kind: m.kind,
    scheduledAt: m.scheduledAt,
    ...wallParts(new Date(m.scheduledAt), group.time.tz),
    title: m.title ?? (m.kind === 'kickoff' ? '킥오프' : ''),
    presenter1: m.presenter1 ?? '',
    presenter2: m.presenter2 ?? '',
  });
  const kickoff = rows.filter(isKickoff).map((m) => toMeeting(m, 0));
  const regular = rows
    .filter((m) => !isKickoff(m))
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
    .map((m, i) => toMeeting(m, i + 1));
  return [...kickoff, ...regular];
}

/** 회차를 더한다. 킥오프는 만들지 않는다 — 캡틴이 「킥오프 정하기」로 정한다 (spec 결정 11, share 10-22). */
export function addMeetings(
  studyId: number,
  group: ScheduleGroup,
  input: { dates: string[]; time: string; title?: string },
) {
  const stamp = Date.now();
  const title = input.title?.trim() || undefined;
  const seriesId = input.dates.length > 1 ? `r${stamp}` : undefined;
  const at = (date: string) => zonedInstant(date, input.time, group.time.tz).toISOString();
  update(studyId, (book) => {
    const added: StoredMeeting[] = input.dates.map((date, i) => ({
      id: `m${stamp}-${i}`,
      scheduledAt: at(date),
      title,
      seriesId,
    }));
    book.meetings[group.id] = [...(book.meetings[group.id] ?? []), ...added];
  });
}

/**
 * 킥오프를 정하거나 옮긴다 — 없으면 만들고, 있으면 시각만 바꾼다(ID 그대로라 찍은 출석이 따라온다).
 * 서버: PUT /api/admin/studies/{studyId}/groups/{groupId}/kickoff `{ scheduledAt }`.
 */
export function setKickoff(studyId: number, group: ScheduleGroup, input: { date: string; time: string }) {
  const scheduledAt = zonedInstant(input.date, input.time, group.time.tz).toISOString();
  update(studyId, (book) => {
    const rows = book.meetings[group.id] ?? [];
    book.meetings[group.id] = rows.some(isKickoff)
      ? rows.map((m) => (isKickoff(m) ? { ...m, scheduledAt } : m))
      : [...rows, { id: `m${Date.now()}-k`, kind: 'kickoff', scheduledAt, title: '킥오프' }];
  });
}

/** 회차 한 줄에서 바꾸는 값. 넘긴 것만 바꾼다. 발표자 `null` 은 비우기. 일자·시각은 반 시간대 벽시계. */
export type MeetingPatch = {
  date: string;
  time: string;
  title: string;
  presenter1?: string | null;
  presenter2?: string | null;
};

export function patchMeetings(studyId: number, group: ScheduleGroup, patches: Record<string, MeetingPatch>) {
  update(studyId, (book) => {
    book.meetings[group.id] = (book.meetings[group.id] ?? []).map((m) => {
      const p = patches[m.id];
      if (!p) return m;
      const next: StoredMeeting = {
        ...m,
        scheduledAt: zonedInstant(p.date, p.time, group.time.tz).toISOString(),
        title: p.title.trim() || undefined,
      };
      if (p.presenter1 !== undefined) next.presenter1 = p.presenter1 ?? undefined;
      if (p.presenter2 !== undefined) next.presenter2 = p.presenter2 ?? undefined;
      return next;
    });
  });
}

/** 고른 회차를 한꺼번에 지운다. 킥오프는 지우지 않는다. */
export function deleteMeetings(studyId: number, groupId: string, ids: string[]) {
  const gone = new Set(ids);
  update(studyId, (book) => {
    book.meetings[groupId] = (book.meetings[groupId] ?? []).filter((m) => isKickoff(m) || !gone.has(m.id));
  });
}

export function getRules(studyId: number, groupId: string): string {
  return read(studyId).rules[groupId] ?? DEFAULT_RULES;
}

export function saveRules(studyId: number, groupId: string, text: string) {
  update(studyId, (book) => {
    book.rules[groupId] = text;
  });
}

export function getAttendance(studyId: number, groupId: string): AttendanceBook {
  return read(studyId).attendance?.[groupId] ?? {};
}

/** 고친 출석부를 통째로 저장한다 — 서버에는 바뀐 칸만 `updates[]` 한 요청으로 보낼 자리다. */
export function saveAttendance(studyId: number, groupId: string, next: AttendanceBook) {
  update(studyId, (book) => {
    book.attendance = { ...book.attendance, [groupId]: next };
  });
}

/** 참가자 ID → 참여 중단 시각(UTC ISO). */
export function getWithdrawn(studyId: number, groupId: string): Record<string, string> {
  return read(studyId).withdrawn?.[groupId] ?? {};
}

/**
 * 참여 중단 — 중단 시각을 남기고, 그 뒤에 시작하는 회차의 발표자 칸에서 뺀다. 지난 회차의 발표 기록과 출석은 남는다.
 * 이미 중단한 사람은 시각을 덮어쓰지 않는다. 되돌리기는 없다 (share 10-18).
 */
export function withdrawPeople(studyId: number, groupId: string, ids: string[], now = new Date()) {
  const at = now.toISOString();
  update(studyId, (book) => {
    const left = { ...book.withdrawn?.[groupId] };
    for (const id of ids) left[id] ??= at;
    book.withdrawn = { ...book.withdrawn, [groupId]: left };
    const gone = new Set(ids);
    book.meetings[groupId] = (book.meetings[groupId] ?? []).map((m) => {
      if (m.scheduledAt <= at) return m;
      const next = { ...m };
      if (next.presenter1 && gone.has(next.presenter1)) delete next.presenter1;
      if (next.presenter2 && gone.has(next.presenter2)) delete next.presenter2;
      return next;
    });
  });
}
