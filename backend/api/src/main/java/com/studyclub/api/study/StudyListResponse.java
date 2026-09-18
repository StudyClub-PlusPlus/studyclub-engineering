package com.studyclub.api.study;

import com.studyclub.domain.study.*;
import java.time.Instant;
import java.util.List;

public record StudyListResponse(List<StudySummary> items, long total, int offset, int limit) {

    public record StudySummary(
            Long cohortId,
            StudyStatus status,
            RecruitStatus recruitStatus,
            DeliveryFormat deliveryFormat,
            Integer capacity,
            long currentApplicants,
            Instant recruitDeadline,
            Instant startDate,
            boolean closingSoon) {
        public static StudySummary from(Study study, long applicantCount) {
            return new StudySummary(
                    study.getId(),
                    study.getStatus(),
                    study.recruitStatus(applicantCount),
                    study.getStudyDeliveryFormat(),
                    study.getCapacity(),
                    applicantCount,
                    study.getRecruitDeadline(),
                    study.getStartDate(),
                    study.isClosingSoon());
        }
    }
}
