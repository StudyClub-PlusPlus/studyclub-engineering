/** 목록 한 건. 상세의 이웃(newer·older)도 같은 모양이다. */
export type ApiSiteNoticeSummary = { noticeId: number; title: string; publishedAt: string };

/** `newer` 는 더 최신(화면의 「다음 공지」), `older` 는 더 오래된 공지(「이전 공지」). 끝이면 null. */
export type ApiSiteNoticeDetail = ApiSiteNoticeSummary & {
  body: string;
  newer: ApiSiteNoticeSummary | null;
  older: ApiSiteNoticeSummary | null;
};
