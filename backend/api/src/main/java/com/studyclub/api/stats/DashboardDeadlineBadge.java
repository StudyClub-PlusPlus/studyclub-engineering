package com.studyclub.api.stats;

/** 모집 보드 마감 표시 코드. specs/dashboard/spec.md 4.3절. 서버는 {@code TODAY} 를 반환하지 않는다. */
public enum DashboardDeadlineBadge {
    DEADLINE_PASSED,
    CAPACITY_FULL,
    DEADLINE_MISSING,
    CLOSING_SOON,
    NORMAL
}
