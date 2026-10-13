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
    RECRUITMENT
}
