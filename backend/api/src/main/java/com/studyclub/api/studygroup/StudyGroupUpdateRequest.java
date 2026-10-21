package com.studyclub.api.studygroup;

import jakarta.validation.constraints.NotBlank;

/**
 * 반 수정 요청. 지금은 제목만 받는다 — 스터디 시간(요일 · 시각 · 시간대)은 {@code DAYS_OF_WEEK} 마이그레이션 뒤에 붙인다. 길이(20자)는
 * 도메인({@code StudyGroup#changeName})이 본다.
 */
public record StudyGroupUpdateRequest(@NotBlank String name) {}
