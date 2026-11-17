package com.studyclub.api.event;

import java.util.List;

/**
 * 등록(POST)·수정(PUT) 본문. 두 요청의 필드가 같고 수정에만 {@code version} 이 있다. enum·시각을 문자열로 받는 이유: 형식이 틀리면 Jackson
 * 이 필드 이름 없는 400 을 내는데, 스펙은 실패한 필드 이름을 {@code errorMessage} 에 담으라고 한다 — {@link
 * ClubEventRequestMapper} 가 필드마다 읽는다.
 */
public record AdminClubEventRequest(
        Long version,
        String title,
        String summary,
        String description,
        String timeZone,
        String startsAt,
        String endsAt,
        String deadlineAt,
        String format,
        Offline offline,
        Online online,
        String confirmation,
        List<Question> questions) {

    public record Offline(Integer capacity, String location) {}

    /** {@code url} 은 확정자만 보는 링크 — 로그·오류 메시지에 넣지 않는다. */
    public record Online(Integer capacity, String url) {
        @Override
        public String toString() {
            return "Online[capacity=" + capacity + ", url=" + (url == null ? null : "***") + "]";
        }
    }

    public record Question(
            String questionId, String label, String type, Boolean required, List<String> options) {}
}
