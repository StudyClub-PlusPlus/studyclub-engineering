package com.studyclub.api.web;

import com.studyclub.domain.study.RecruitStatus;
import com.studyclub.domain.study.Study;
import java.time.Instant;

public record StudyDetailResponse(
        Long id,
        String slug,
        String title,
        String description,
        String category,
        String studyKind,
        String thumbnailUrl,
        String deliveryFormat,
        String status,
        RecruitStatus recruitStatus,
        String curriculum,
        Integer capacity,
        Instant recruitDeadlineAt,
        Instant startAt,
        Instant endAt) {

    public static StudyDetailResponse from(
            Study study, long applicantCount, Instant recruitDeadlineAt) {
        return new StudyDetailResponse(
                study.getId(),
                study.getSlug(),
                study.getTitle(),
                study.getDescription(),
                study.getCategory().name(),
                study.getStudyKind().name(),
                study.getThumbnailUrl(),
                study.getStudyDeliveryFormat().name(),
                study.getStatus().name(),
                study.recruitStatus(applicantCount, recruitDeadlineAt),
                study.getCurriculum(),
                study.getCapacity(),
                recruitDeadlineAt,
                study.getStartAt(),
                study.getEndAt());
    }
}
