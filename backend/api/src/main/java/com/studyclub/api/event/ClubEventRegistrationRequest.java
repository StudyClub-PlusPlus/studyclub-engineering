package com.studyclub.api.event;

import java.util.List;
import java.util.Map;

/**
 * 신청 제출 본문 (specs/event-registration 「신청 제출」). 닉네임 · 이메일 · 시간대는 받지 않는다 — 서버가 계정에서 읽는다.
 *
 * @param channel {@code ONLINE} · {@code OFFLINE}
 * @param questionVersion 상세에서 받은 질문 지문
 * @param answers 질문 키 → 답 문자열 배열. 답할 것이 없으면 {@code {}}
 */
public record ClubEventRegistrationRequest(
        String channel, String questionVersion, Map<String, List<String>> answers) {}
