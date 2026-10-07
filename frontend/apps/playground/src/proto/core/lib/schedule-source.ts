'use client';

import { meetingWindow, meetingsOf } from '@core/lib/attendance';
import {
  addMeetings,
  deleteMeetings,
  patchMeeting,
  withAdded,
  zonedInstant,
  type MeetingPatch,
  type ProtoMeeting,
} from '@core/lib/meetings';
import { participantsOf, type Participant } from '@core/lib/schedule-board';
import type { Study, StudyMeeting } from '@studyclub/mock';

/**
 * 일정 표가 읽고 쓰는 곳. 표 모양은 하나이고, **어느 반의 회차인가**만 다르다.
 *
 * - 사용자 사이트: 내 분반 하나 — 스터디 단위로 저장한다 (`studySource`)
 * - 백오피스: 캡틴이 반을 골라 그 반의 회차를 본다 — 반마다 저장 키를 따로 둔다 (`classSource`)
 *
 * TODO(api): 둘 다 /api/studies/{id}/groups/{groupId}/meetings 로 간다. 저장 키 = groupId.
 */
export type ScheduleSource = {
  /** 킥오프를 맨 앞에, 정규 회차는 일정순. 저장소가 localStorage 라 부를 때마다 다시 읽는다. */
  meetings: () => ProtoMeeting[];
  /** 예정 시작 순간(UTC). 시작한 회차인지 가르는 기준이다. */
  startOf: (m: StudyMeeting) => Date;
  /** 발표자로 고를 수 있는 그 반 참가자. */
  people: Participant[];
  add: (input: { dates: string[]; time: string; title?: string }) => void;
  patch: (id: string, patch: MeetingPatch) => void;
  remove: (id: string) => void;
};

/** 사용자 사이트 — 내 분반. 시간대는 분반 시간대. */
export function studySource(study: Study, timeZone: string): ScheduleSource {
  return {
    meetings: () => meetingsOf(study),
    startOf: (m) => meetingWindow(study, m).start,
    people: participantsOf(study),
    add: (input) => addMeetings(study.id, { ...input, timeZone }),
    patch: (id, patch) => patchMeeting(study.id, id, patch, timeZone),
    remove: (id) => deleteMeetings(study.id, [id]),
  };
}

/**
 * 백오피스 — 캡틴이 고른 반.
 *
 * `key` 는 반의 저장 키, `base` 는 반을 만들 때 진행 일정이 깐 회차다.
 * 처음부터 있던 반은 스터디 키를 그대로 써서 사용자 사이트의 그 분반 일정과 같은 회차를 본다.
 */
export function classSource({
  key,
  base,
  timeZone,
  time,
  people,
}: {
  key: string;
  base: StudyMeeting[];
  timeZone: string;
  /** 시각이 없는 회차(진행 일정이 깐 회차)의 시작 시각 — 반의 정규 시각. */
  time: string;
  people: Participant[];
}): ScheduleSource {
  return {
    meetings: () => withAdded(base, key, timeZone),
    startOf: (m) => {
      const p = m as ProtoMeeting;
      return p.scheduledAt ? new Date(p.scheduledAt) : zonedInstant(m.date, p.time ?? time, timeZone);
    },
    people,
    add: (input) => addMeetings(key, { ...input, timeZone }),
    patch: (id, patch) => patchMeeting(key, id, patch, timeZone),
    remove: (id) => deleteMeetings(key, [id]),
  };
}
