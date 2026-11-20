package com.studyclub.domain.study;

import java.util.List;

public enum StudyStatus {
    DRAFT,
    OPEN,
    ONGOING,
    ENDED,
    CLOSED;

    /** 운영자가 끝낸 상태값 — 날짜 경과는 빠져 있다. 끝났는지 판정은 {@link Study#isEnded(java.time.Instant)}. */
    public static final List<StudyStatus> ENDED_STATUSES = List.of(ENDED, CLOSED);
}
