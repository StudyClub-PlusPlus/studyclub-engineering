package com.studyclub.api.study;

import com.studyclub.domain.study.StudyCategory;
import com.studyclub.domain.study.StudyPhase;
import java.time.Instant;

/**
 * 공개 스터디 목록 조건. 각 값이 {@code null} 이면 그 조건을 걸지 않는다.
 *
 * @param recruitmentZone 정본 IANA 하나. {@code selected} 에 있거나 {@code all} · {@code unset} 이면 통과
 */
public record StudyListFilter(
        StudyCategory category,
        StudyPhase phase,
        String recruitmentZone,
        String keyword,
        Instant recruitDeadlineBefore) {}
