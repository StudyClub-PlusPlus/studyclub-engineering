package com.studyclub.domain.event;

/** 저장 상태 {@code CLUB_EVENT.STATUS} — 운영자가 바꾸는 값. 화면 칩은 {@link EventDisplayStatus} 를 그린다. */
public enum EventStatus {
    /** 공개, 모집을 받는다. 등록하면 이 값이다 */
    PUBLISHED,
    /** 공개, 운영자가 모집을 마감했다 (재모집하면 PUBLISHED) */
    CLOSED,
    /** 행사 취소. 읽기 전용, 되돌릴 수 없다 */
    CANCELLED
}
