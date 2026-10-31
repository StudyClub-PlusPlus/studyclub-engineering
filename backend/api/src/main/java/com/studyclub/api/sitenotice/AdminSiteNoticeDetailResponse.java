package com.studyclub.api.sitenotice;

import java.time.Instant;

public record AdminSiteNoticeDetailResponse(
        Long noticeId,
        String title,
        String body,
        String author,
        Instant publishedAt,
        Instant updatedAt) {}
