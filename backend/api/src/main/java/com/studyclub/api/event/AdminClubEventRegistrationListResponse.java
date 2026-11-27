package com.studyclub.api.event;

import java.util.List;

/** 참가자 목록 한 페이지 — 페이지 envelope 에 행사 단위 판정 두 개를 더한다. */
public record AdminClubEventRegistrationListResponse(
        boolean canManageRegistrations,
        int pendingCount,
        List<AdminClubEventRegistrationItemResponse> items,
        long total,
        int offset,
        int limit) {}
