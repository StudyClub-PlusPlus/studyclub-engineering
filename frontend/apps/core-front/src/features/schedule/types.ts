export type ApiMeetingList = {
  study: { id: number; title: string; discordChannelUrl: string | null; driveUrl: string | null };
  studyGroup: {
    id: number;
    name: string;
    timezone: string;
    startTime: string | null;
    navigatorName: string | null;
    rules: string | null;
  };
  me: { participantId: number | null; canEdit: boolean };
  /** 실제 API `ParticipantView` 는 participantId · name 뿐. 아래 셋은 아직 내리지 않는다 — 참여 중단은 출석 응답으로 안다 */
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
