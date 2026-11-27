package com.studyclub.domain.event.mail;

/** 운영자가 보내는 행사 메일의 종류. 자동 메일(신청 상태 알림)은 여기 없다. */
public enum ClubEventMailType {
    /** 행사 안내 — 참가 확정자에게. */
    ANNOUNCEMENT,
    /** 행사 취소 안내 — 취소 직전 확인 대기 · 참가 확정이던 신청자에게. */
    CANCELLATION
}
