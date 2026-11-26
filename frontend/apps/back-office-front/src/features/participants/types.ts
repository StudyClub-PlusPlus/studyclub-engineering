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
  /** 계정 프로필의 IANA 시간대. 온보딩 전이면 null */
  timeZone: string | null;
  /** 이 스터디 신청서의 참여 가능 요일 키(`mon` … `sun`). 신청서가 없으면 빈 배열 */
  availableDays: string[];
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
