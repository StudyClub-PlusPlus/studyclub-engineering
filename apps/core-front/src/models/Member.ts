// Member(멤버) 도메인 모델.
import type { L10n } from "./common";

export type Member = {
  id: string;
  name: L10n;
  headline: L10n;
  track?: string;
  studies?: string[]; // Study.id[]
  cohort?: string;
  links?: Record<string, string>;
  order?: number;
};

/** 특정 스터디에 참여 중인 멤버인지. */
export function isInStudy(member: Member, studyId: string): boolean {
  return member.studies?.includes(studyId) ?? false;
}

export function byMemberOrder(a: Member, b: Member): number {
  return (a.order ?? 999) - (b.order ?? 999);
}
