package com.studyclub.api.sitenotice;

import java.time.Instant;
import java.util.List;

public record AdminSiteNoticeListResponse(List<Summary> items, long total, int offset, int limit) {

    /** 목록 행에는 본문을 싣지 않는다 — 편집 팝업이 열릴 때 한 건 조회로 받는다. */
    public record Summary(
            Long noticeId, String title, String author, Instant publishedAt, Instant updatedAt) {}
}
