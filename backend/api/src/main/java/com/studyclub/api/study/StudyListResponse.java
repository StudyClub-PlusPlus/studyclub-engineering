package com.studyclub.api.study;

import com.studyclub.domain.study.DeliveryFormat;
import com.studyclub.domain.study.Study;
import com.studyclub.domain.study.StudyCategory;
import com.studyclub.domain.study.StudyCohort;
import com.studyclub.domain.study.StudyCohortStatus;
import java.time.Instant;
import java.util.List;

/** 페이지네이션 목록 응답 — endpoint-convention.md: { items, total, offset, limit }. */
public record StudyListResponse(
        List<StudySummary> items,
        long total,
        int offset,
        int limit
) {

    public record StudySummary(
            Long studyId,
            String slug,
            String title,
            StudyCategory category,
            String thumbnailUrl,
            String studyKind,
            CohortSummary cohort
    ) {
        public static StudySummary from(Study study, StudyCohort cohort, long applicantCount) {
            return new StudySummary(
                    study.getId(),
                    study.getSlug(),
                    study.getTitle(),
                    study.getCategory(),
                    study.getThumbnailUrl(),
                    study.getStudyKind().name(),
                    CohortSummary.from(cohort, applicantCount)
            );
        }
    }

    public record CohortSummary(
            Long cohortId,
            StudyCohortStatus status,
            DeliveryFormat deliveryFormat,
            Integer capacity,
            long currentApplicants,
            Instant recruitDeadline,
            Instant startDate,
            boolean closingSoon
    ) {
        public static CohortSummary from(StudyCohort cohort, long applicantCount) {
            return new CohortSummary(
                    cohort.getId(),
                    cohort.getStatus(),
                    cohort.getStudyDeliveryFormat(),
                    cohort.getCapacity(),
                    applicantCount,
                    cohort.getRecruitDeadline(),
                    cohort.getStartDate(),
                    cohort.isClosingSoon()
            );
        }
    }
}
