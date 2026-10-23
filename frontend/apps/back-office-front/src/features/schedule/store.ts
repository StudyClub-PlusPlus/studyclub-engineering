import { isKickoff, type GroupTime, type Meeting, type ScheduleGroup } from './meetings';
import { addDaysYmd, wallParts, zonedInstant } from './time';

/**
 * 일정 탭의 저장소 — **지금은 브라우저(localStorage)에만 남는다.**
 *
 * 백오피스가 반·회차를 다루는 `/api/admin` API 가 아직 없다. 사용자 사이트 회차 API(`/api/studies/{id}/meetings`)는
 * 그 스터디를 만든 캡틴과 그 반 네비게이터만 통과해서(specs/study-meeting/spec.md 결정 3) 백오피스가 쓸 수 없고,
 * 반 목록 API(`GET /api/admin/studies/{id}/participants`)도 스펙 작성 중이다.
 *
 * 화면은 이 파일의 함수만 부른다. API 가 생기면 여기만 바꾼다.
 * TODO(api): GET    /api/admin/studies/{studyId}/participants — groups[] (반 목록)
 *            PATCH  /api/admin/studies/{studyId}/groups/{groupId} — daysOfWeek · startTime · timezone
 *            GET    /api/admin/studies/{studyId}/meetings?studyGroupId= — 회차 · 발표자 · 규칙
 *            POST   /api/admin/studies/{studyId}/meetings — { studyGroupId, scheduledAts[](UTC), title? }
 *            PUT    /api/admin/studies/{studyId}/meetings/{meetingId} — 시각 · 제목 · 바꾼 발표자 칸
 *            DELETE /api/admin/studies/{studyId}/meetings — { studyGroupId, meetingIds[] } 전부 아니면 하나도
 *            PUT    /api/admin/studies/{studyId}/groups/{groupId}/rules
 */

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

export function listGroups(studyId: number): ScheduleGroup[] {
  return read(studyId).groups;
}

/** 스터디 시간만 바꾼다. 회차는 더하지도 다시 깔지도 않는다 — 회차는 일정 표의 「회차 추가」로만 만든다. */
export function saveGroupTime(studyId: number, groupId: string, time: GroupTime) {
  update(studyId, (book) => {
    book.groups = book.groups.map((g) => (g.id === groupId ? { ...g, time } : g));
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

/**
 * 회차를 더한다. 킥오프가 없는 반에 처음 정규 회차를 더하면 첫 회차 한 주 전에 킥오프를 함께 만든다 —
 * 서버가 할 일이다(PRD §3 데이터 「종류」).
 */
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
    const rows = book.meetings[group.id] ?? [];
    const added: StoredMeeting[] = input.dates.map((date, i) => ({
      id: `m${stamp}-${i}`,
      scheduledAt: at(date),
      title,
      seriesId,
    }));
    if (!rows.some(isKickoff)) {
      const first = [...input.dates].sort()[0];
      added.push({ id: `m${stamp}-k`, kind: 'kickoff', scheduledAt: at(addDaysYmd(first, -7)), title: '킥오프' });
    }
    book.meetings[group.id] = [...rows, ...added];
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
