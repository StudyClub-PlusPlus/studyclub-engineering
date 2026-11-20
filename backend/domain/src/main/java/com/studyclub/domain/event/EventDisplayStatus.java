package com.studyclub.domain.event;

/**
 * 표시 상태 — 저장 상태 + 서버 시각 + 인원으로 {@link ClubEvent#displayStatus} 가 계산한다. 선언 순서가 우선순위다: 행사 취소 > 종료 >
 * 모집 마감 > 정원 마감 > 모집 중 (specs/event/spec.md Q3).
 */
public enum EventDisplayStatus {
    CANCELLED,
    ENDED,
    RECRUITMENT_CLOSED,
    FULL,
    RECRUITING
}
