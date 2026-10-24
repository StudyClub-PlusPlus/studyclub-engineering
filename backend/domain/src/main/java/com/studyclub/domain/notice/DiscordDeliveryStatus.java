package com.studyclub.domain.notice;

/** 스터디 공지의 디스코드 결과. 메일 결과는 여기 두지 않고 NOTIFICATION 행에서 센다 (specs/study-notice/spec.md). */
public enum DiscordDeliveryStatus {
    /** 디스코드를 고르지 않았다. */
    NOT_REQUESTED,
    /** 골랐고 아직 보내지 않았다 — 커밋 직후부터 비동기 호출이 끝나기 전까지. */
    PENDING,
    /** 봇이 글을 올렸다. */
    SENT,
    /** 우리가 보내지 못해 건너뛰었다. 사유는 {@link DiscordSkipReason}. */
    SKIPPED,
    /** 봇을 불렀으나 거절당했거나 응답이 없었다. 자동 재시도는 없다 — 봇이 중복을 막지 않는다. */
    FAILED
}
