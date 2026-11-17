package com.studyclub.api.feedback;

import java.util.List;

/** 내 문의 목록 (specs/feedback/spec.md). 접수 시각 내림차순 고정. */
public record MyFeedbackListResponse(
        List<MyFeedbackItem> items, long total, int offset, int limit) {}
