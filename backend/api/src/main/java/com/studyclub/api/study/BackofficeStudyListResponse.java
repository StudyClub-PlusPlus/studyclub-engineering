package com.studyclub.api.study;

import com.studyclub.domain.study.RecruitStatus;
import com.studyclub.domain.study.StudyCategory;
import com.studyclub.domain.study.StudyKind;
import com.studyclub.domain.study.StudyStatus;
import com.studyclub.domain.study.StudyTimezone;
import java.time.Instant;
import java.util.List;

public record BackofficeStudyListResponse(
        List<StudySummary> items, long total, int offset, int limit) {

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
            Instant startAt,
            /**
             * 운영자가 고른 값 그대로 — {@code null} 이면 미정. 일정 문구로 추정하지 않는다 (captain-list-all-studies 2-3).
             */
            StudyTimezone timezone,
            boolean hasApplicationForm,
            /**
             * 등록한 캡틴의 닉네임({@code STUDY.CREATED_BY}). 기록이 없으면 {@code null} — 화면은 「—」
             * (captain-list-all-studies 10).
             */
            String authorNickname) {}
}
