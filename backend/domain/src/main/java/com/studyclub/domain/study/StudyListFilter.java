package com.studyclub.domain.study;

import java.time.Instant;

/** 공개 스터디 목록 조건. 각 값이 {@code null} 이면 그 조건을 걸지 않는다. */
public record StudyListFilter(
        StudyCategory category,
        StudyPhase phase,
        StudyTimezone timezone,
        String keyword,
        Instant recruitDeadlineBefore) {}
