export interface StudyGroup {
  groupId: number;
  name: string;
  isDefault: boolean;
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

/** 담당 캡틴 — 스터디당 한 명. 명부와 상관없다. */
export interface OwnerCaptain {
  accountId: number;
  nickname: string;
}

export interface ParticipantsResponse {
  studyId: number;
  participantCount: number;
  recruitmentCapacity: number | null;
  ownerCaptain: OwnerCaptain | null;
  groups: StudyGroup[];
  participants: Participant[];
}

export interface GroupChange {
  participantId: number;
  groupId?: number;
  participantRole?: Participant['participantRole'];
}

export interface GroupAssignmentsResponse {
  participants: Pick<Participant, 'participantId' | 'groupId' | 'participantRole'>[];
}
