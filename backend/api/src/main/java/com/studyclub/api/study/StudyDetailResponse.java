package com.studyclub.api.study;

import com.studyclub.domain.study.RecruitStatus;
import com.studyclub.domain.study.Study;
import com.studyclub.domain.study.StudyProgram;
import java.time.Instant;

public record StudyDetailResponse(
        Long id,
        Long programId,
        String programTitle,
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
     * {@code studyKind} · {@code programTitle} 은 기수가 아니라 프로그램의 값이다 — docs/erd/STUDY_PROGRAM.md. 콘솔
     * 정보 탭이 「프로그램 제목 · 종류 · 변경할 수 없음」을 읽기 전용으로 보여 주는 데 쓴다.
     */
    public static StudyDetailResponse from(
            Study study, StudyProgram program, long applicantCount, Instant recruitDeadlineAt) {
        return new StudyDetailResponse(
                study.getId(),
                study.getProgramId(),
                program.getTitle(),
                study.getSlug(),
                study.getTitle(),
                study.getOneLineSummary(),
                study.getDescription(),
                study.getCategory().name(),
                program.getStudyKind().name(),
                study.getThumbnailUrl(),
                study.getStudyDeliveryFormat().name(),
                study.getStatus().name(),
                study.recruitStatus(applicantCount, recruitDeadlineAt),
                study.getCurriculum(),
                study.getCapacity(),
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
                programTitle,
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
