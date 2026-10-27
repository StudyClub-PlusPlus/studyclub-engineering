// 백오피스 문의·오류 신고 타입. 응답 모양은 specs/feedback/spec.md 「운영 목록」 · 「운영 상세」 와 1:1 이다.
//
// 값은 DB enum 그대로(`QUESTION`·`NEW` …) 받는다. 화면 이름(문의·미확인 …)으로 바꾸는 일은 labels.ts 한 곳에서 한다.

export type FeedbackType = 'QUESTION' | 'IDEA' | 'BUG';

export type FeedbackStatus = 'NEW' | 'SEEN' | 'DONE';

/** 닉네임이 null 이면 그 계정이 탈퇴했다 — 화면 「탈퇴한 사용자」. */
export type ApiFeedbackPerson = { nickname: string | null };

export type ApiAdminFeedback = {
  id: number;
  /** 접수 시각. UTC ISO 8601. */
  createdAt: string;
  type: FeedbackType;
  title: string;
  /** 제출자. 늘 있다(로그인해야 보낸다). */
  submitter: ApiFeedbackPerson;
  status: FeedbackStatus;
  /** 완료 처리자(첫 회신을 보낸 캡틴). 완료가 아니면 null — 화면 「-」. */
  doneBy: ApiFeedbackPerson | null;
};

export type ApiAdminFeedbackPage = {
  items: ApiAdminFeedback[];
  /** 걸러진 뒤 전체 수 — 「총 n건」. 지금 페이지의 행 수가 아니다. */
  total: number;
  offset: number;
  limit: number;
};

export type ApiAdminFeedbackDetail = ApiAdminFeedback & {
  /**
   * 상태 드롭다운에서 지금 고를 수 있는 값. 서버 판정(`Feedback.selectableStatuses()`)이다 —
   * 회신 전 `["NEW","SEEN"]`, 회신 뒤 `[]`. 화면은 이 값으로만 막고 푼다(회신 유무로 다시 판정하지 않는다).
   */
  selectableStatuses: FeedbackStatus[];
  /** 평문. HTML 로 해석하지 않는다. */
  content: string;
  /** 없으면 `[]` — 화면은 칸을 두지 않는다. */
  images: { url: string }[];
  /** 「Chrome 141 · macOS」. 모르면 null. */
  browser: string | null;
  viewport: { width: number; height: number } | null;
  /** 회신 전이면 null. `repliedAt` 은 처음 보낸 시각(수정해도 그대로). */
  reply: { content: string; repliedAt: string } | null;
  /** 캡틴 전용 메모. 없으면 null. */
  adminMemo: string | null;
};

/** PATCH 본문 — 셋 중 하나만 싣는다. 메모를 지우려면 `adminMemo: ""`. */
export type FeedbackPatch = { status: FeedbackStatus } | { reply: string } | { adminMemo: string };

/** 목록 조건. 비우면 그 조건을 걸지 않는다. 쿼리 키에 그대로 들어간다. */
export type FeedbackFilter = {
  type?: FeedbackType;
  status?: FeedbackStatus;
  q?: string;
  offset: number;
  limit: number;
};

/** 화면은 20건 고정(스펙). */
export const FEEDBACK_PAGE_SIZE = 20;

/** 회신 글자 수 — 앞뒤 공백을 자른 뒤(스펙). */
export const REPLY_MIN = 10;
export const REPLY_MAX = 2000;

/** 캡틴 전용 메모 최대 글자 수(스펙). */
export const MEMO_MAX = 2000;

/** 검색어 최대 글자 수(스펙 `q` 100자). */
export const SEARCH_MAX = 100;
