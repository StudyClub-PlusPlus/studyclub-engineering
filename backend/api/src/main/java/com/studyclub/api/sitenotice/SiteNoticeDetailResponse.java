package com.studyclub.api.sitenotice;

import com.studyclub.api.sitenotice.SiteNoticeListResponse.Summary;
import java.time.Instant;

/** {@code newer} 가 더 최신(화면의 「다음 공지」), {@code older} 가 더 오래된 공지(「이전 공지」). */
public record SiteNoticeDetailResponse(
        Long noticeId,
        String title,
        String body,
        Instant publishedAt,
        Summary newer,
        Summary older) {}
