package com.studyclub.api.study;

/** 백오피스 스터디 목록 정렬. specs/dashboard/spec.md 4.4절. */
public enum BackofficeStudySort {
    /** 기수 ID 내림차순 (기본). */
    ID_DESC,
    /** 제목·기수 ID 오름차순. */
    TITLE_ASC,
    /**
     * 모집 보드 정렬 — {@code RECRUITING} 먼저, 그다음 {@code RECRUIT_CLOSED}. 마감 시각 오름차순(없으면 마지막), 동률은 제목·기수
     * ID. {@code status=OPEN} 과 함께만 허용.
     */
    RECRUITMENT,
    /** 일반 목록 기본 순서. 모든 상태에서 모집중 먼저, 마감 시각·제목·기수 ID 순. */
    RECRUITMENT_FIRST,
    PROGRAM_ASC,
    PROGRAM_DESC,
    TITLE_DESC,
    STATUS_ASC,
    STATUS_DESC,
    CATEGORY_ASC,
    CATEGORY_DESC,
    TIMEZONE_ASC,
    TIMEZONE_DESC,
    RECRUIT_START_ASC,
    RECRUIT_START_DESC,
    RECRUIT_END_ASC,
    RECRUIT_END_DESC,
    RECRUIT_ASC,
    RECRUIT_DESC,
    APPLICANTS_ASC,
    APPLICANTS_DESC,
    START_AT_ASC,
    START_AT_DESC,
    FORM_ASC,
    FORM_DESC,
    VISIBILITY_ASC,
    VISIBILITY_DESC,
    AUTHOR_ASC,
    AUTHOR_DESC
}
