import { http } from './http';

export type ApiMeetingList = {
  study: { id: number; title: string; discordChannelUrl: string | null; driveUrl: string | null };
  studyGroup: {
    id: number;
    name: string;
    timezone: string;
    startTime: string;
    navigatorName: string | null;
    rules: string | null;
  };
  me: { participantId: number | null; canEdit: boolean; captain?: boolean };
  participants: Array<{
    participantId: number;
    name: string;
    discordNickname?: string | null;
    left?: boolean;
    active?: boolean;
  }>;
  meetings: Array<{
    id: number;
    type: string;
    number: number;
    scheduledAt: string;
    title: string | null;
    presenter1: { participantId: number; name: string; active: boolean } | null;
    presenter2: { participantId: number; name: string; active: boolean } | null;
    started: boolean;
  }>;
};

export type ApiAttendance = {
  study: {
    id: number;
    title: string;
    participantCount: number;
    totalMeetings: number;
    avgAttendanceRate: number | null;
  };
  meetings: Array<{ id: number; scheduledAt: string }>;
  participants: Array<{
    participantId: number;
    displayName: string;
    /** 스터디클럽 디스코드 서버 별명 (10-18 D6). 회원 탈퇴면 null. 서버가 아직 안 내리면 없다. */
    discordNickname?: string | null;
    participantRole: string;
    captain: boolean;
    participantStatus: string;
    leftAt: string | null;
    attendances: Array<{ meetingId: number; status: string }>;
    attendanceRate: number | null;
  }>;
};

export function getStudyMeetings(studyId: number, studyGroupId?: number) {
  const qs = studyGroupId != null ? `?studyGroupId=${studyGroupId}` : '';
  return http<ApiMeetingList>(`/api/studies/${studyId}/meetings${qs}`);
}

export function createStudyMeetings(
  studyId: number,
  body: { studyGroupId: number; scheduledAts: string[]; title?: string },
) {
  return http<void>(`/api/studies/${studyId}/meetings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function updateStudyMeeting(
  studyId: number,
  meetingId: number,
  body: {
    scheduledAt: string;
    title?: string;
    presenter1ParticipantId?: number | null;
    presenter2ParticipantId?: number | null;
  },
) {
  return http<void>(`/api/studies/${studyId}/meetings/${meetingId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function deleteStudyMeeting(studyId: number, meetingId: number) {
  return http<void>(`/api/studies/${studyId}/meetings/${meetingId}`, { method: 'DELETE' });
}

export function getStudyAttendance(studyId: number, studyGroupId: number) {
  return http<ApiAttendance>(`/api/me/studies/${studyId}/attendances?studyGroupId=${studyGroupId}&includeWithdrawn=true`);
}

export function saveStudyAttendance(
  studyId: number,
  body: {
    studyGroupId: number;
    updates: Array<{ meetingId: number; participantId: number; status: string }>;
    withdrawals?: number[];
  },
) {
  return http<void>(`/api/me/studies/${studyId}/attendances`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function saveStudyRules(studyId: number, groupId: number, rules: string) {
  return http<void>(`/api/studies/${studyId}/groups/${groupId}/rules`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rules }),
  });
}

export function registerPresenter(studyId: number, meetingId: number, slot: 1 | 2) {
  return http<void>(`/api/studies/${studyId}/meetings/${meetingId}/presenters/${slot}/me`, { method: 'PUT' });
}

export function unregisterPresenter(studyId: number, meetingId: number, slot: 1 | 2) {
  return http<void>(`/api/studies/${studyId}/meetings/${meetingId}/presenters/${slot}/me`, { method: 'DELETE' });
}
