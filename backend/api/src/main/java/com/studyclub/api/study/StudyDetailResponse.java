package com.studyclub.api.study;

import com.studyclub.domain.study.RecruitStatus;
import com.studyclub.domain.study.Study;
import java.time.Instant;

public record StudyDetailResponse(
        Long id,
        Long programId,
        String slug,
        String title,
        String oneLineSummary,
        String description,
        String category,
        String studyKind,
        String thumbnailUrl,
        String deliveryFormat,
        String status,
        RecruitStatus recruitStatus,
        String curriculum,
        Integer capacity,
        String schedule,
        Instant recruitDeadlineAt,
        Instant startAt,
        Instant endAt,
        String discordChannelUrl,
        String driveUrl) {

    /**
     * {@code recruitDeadlineAt} · {@code recruitmentCapacity} 는 최근 모집 회차(STUDY_RECRUITMENT)의 값이다 —
     * 정원은 STUDY 가 아니라 모집 회차가 갖는다(docs/erd/STUDY.md). 응답 필드 이름은 {@code capacity} 로 둔다 — 프론트가 읽는 이름이라
     * 바꾸면 깨진다.
     */
    public static StudyDetailResponse from(
            Study study,
            long applicantCount,
            Instant recruitDeadlineAt,
            Integer recruitmentCapacity) {
        return new StudyDetailResponse(
                study.getId(),
                study.getProgramId(),
                study.getSlug(),
                study.getTitle(),
                study.getOneLineSummary(),
                study.getDescription(),
                study.getCategory().name(),
                study.getStudyKind().name(),
                study.getThumbnailUrl(),
                study.getStudyDeliveryFormat().name(),
                study.getStatus().name(),
                study.recruitStatus(applicantCount, recruitDeadlineAt, recruitmentCapacity),
                study.getCurriculum(),
                recruitmentCapacity,
                study.getSchedule(),
                recruitDeadlineAt,
                study.getStartAt(),
                study.getEndAt(),
                study.getDiscordChannelUrl(),
                study.getDriveUrl());
    }

    /** 디스코드 채널·자료실 링크를 비운 사본 — 볼 권한이 없는 사람에게 준다. */
    public StudyDetailResponse withoutPrivateLinks() {
        return new StudyDetailResponse(
                id,
                programId,
                slug,
                title,
                oneLineSummary,
                description,
                category,
                studyKind,
                thumbnailUrl,
                deliveryFormat,
                status,
                recruitStatus,
                curriculum,
                capacity,
                schedule,
                recruitDeadlineAt,
                startAt,
                endAt,
                null,
                null);
    }
}
