export interface StudyGroup {
  groupId: number;
  name: string;
  canDelete: boolean;
}

export interface Participant {
  participantId: number;
  accountId: number;
  nickname: string;
  discordNickname: string | null;
  email: string;
  regionGroup: 'KR' | 'NA' | 'ETC' | null;
  groupId: number;
  participantRole: 'LEADER' | 'MEMBER';
  status: 'ACTIVE' | 'PAUSED' | 'WITHDRAWN' | 'COMPLETED';
  captain: boolean;
  joinedAt: string;
}

export interface ParticipantsResponse {
  studyId: number;
  participantCount: number;
  recruitmentCapacity: number | null;
  groups: StudyGroup[];
  participants: Participant[];
}

export interface GroupChange {
  participantId: number;
  groupId: number;
}

export interface GroupAssignmentsResponse {
  participants: Pick<Participant, 'participantId' | 'groupId' | 'participantRole'>[];
}
