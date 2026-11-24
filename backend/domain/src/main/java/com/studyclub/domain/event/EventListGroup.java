package com.studyclub.domain.event;

/** 사이트 목록의 탭 — 예정된 행사 · 지난 행사 (specs/event-registration 「표시 상태와 목록 묶음」). 선언 순서가 응답 순서다. */
public enum EventListGroup {
    /** 모집 중 · 정원 마감 · 모집 마감. 시작이 가까운 순. */
    UPCOMING,
    /** 종료 · 행사 취소. 최근 순. */
    PAST
}
