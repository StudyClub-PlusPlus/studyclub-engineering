package com.studyclub.api.study;

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
        /** {@code studyKind} 는 프로그램의 값이라 밖에서 받는다 — docs/erd/STUDY_PROGRAM.md. */
        public static StudySummary from(
                Study study,
                StudyKind studyKind,
                long applicantCount,
                Instant recruitDeadlineAt,
                Integer recruitmentCapacity) {
            return new StudySummary(
                    study.getId(),
                    study.getTitle(),
                    study.getOneLineSummary(),
                    study.getCategory(),
                    studyKind,
                    study.getThumbnailUrl(),
                    study.getSchedule(),
                    study.timezone(),
                    study.getStatus(),
                    study.phase(applicantCount, recruitDeadlineAt, recruitmentCapacity),
                    study.recruitStatus(applicantCount, recruitDeadlineAt, recruitmentCapacity),
                    study.getStudyDeliveryFormat(),
                    recruitmentCapacity,
                    applicantCount,
                    recruitDeadlineAt,
                    study.getStartAt(),
                    study.getEndAt(),
                    study.isClosingSoon(recruitDeadlineAt));
        }
    }
}
