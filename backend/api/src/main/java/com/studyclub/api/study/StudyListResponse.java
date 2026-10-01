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
        /**
         * {@code recruitDeadlineAt} · {@code recruitmentCapacity} 는 최근 모집 회차의 값이다 — 정원은 모집 회차
         * 소관(docs/erd/STUDY.md). 응답 필드 이름은 프론트가 읽는 {@code capacity} 를 유지한다.
         */
        public static StudySummary from(
                Study study,
                long applicantCount,
                Instant recruitDeadlineAt,
                Integer recruitmentCapacity) {
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
                    study.phase(),
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
