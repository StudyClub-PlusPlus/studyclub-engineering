package com.studyclub.api.study;

import com.studyclub.common.time.FormattedInstant;
import com.studyclub.common.time.TimeZoneFormatService;
import com.studyclub.domain.study.RecruitStatus;
import com.studyclub.domain.study.RecruitmentTimeZones;
import com.studyclub.domain.study.Study;
import com.studyclub.domain.study.StudyProgram;
import java.time.Instant;

public record StudyDetailResponse(
        Long id,
        Long programId,
        String programTitle,
        String title,
        String oneLineSummary,
        String description,
        String category,
        String studyKind,
        String thumbnailUrl,
        String status,
        RecruitStatus recruitStatus,
        boolean canApply,
        String curriculum,
        Integer capacity,
        String schedule,
        RecruitmentTimeZonesView recruitmentTimeZones,
        String recruitmentTimeZoneLabel,
        String displayTimeZone,
        Instant recruitDeadlineAt,
        FormattedInstant recruitDeadlineFormatted,
        Instant startAt,
        FormattedInstant startAtFormatted,
        Instant endAt,
        String discordChannelUrl,
        String driveUrl,
        boolean discordLinked) {

    /**
     * {@code recruitmentTimeZones} 는 최신 모집 회차의 값 그대로다. {@code *Formatted} 는 {@code displayTimeZone}
     * 으로 서버가 포맷한 시각이다 (specs/timezone/spec.md §3.3).
     *
     * <p>{@code studyKind} · {@code programTitle} 은 기수가 아니라 프로그램의 값이다 — docs/erd/STUDY_PROGRAM.md.
     * 콘솔 정보 탭이 「프로그램 제목 · 종류 · 변경할 수 없음」을 읽기 전용으로 보여 주는 데 쓴다.
     */
    public static StudyDetailResponse from(
            Study study,
            StudyProgram program,
            long applicantCount,
            Instant recruitDeadlineAt,
            Integer recruitmentCapacity,
            RecruitmentTimeZones recruitmentTimeZones,
            boolean discordLinked,
            String displayTimeZone,
            Instant now) {
        return new StudyDetailResponse(
                study.getId(),
                study.getProgramId(),
                program.getTitle(),
                study.getTitle(),
                study.getOneLineSummary(),
                study.getDescription(),
                study.getCategory().name(),
                program.getStudyKind().name(),
                study.getThumbnailUrl(),
                study.getStatus().name(),
                study.recruitStatus(applicantCount, recruitDeadlineAt, recruitmentCapacity, now),
                study.canApply(applicantCount, recruitDeadlineAt, recruitmentCapacity, now),
                study.getCurriculum(),
                recruitmentCapacity,
                study.getSchedule(),
                RecruitmentTimeZonesView.from(recruitmentTimeZones),
                recruitmentTimeZones.label(),
                displayTimeZone,
                recruitDeadlineAt,
                TimeZoneFormatService.formatDeadline(recruitDeadlineAt, displayTimeZone, now),
                study.getStartAt(),
                TimeZoneFormatService.format(study.getStartAt(), displayTimeZone),
                study.getEndAt(),
                study.getDiscordChannelUrl(),
                study.getDriveUrl(),
                discordLinked);
    }

    /** 디스코드 채널·자료실 링크를 비운 사본 — 볼 권한이 없는 사람에게 준다. */
    public StudyDetailResponse withoutPrivateLinks() {
        return new StudyDetailResponse(
                id,
                programId,
                programTitle,
                title,
                oneLineSummary,
                description,
                category,
                studyKind,
                thumbnailUrl,
                status,
                recruitStatus,
                canApply,
                curriculum,
                capacity,
                schedule,
                recruitmentTimeZones,
                recruitmentTimeZoneLabel,
                displayTimeZone,
                recruitDeadlineAt,
                recruitDeadlineFormatted,
                startAt,
                startAtFormatted,
                endAt,
                null,
                null,
                discordLinked);
    }
}
