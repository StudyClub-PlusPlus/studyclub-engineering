package com.studyclub.api.study;

import com.studyclub.domain.study.StudyCategory;
import com.studyclub.domain.study.StudyKind;
import com.studyclub.domain.study.StudyStatus;
import com.studyclub.domain.study.StudyTimezone;
import java.time.Instant;
import java.util.List;

public record BackofficeStudyListResponse(
        List<StudySummary> items, long total, int offset, int limit) {

    public record StudySummary(
            Long studyId,
            String title,
            StudyStatus status,
            StudyCategory category,
            StudyKind studyKind,
            Integer recruitmentCapacity,
            long currentApplicants,
            Instant recruitmentStartAt,
            Instant recruitDeadlineAt,
            Instant startAt,
            StudyTimezone timezone,
            boolean hasApplicationForm) {}
}
