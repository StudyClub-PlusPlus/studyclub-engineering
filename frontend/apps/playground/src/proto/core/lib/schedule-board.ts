'use client';

import { meetingsOf } from '@core/lib/attendance';
import { getUser } from '@core/lib/auth';
import { isKickoff, scheduleAccessOf, type ManageRole, type ScheduleRole } from '@core/lib/meetings';
import { myGroupCrew } from '@core/lib/navigator-attendance';
import type { Study } from '@studyclub/mock';

/**
 * 스터디 일정 화면이 구글 시트 출석부에서 옮겨 온 것 — 참가자(발표자 후보)와 스터디 규칙.
 *
 * TODO(api): 참가자 = STUDY_PARTICIPANT (그 분반). 규칙 = STUDY_GROUP.RULES.
 */

/** 발표자로 고를 수 있는 분반 참가자. `me` 는 로그인한 나. */
export type Participant = {
  id: string;
  name: string;
  me?: boolean;
  /** 캡틴·네비게이터면 그 역할. 크루는 비운다 — 출석부 이름 옆 칩. */
  role?: ManageRole;
  /** 스터디를 중단한 사람(하차·제명 구분 없이 「참여 중단」). `at` 은 중단 시각(yyyy-MM-ddTHH:mm, 분반 시간대). */
  left?: { at: string };
};

/** 프로토의 「나」 — 분반 명부에 따로 없어 ID 를 고정한다. */
export const ME_ID = 'me';

function myName(): string {
  const user = getUser();
  // 이메일은 이름으로 쓰지 않는다 — 발표자·네비게이터로 다른 사람에게 보인다.
  return user?.nickname || '나';
}

/**
 * 나를 맨 앞에 두고 분반 크루를 잇는다. 발표자 드롭다운과 출석부 이름 칸이 같은 명단을 쓴다.
 * 이름이 겹치면 디스코드 닉네임을, 그것도 없으면 명단 순번을 붙인다 — 「태윤」 둘 중 누구인지 고를 수 없다.
 * 이메일은 쓰지 않는다 — 크루에게 다른 사람의 이메일을 보이지 않는다.
 */
export function participantsOf(study: Study): Participant[] {
  const crew = myGroupCrew(study);
  const myRole = scheduleAccessOf(study).role;
  // 프로토 가정 — 명부 5번째·9번째가 3회차 날 참여를 중단했다고 본다.
  // TODO(api): STUDY_PARTICIPANT.STATUS = WITHDRAWN · LEFT_AT
  const regular = meetingsOf(study).filter((m) => !isKickoff(m));
  const leftAt = regular[2]?.date ?? regular[0]?.date ?? '';
  const changed = readLeft()[study.id] ?? {};
  const leftOf = (id: string, i: number) => {
    // 네비게이터가 중단시킨 기록이 프로토 가정보다 앞선다.
    if (id in changed) return changed[id];
    // 그날 회차까지 하고 나갔다고 본다 — 그날 끝 시각.
    return leftAt && (i === 4 || i === 8) ? { at: `${leftAt}T23:59` } : undefined;
  };
  const names = [myName(), ...crew.map((c) => c.name)];
  const dup = (name: string) => names.filter((n) => n === name).length > 1;
  return [
    { id: ME_ID, name: myName(), me: true, role: myRole === 'crew' ? undefined : myRole },
    ...crew.map((c, i) => ({
      id: c.id,
      name: dup(c.name) ? `${c.name} (${c.discordNickname ?? `#${i + 1}`})` : c.name,
      // 프로토 가정 — 내가 네비게이터가 아니면 명부 첫 사람이 네비게이터다 (navigatorNameOf 와 같다).
      role: i === 0 && myRole !== 'navigator' ? ('navigator' as const) : undefined,
      left: leftOf(c.id, i),
    })),
  ];
}

/* ── 참여 중단 ─────────── ─────────────────────────────────────────────── */

/**
 * 네비게이터가 출석부에서 참여를 중단시킨 기록. 되돌리기는 없다. 프로토는 브라우저에만 남는다.
 * TODO(api): POST /api/studies/{studyId}/attendances 의 withdrawals[] — 출석 저장과 한 요청
 */
const LEFT_KEY = 'sc_participant_left';

/** studyId → participantId → 중단 시각. */
type LeftStore = Record<string, Record<string, { at: string }>>;

function readLeft(): LeftStore {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(LEFT_KEY);
    return raw ? (JSON.parse(raw) as LeftStore) : {};
  } catch {
    return {};
  }
}

function writeLeft(studyId: string, participantId: string, value: { at: string }): void {
  const store = readLeft();
  store[studyId] = { ...(store[studyId] ?? {}), [participantId]: value };
  try {
    localStorage.setItem(LEFT_KEY, JSON.stringify(store));
  } catch {
    // 저장 실패해도 화면 동작은 막지 않는다
  }
}

/**
 * 지금 시각(yyyy-MM-ddTHH:mm). 프로토는 브라우저 시간대로 회차 시각과 견준다.
 * 서버는 누른 순간을 LEFT_AT 에 UTC 로 남기고 회차 SCHEDULED_AT 과 견준다 — 시간대 차이가 없다.
 */
function now(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 참여 중단 — 지금까지의 출석은 남고, 지금 뒤에 시작하는 회차는 「—」·출석률에서 빠진다. */
export function withdrawParticipant(studyId: string, participantId: string): void {
  writeLeft(studyId, participantId, { at: now() });
}

/**
 * 시트 머리의 「네비게이터 : jamiekim80」. 내가 네비게이터면 나, 아니면 명부 첫 사람으로 둔다.
 * **프로토 가정** — 실제 네비게이터가 아니다. 서버 응답 `studyGroup.navigatorName` 으로 바꾼다.
 * TODO(api): STUDY_PARTICIPANT.PARTICIPANT_ROLE = LEADER 인 사람.
 */
export function navigatorNameOf(study: Study, role: ScheduleRole): string {
  if (role === 'navigator') return myName();
  return myGroupCrew(study)[0]?.name ?? '—';
}

/* ── 스터디 규칙 ───────────────────────────────────────────────────────── */

/** 프로토는 분반이 하나라 스터디 단위로 저장한다. 서버는 분반 단위(STUDY_GROUP.RULES)다. */
const RULES_KEY = 'sc_study_rules';

/** 처음 보이는 규칙 — 운영 중인 시트에서 가장 흔한 모양. 킥오프에서 고친다. */
export const DEFAULT_RULES = `1. 각 주차에 최대 2명(발표자1, 발표자2)이 발표를 진행합니다.
2. 발표자1이 메인으로 발표하고, 발표자2는 부족한 점을 보충하거나 덧붙입니다.
3. 발표 자료는 언어 무관, 단 1장이라도 같이 볼 수 있는 자료를 준비합니다.
4. 발표 1시간(2명), Q&A 20분. 질문은 각자 1개씩 준비하면 좋습니다(강제 아님).`;

/** 운영 중인 시트의 규칙은 150~350자다. 한 화면 카드로 읽히는 길이에서 끊는다. */
export const RULES_MAX = 500;

function readRules(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(RULES_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function getRules(studyId: string): string {
  return readRules()[studyId] ?? DEFAULT_RULES;
}

export function saveRules(studyId: string, text: string): void {
  const store = readRules();
  store[studyId] = text;
  try {
    localStorage.setItem(RULES_KEY, JSON.stringify(store));
  } catch {
    // 저장 실패해도 화면 동작은 막지 않는다
  }
}
