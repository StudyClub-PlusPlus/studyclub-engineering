package com.studyclub.domain.event.registration;

/**
 * 행사 신청 상태 (specs/event-participant/spec.md 「신청 상태」). 유효 인원(자리 차지)은 {@code PENDING} + {@code
 * CONFIRMED}. {@code DECLINED} · {@code CANCELLED} 는 끝 상태라 되살리지 않는다 — 취소한 크루가 다시 신청하면 새 행이 생긴다.
 */
public enum ClubEventRegistrationStatus {
    /** 확인 대기 — 운영진 확인 방식(REVIEW) 행사에 신청. 자리를 차지한다. */
    PENDING,
    /** 참가 확정 — 자동 확정 접수 · 운영진 확정 · 확정 방식 전환. 자리를 차지한다. */
    CONFIRMED,
    /** 참가 불가 — 운영진 처리 · 행사 종료 자동 전환. 자리를 반환하고, 같은 행사에 다시 신청할 수 없다. */
    DECLINED,
    /** 신청 취소 — 이유는 {@link ClubEventRegistrationCancelReason}. 자리를 반환한다. */
    CANCELLED;

    /** 자리를 차지하는 상태인가 — 정원 · 잔여석을 셀 때와 취소할 수 있는 신청을 고를 때 같은 기준이다. */
    public boolean occupiesSeat() {
        return this == PENDING || this == CONFIRMED;
    }
}
