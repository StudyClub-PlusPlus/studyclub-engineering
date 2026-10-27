// 일정 탭의 서버 호출 (specs/study-meeting/spec.md). 화면 모양으로 바꾸는 것 · 캐시는 `api.ts` 가 한다.
//
// 모두 백오피스 API(`/api/admin/studies/{studyId}/groups/{groupId}/...`) — 캡틴이면 어느 스터디의 어느 반이든.
// 회차 쓰기 · 규칙은 사이트 API(`/api/studies/...`)와 같은 서버 규칙이고 권한만 다르다 (스펙 「백오피스 회차 쓰기 · 규칙」).
//
// 반 ID(`groupId`)는 참여 명단(`GET /api/admin/studies/{id}/participants`)의 `groups[].groupId` 다.
import { httpClient } from '@/lib/httpClient';

export type ApiPresenter = { participantId: number; name: string; active?: boolean };

export type ApiMeeting = {
  id: number;
  type: 'KICKOFF' | 'REGULAR';
  /** 킥오프 0, 정규 회차는 일정순으로 1부터 — 서버가 센다. */
  number: number;
  scheduledAt: string;
  title: string | null;
  presenter1: ApiPresenter | null;
  presenter2: ApiPresenter | null;
  started: boolean;
};

/** 사이트 `GET /api/studies/{id}/meetings` 와 같은 응답. 백오피스는 `me` 가 늘 `{ participantId: null, canEdit: true }`. */
export type ApiGroupMeetings = {
  studyGroup: {
    id: number;
    name: string;
    /** IANA. 비어 있으면 서버가 `Asia/Seoul` 로 채운다. */
    timezone: string;
    startTime: string | null;
    navigatorName: string | null;
    rules: string | null;
  };
  me: { participantId: number | null; canEdit: boolean };
  /** 발표자 후보 — 그 반 활성 참여자, 이름순. */
  participants: { participantId: number; name: string }[];
  meetings: ApiMeeting[];
};

/** 반은 경로로 보낸다. */
export type MeetingCreatePayload = {
  /** 반복은 화면이 날짜로 펼쳐 보낸다(결정 8). UTC ISO. */
  scheduledAts: string[];
  title: string | null;
};

/** 시각 · 제목은 늘 보낸다. 발표자 칸은 **키가 없으면 그대로, null 이면 비운다.** */
export type MeetingUpdatePayload = {
  scheduledAt: string;
  title: string | null;
  presenter1ParticipantId?: number | null;
  presenter2ParticipantId?: number | null;
};

const adminGroup = (studyId: number, groupId: number) => `/api/admin/studies/${studyId}/groups/${groupId}`;

const scheduleRepository = {
  /** 반 회차 목록 — 킥오프 · 제목 · 발표자 · 규칙 포함. 다른 스터디의 반이면 404. */
  fetchMeetings(studyId: number, groupId: number, signal?: AbortSignal) {
    return httpClient.get<ApiGroupMeetings>(`${adminGroup(studyId, groupId)}/meetings`, { signal });
  },
  /**
   * 킥오프를 정하거나 옮긴다 — 없으면 만들고 있으면 시각만 바꾼다. 204.
   * 1회차 날이나 그 뒤면 400, 다른 회차와 같은 날이면 409 `MEETING_DATE_CONFLICT` — 둘 다 화면(`validateKickoff`)이 먼저 막는다.
   */
  setKickoff(studyId: number, groupId: number, scheduledAt: string) {
    return httpClient.put<null>(`${adminGroup(studyId, groupId)}/kickoff`, { scheduledAt });
  },
  /** 회차 추가 — 한 번 · 반복. 킥오프는 만들지 않는다. 같은 날이면 409 `MEETING_DATE_CONFLICT`, 지난 시각이면 400. 204. */
  createMeetings(studyId: number, groupId: number, payload: MeetingCreatePayload) {
    return httpClient.post<null>(`${adminGroup(studyId, groupId)}/meetings`, payload);
  },
  /** 회차 하나 수정. 시작한 회차는 409 `MEETING_ALREADY_STARTED`, 킥오프는 403, 이 반의 회차가 아니면 404. 204. */
  updateMeeting(studyId: number, groupId: number, meetingId: number, payload: MeetingUpdatePayload) {
    return httpClient.put<null>(`${adminGroup(studyId, groupId)}/meetings/${meetingId}`, payload);
  },
  /** 회차 일괄 삭제 — 전부 지우거나 하나도 안 지운다. 시작했거나 킥오프가 섞이면 409. 그 회차의 출석 · 휴가도 지운다. 204. */
  deleteMeetings(studyId: number, groupId: number, meetingIds: number[]) {
    return httpClient.delete<null>(`${adminGroup(studyId, groupId)}/meetings`, { data: { meetingIds } });
  },
  /** 스터디 규칙 — 500자까지, null 이면 지운다. 읽기는 회차 목록의 `studyGroup.rules`. 204. */
  saveRules(studyId: number, groupId: number, rules: string | null) {
    return httpClient.put<null>(`${adminGroup(studyId, groupId)}/rules`, { rules });
  },
};

export default scheduleRepository;
