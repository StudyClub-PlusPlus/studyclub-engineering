package com.studyclub.api.study;

import com.studyclub.domain.study.DeliveryFormat;
import com.studyclub.domain.study.RecruitStatus;
import com.studyclub.domain.study.Study;
import com.studyclub.domain.study.StudyStatus;
import java.time.Instant;
import java.util.List;

public record StudyListResponse(List<StudySummary> items, long total, int offset, int limit) {

    public record StudySummary(
            Long studyId,
            StudyStatus status,
            RecruitStatus recruitStatus,
            DeliveryFormat deliveryFormat,
            Integer capacity,
            long currentApplicants,
            Instant recruitDeadlineAt,
            Instant startAt,
            boolean closingSoon) {
        public static StudySummary from(
                Study study, long applicantCount, Instant recruitDeadlineAt) {
            return new StudySummary(
                    study.getId(),
                    study.getStatus(),
                    study.recruitStatus(applicantCount, recruitDeadlineAt),
                    study.getStudyDeliveryFormat(),
                    study.getCapacity(),
                    applicantCount,
                    recruitDeadlineAt,
                    study.getStartAt(),
                    study.isClosingSoon(recruitDeadlineAt));
        }
    }
}
