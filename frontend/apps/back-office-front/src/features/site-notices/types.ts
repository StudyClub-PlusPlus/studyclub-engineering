// 백오피스 사이트 공지 타입. 응답 모양은 specs/site-notice/spec.md 와 1:1 이다.
// 반 공지(StudyNotice)와는 다른 기능이라 이름을 `SiteNotice` 로 가른다.

export type ApiSiteNotice = {
  noticeId: number;
  title: string;
  /** 등록한 캡틴의 닉네임. 계정이 탈퇴해 없으면 서버가 「탈퇴한 회원」을 준다. */
  author: string;
  /** 게시 시각 = 등록 시각. 예약 게시가 없다. */
  publishedAt: string;
  /** 마지막 수정. 등록만 했으면 publishedAt 과 같다. */
  updatedAt: string;
};

/** 편집 팝업을 채우는 한 건 — 목록 행에는 본문이 없다. */
export type ApiSiteNoticeDetail = ApiSiteNotice & { body: string };

export type ApiSiteNoticePage = {
  items: ApiSiteNotice[];
  /** 검색을 건 뒤 수 — 지금 페이지의 행 수가 아니다. */
  total: number;
  offset: number;
  limit: number;
};

/** 정렬 열 — 화면의 열 이름 그대로 서버에 보낸다. */
export type SiteNoticeSort = 'publishedAt' | 'title' | 'updatedAt';
export type SiteNoticeOrder = 'asc' | 'desc';

export const SITE_NOTICE_SORTS: readonly SiteNoticeSort[] = ['publishedAt', 'title', 'updatedAt'];
export const SITE_NOTICE_ORDERS: readonly SiteNoticeOrder[] = ['asc', 'desc'];

export const SITE_NOTICE_PAGE_SIZE = 20;

/** 목록 조건. 비우면 그 조건을 걸지 않는다. 쿼리 키에 그대로 들어간다. */
export type SiteNoticeFilter = {
  q?: string;
  sort: SiteNoticeSort;
  order: SiteNoticeOrder;
  offset: number;
  limit: number;
};

export type SiteNoticePayload = { title: string; body: string };
