package com.studyclub.api.study;

import com.studyclub.common.time.FormattedInstant;
import com.studyclub.common.time.TimeZoneFormatService;
import com.studyclub.domain.study.RecruitStatus;
import com.studyclub.domain.study.RecruitmentTimeZones;
import com.studyclub.domain.study.Study;
import com.studyclub.domain.study.StudyCategory;
import com.studyclub.domain.study.StudyKind;
import com.studyclub.domain.study.StudyPhase;
import com.studyclub.domain.study.StudyStatus;
import java.time.Instant;
import java.util.List;

/**
 * @param displayTimeZone 항목의 {@code *Formatted} 를 만든 시간대 — 프로필 → 기기({@code timeZone} Query) → 서울
 */
public record StudyListResponse(
        List<StudySummary> items, long total, int offset, int limit, String displayTimeZone) {

    public record StudySummary(
            Long studyId,
            String title,
            String oneLineSummary,
            StudyCategory category,
            StudyKind studyKind,
            String thumbnailUrl,
            String schedule,
            RecruitmentTimeZonesView recruitmentTimeZones,
            String recruitmentTimeZoneLabel,
            StudyStatus status,
            StudyPhase phase,
            RecruitStatus recruitStatus,
            boolean canApply,
            Integer capacity,
            long currentApplicants,
            Instant recruitDeadlineAt,
            FormattedInstant recruitDeadlineFormatted,
            Instant startAt,
            FormattedInstant startAtFormatted,
            Instant endAt,
            boolean closingSoon) {
        /** {@code studyKind} 는 프로그램의 값이라 밖에서 받는다 — docs/erd/STUDY_PROGRAM.md. */
        public static StudySummary from(
                Study study,
                StudyKind studyKind,
                long applicantCount,
                Instant recruitDeadlineAt,
                Integer recruitmentCapacity,
                RecruitmentTimeZones recruitmentTimeZones,
                String displayTimeZone,
                Instant now) {
            return new StudySummary(
                    study.getId(),
                    study.getTitle(),
                    study.getOneLineSummary(),
                    study.getCategory(),
                    studyKind,
                    study.getThumbnailUrl(),
                    study.getSchedule(),
                    RecruitmentTimeZonesView.from(recruitmentTimeZones),
                    recruitmentTimeZones.label(),
                    study.getStatus(),
                    study.phase(applicantCount, recruitDeadlineAt, recruitmentCapacity),
                    study.recruitStatus(
                            applicantCount, recruitDeadlineAt, recruitmentCapacity, now),
                    study.canApply(applicantCount, recruitDeadlineAt, recruitmentCapacity, now),
                    recruitmentCapacity,
                    applicantCount,
                    recruitDeadlineAt,
                    TimeZoneFormatService.formatDeadline(recruitDeadlineAt, displayTimeZone, now),
                    study.getStartAt(),
                    TimeZoneFormatService.format(study.getStartAt(), displayTimeZone),
                    study.getEndAt(),
                    study.isClosingSoon(recruitDeadlineAt, now));
        }
    }
}
