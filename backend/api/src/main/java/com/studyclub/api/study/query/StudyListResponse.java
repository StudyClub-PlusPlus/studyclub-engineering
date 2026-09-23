package com.studyclub.api.study.query;

import com.studyclub.domain.study.DeliveryFormat;
import com.studyclub.domain.study.RecruitStatus;
import com.studyclub.domain.study.Study;
import com.studyclub.domain.study.StudyCategory;
import com.studyclub.domain.study.StudyKind;
import com.studyclub.domain.study.StudyPhase;
import com.studyclub.domain.study.StudyStatus;
import com.studyclub.domain.study.StudyTimezone;
import java.time.Instant;
import java.util.List;

public record StudyListResponse(List<StudySummary> items, long total, int offset, int limit) {

    public record StudySummary(
            Long studyId,
            String slug,
            String title,
            String oneLineSummary,
            StudyCategory category,
            StudyKind studyKind,
            String thumbnailUrl,
            String schedule,
            StudyTimezone timezone,
            StudyStatus status,
            StudyPhase phase,
            RecruitStatus recruitStatus,
            DeliveryFormat deliveryFormat,
            Integer capacity,
            long currentApplicants,
            Instant recruitDeadlineAt,
            Instant startAt,
            Instant endAt,
            boolean closingSoon) {
        public static StudySummary from(
                Study study, long applicantCount, Instant recruitDeadlineAt) {
            return new StudySummary(
                    study.getId(),
                    study.getSlug(),
                    study.getTitle(),
                    study.getOneLineSummary(),
                    study.getCategory(),
                    study.getStudyKind(),
                    study.getThumbnailUrl(),
                    study.getSchedule(),
                    study.timezone(),
                    study.getStatus(),
                    study.phase(applicantCount, recruitDeadlineAt),
                    study.recruitStatus(applicantCount, recruitDeadlineAt),
                    study.getStudyDeliveryFormat(),
                    study.getCapacity(),
                    applicantCount,
                    recruitDeadlineAt,
                    study.getStartAt(),
                    study.getEndAt(),
                    study.isClosingSoon(recruitDeadlineAt));
        }
    }
}
