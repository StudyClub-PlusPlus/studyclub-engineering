package com.studyclub.api.study;

import com.studyclub.common.time.FormattedInstant;
import com.studyclub.domain.study.RecruitStatus;
import com.studyclub.domain.study.StudyCategory;
import com.studyclub.domain.study.StudyKind;
import com.studyclub.domain.study.StudyStatus;
import java.time.Instant;
import java.util.List;

/**
 * @param displayTimeZone 항목의 {@code *Formatted} 를 만든 시간대 — 헤더(Query) → 저장된 헤더 → 프로필 → 서울
 */
public record BackofficeStudyListResponse(
        List<StudySummary> items, long total, int offset, int limit, String displayTimeZone) {

    public record StudySummary(
            Long studyId,
            Long programId,
            String title,
            StudyStatus status,
            StudyCategory category,
            StudyKind studyKind,
            Integer recruitmentCapacity,
            long currentApplicants,
            RecruitStatus recruitStatus,
            Instant recruitmentStartAt,
            Instant recruitDeadlineAt,
            FormattedInstant recruitDeadlineFormatted,
            Instant startAt,
            FormattedInstant startAtFormatted,
            /** 최신 모집 회차의 값 그대로. 모집 회차가 없으면 {@code unset}. */
            RecruitmentTimeZonesView recruitmentTimeZones,
            String recruitmentTimeZoneLabel,
            boolean hasApplicationForm,
            /**
             * 등록한 캡틴의 닉네임({@code STUDY.CREATED_BY}). 기록이 없으면 {@code null} — 화면은 「—」
             * (captain-list-all-studies 10).
             */
            String authorNickname) {}
}
