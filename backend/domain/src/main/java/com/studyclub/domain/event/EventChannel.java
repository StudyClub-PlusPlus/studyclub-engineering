package com.studyclub.domain.event;

import java.util.Locale;

/** 참여 방식 한 가지. 선언 순서가 응답 순서다 — 운영 상세 {@code seats} 는 ONLINE, OFFLINE 순 (specs/event/spec.md §5). */
public enum EventChannel {
    ONLINE,
    OFFLINE;

    /** 실패 메시지의 필드 이름 — 요청 본문의 {@code online} · {@code offline} 객체. */
    public String fieldName() {
        return name().toLowerCase(Locale.ROOT);
    }
}
