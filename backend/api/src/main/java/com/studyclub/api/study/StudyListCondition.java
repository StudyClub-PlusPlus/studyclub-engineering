package com.studyclub.api.study;

import com.studyclub.domain.study.StudyCategory;
import com.studyclub.domain.study.StudyPhase;
import com.studyclub.domain.study.StudyTimezone;
import java.time.Instant;

/** 스터디 목록 필터·정렬 조건. 전부 선택 — {@code null} 이면 그 조건을 걸지 않는다. */
public record StudyListCondition(
        StudyCategory category,
        StudyPhase status,
        StudyTimezone timezone,
        String keyword,
        Instant recruitDeadlineBefore,
        StudyListSort sort) {}
