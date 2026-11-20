package com.studyclub.domain.study;

import java.util.List;

public enum StudyStatus {
    DRAFT,
    OPEN,
    ONGOING,
    ENDED,
    CLOSED;

    /** 운영자가 끝낸 스터디 — {@link Study#isEnded()} 와 같은 목록. 쿼리 조건에 쓴다. */
    public static final List<StudyStatus> ENDED_STATUSES = List.of(ENDED, CLOSED);
}
