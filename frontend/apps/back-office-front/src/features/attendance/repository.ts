import { apiAttendanceSchema, emptyResponseSchema } from '@/features/attendance/response-schema';
import { http, qs } from '@/lib/http';

// 출석 탭의 서버 호출 — 백오피스 출석 명부 조회 · 저장 (specs/attendance/spec.md 「출석 명부 조회」 · 「출석 생성/수정 (upsert)」).
// 출석부 모양으로 바꾸는 것 · 캐시는 `api.ts` 가 한다.
//
// 둘 다 반 ID(`studyGroupId`)를 받는다. 반 ID 는 참여 명단의 `groups[].groupId` 다.

export type ApiAttendanceStatus = 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED';

export type ApiAttendance = {
  study: {
    id: number;
    title: string;
    participantCount: number;
    totalMeetings: number;
    avgAttendanceRate: number | null;
  };
  meetings: { id: number; scheduledAt: string }[];
  participants: {
    participantId: number;
    displayName: string;
    participantRole: string;
    captain: boolean;
    /** ACTIVE · PAUSED · COMPLETED · WITHDRAWN · DELETED. 뒤 둘은 `includeWithdrawn=true` 일 때만 온다. */
    participantStatus: string;
    /** 떠난 시각(UTC). 이 뒤 회차 칸은 「—」. */
    leftAt: string | null;
    /** null = 미입력. */
    attendances: { meetingId: number; status: ApiAttendanceStatus | null }[];
    attendanceRate: number | null;
  }[];
};

export type AttendanceUpdate = { meetingId: number; participantId: number; status: ApiAttendanceStatus };

export type AttendanceSavePayload = {
  studyGroupId: number;
  /** 바뀐 칸만. 같은 (회차, 참가자) 쌍이 두 번이면 400. 상태는 필수라 칸을 비우지는 못한다. */
  updates: AttendanceUpdate[];
  /** 참여를 중단할 명부 행 ID. 둘 다 비면 400. */
  withdrawals: number[];
};

const BASE = (studyId: number) => `/api/admin/studies/${studyId}/attendances`;

const attendanceRepository = {
  /** 반 출석 명부. `includeWithdrawn` 이면 참여를 중단한 사람(WITHDRAWN · DELETED)까지 — 출석부 맨 아래 흐린 줄. */
  fetchBook(studyId: number, studyGroupId: number, signal?: AbortSignal) {
    return http(`${BASE(studyId)}${qs({ studyGroupId, includeWithdrawn: 'true' })}`, apiAttendanceSchema, { signal });
  },
  /**
   * 출석과 참여 중단을 **한 요청 · 한 트랜잭션**으로. 204.
   * 다른 반의 회차 · 참가자가 섞이면 400. 출석만 고치는 건 캡틴 누구나, `withdrawals` 는 **담당 캡틴만**(아니면 403).
   * 서버는 네비게이터 중단도 받지만, 화면은 네비게이터를 막는다 — 신청자 탭에서 권한을 회수한 뒤 중단한다.
   */
  save(studyId: number, payload: AttendanceSavePayload) {
    return http(BASE(studyId), emptyResponseSchema, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },
};

export default attendanceRepository;
