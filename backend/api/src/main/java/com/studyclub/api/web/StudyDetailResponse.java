package com.studyclub.api.web;

import com.studyclub.domain.study.Study;
import com.studyclub.domain.study.StudyCohort;
import java.time.Instant;

public record StudyDetailResponse(
        Long id,
        String slug,
        String title,
        String description,
        String category,
        String studyKind,
        String thumbnailUrl,
        CohortResponse cohort
) {
    public record CohortResponse(
            Long id,
            String deliveryFormat,
            String status,
            String curriculum,
            Integer capacity,
            Instant recruitDeadline,
            Instant startDate,
            Instant endDate
    ) {
        static CohortResponse from(StudyCohort c) {
            return new CohortResponse(
                    c.getId(),
                    c.getStudyDeliveryFormat().name(),
                    c.getStatus().name(),
                    c.getCurriculum(),
                    c.getCapacity(),
                    c.getRecruitDeadline(),
                    c.getStartDate(),
                    c.getEndDate()
            );
        }
    }

    public static StudyDetailResponse from(Study study, StudyCohort cohort) {
        return new StudyDetailResponse(
                study.getId(),
                study.getSlug(),
                study.getTitle(),
                study.getDescription(),
                study.getCategory().name(),
                study.getStudyKind().name(),
                study.getThumbnailUrl(),
                cohort != null ? CohortResponse.from(cohort) : null
        );
    }
}
