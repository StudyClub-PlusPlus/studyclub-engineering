package com.studyclub.api.study;

/**
 * 백오피스 공개 여부 필터. {@code PUBLIC} = {@code STATUS != DRAFT}, {@code PRIVATE} = {@code STATUS =
 * DRAFT}. specs/dashboard/spec.md 4.4절.
 */
public enum StudyVisibility {
    PUBLIC,
    PRIVATE
}
