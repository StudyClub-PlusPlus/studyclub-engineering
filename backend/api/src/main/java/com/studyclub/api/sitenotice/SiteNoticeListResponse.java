package com.studyclub.api.sitenotice;

import java.time.Instant;
import java.util.List;

public record SiteNoticeListResponse(List<Summary> items, long total, int offset, int limit) {

    /** 제목·게시일만 — 본문·작성자는 사이트에 주지 않는다. 상세의 이웃(newer·older)도 이 모양이다. */
    public record Summary(Long noticeId, String title, Instant publishedAt) {}
}
