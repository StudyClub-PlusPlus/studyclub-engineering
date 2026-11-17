package com.studyclub.api.event;

import java.util.List;

/**
 * 등록(POST)·수정(PUT) 본문. 두 요청의 필드가 같고 수정에만 {@code version} 이 있다. enum·시각을 문자열로 받는 이유: 형식이 틀리면 Jackson
 * 이 필드 이름 없는 400 을 내는데, 스펙은 실패한 필드 이름을 {@code errorMessage} 에 담으라고 한다 — {@link
 * ClubEventRequestMapper} 가 필드마다 읽는다.
 *
 * <p>{@code version} · {@code capacity} 를 {@link Number} 로 받는 이유: {@code Long}/{@code Integer} 로
 * 받으면 Jackson 이 {@code 0.9} · {@code 10000.9} 를 정수로 잘라 통과시킨다. 전역 설정을 바꾸지 않고 매퍼가 정수 타입인지 직접 본다.
 */
public record AdminClubEventRequest(
        Number version,
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

    public record Offline(Number capacity, String location) {}

    /** {@code url} 은 확정자만 보는 링크 — 로그·오류 메시지에 넣지 않는다. */
    public record Online(Number capacity, String url) {
        @Override
        public String toString() {
            return "Online[capacity=" + capacity + ", url=" + (url == null ? null : "***") + "]";
        }
    }

    public record Question(
            String questionId, String label, String type, Boolean required, List<String> options) {}
}
