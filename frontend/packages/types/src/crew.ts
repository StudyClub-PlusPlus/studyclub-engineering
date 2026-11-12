import type { MemberRegion } from './community';

/** 출석 상태. 값이 없으면 미체크. */
export type AttendanceStatus = "present" | "late" | "absent" | "excused";

export type Crew = {
  id: string;
  name: string;
  email: string;
  region: MemberRegion;
  appliedAt: string;
  /** 지난 스터디 참여 횟수 */
  pastStudies: number;
  /** 지난 스터디 완주율(%). 참여 이력이 없으면 undefined — 0% 로 표기하면 성실하지 않은 사람으로 오독된다. */
  completionRate?: number;
  /** 일정 미정 스터디에서 고른 가능 시간 */
  cells?: string[];
  motivation?: string;
  /** 신청 폼 추가 질문(`Study.applicationForm`)에 대한 답변. questionId → 답. 체크박스는 배열. */
  answers?: Record<string, string | string[]>;
  /**
   * 신청 시 받은 디스코드 서버 별명. 모든 신청서에 항상 있는 기본 질문의 답이라, 신청
   * 결과 화면에서는 계정 실명 대신 이걸로 응답자를 가리킨다 (`ApplicationFormTab` 참고).
   */
  discordNickname: string;
};

/** 회차. ERD `STUDY_MEETING`. 영어는 meeting (로그인 SESSION과 구분). */
export type StudyMeeting = {
  id: string;
  no: number;
  /** 예정일 (ERD STUDY_MEETING.SCHEDULED_AT 의 날짜). 실제 시작·종료는 반장이 열 때. */
  date: string; // yyyy-mm-dd
};

export type StudyCrewData = {
  capacity: number;
  crew: Crew[];
  meetings: StudyMeeting[];
  /** crewId → meetingId → 상태. 값이 없으면 아직 체크하지 않은 것. */
  attendance: Record<string, Record<string, AttendanceStatus>>;
};

/**
 * 프로토 크루 화면의 나와의 관계. `joined.ts` lifeStatus 와 같은 스터디 id 를 쓴다.
 * - upcoming  : 시작전 — 회차는 전부 미래, 출석 칸은 비움
 * - active    : 참여중 — 지난 회차만 채움
 * - completed : 완주 — 회차는 전부 과거, 칸을 다 채움
 * - left      : 참여 중단 — 지난 회차만 채움, 완주 아님
 */
export type DemoCrewRelation = "upcoming" | "active" | "completed" | "left";
