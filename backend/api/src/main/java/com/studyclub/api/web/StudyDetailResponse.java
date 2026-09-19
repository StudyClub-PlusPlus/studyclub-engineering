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
        Instant recruitDeadline,
        Instant startDate,
        Instant endDate) {

    public static StudyDetailResponse from(Study study, long applicantCount) {
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
                study.recruitStatus(applicantCount),
                study.getCurriculum(),
                study.getCapacity(),
                study.getRecruitDeadline(),
                study.getStartDate(),
                study.getEndDate());
    }
}
