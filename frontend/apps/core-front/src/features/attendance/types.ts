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
    /** status null = 미체크 (specs/attendance) */
    attendances: Array<{ meetingId: number; status: string | null }>;
    attendanceRate: number | null;
  }>;
};
