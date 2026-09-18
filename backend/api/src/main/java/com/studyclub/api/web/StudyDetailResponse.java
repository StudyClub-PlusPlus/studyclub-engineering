package com.studyclub.api.web;

import com.studyclub.domain.study.RecruitStatus;
import com.studyclub.domain.study.Study;
import com.studyclub.domain.study.StudyProgram;
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

    public static StudyDetailResponse from(
            StudyProgram studyProgram, Study study, long applicantCount) {
        return new StudyDetailResponse(
                studyProgram.getId(),
                studyProgram.getSlug(),
                studyProgram.getTitle(),
                studyProgram.getDescription(),
                studyProgram.getCategory().name(),
                studyProgram.getStudyKind().name(),
                studyProgram.getThumbnailUrl(),
                study != null ? study.getStudyDeliveryFormat().name() : null,
                study != null ? study.getStatus().name() : null,
                study != null ? study.recruitStatus(applicantCount) : null,
                study != null ? study.getCurriculum() : null,
                study != null ? study.getCapacity() : null,
                study != null ? study.getRecruitDeadline() : null,
                study != null ? study.getStartDate() : null,
                study != null ? study.getEndDate() : null);
    }
}
