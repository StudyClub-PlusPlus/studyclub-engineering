package com.studyclub.domain.event;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;

/**
 * 현재 신청 질문 목록의 지문 — 질문을 표시 순서로 {@code [questionId, label, type, required, options]} 배열로 만든 정규 JSON
 * 의 SHA-256 16진수 (specs/event-registration 「신청 질문과 질문 버전」). 저장하지 않고 요청마다 계산한다. 질문과 상관없는 수정(제목 ·
 * 일정)으로는 바뀌지 않는다.
 */
final class QuestionVersion {

    private QuestionVersion() {}

    static String of(List<ClubEventQuestion> questions) {
        StringBuilder json = new StringBuilder("[");
        for (int i = 0; i < questions.size(); i++) {
            ClubEventQuestion question = questions.get(i);
            if (i > 0) {
                json.append(',');
            }
            json.append('[');
            string(json, question.getQuestionKey()).append(',');
            string(json, question.getLabel()).append(',');
            string(json, question.getType().name()).append(',');
            json.append(question.isRequired()).append(",[");
            List<String> options = question.getOptions();
            for (int j = 0; j < options.size(); j++) {
                if (j > 0) {
                    json.append(',');
                }
                string(json, options.get(j));
            }
            json.append("]]");
        }
        return sha256(json.append(']').toString());
    }

    // JSON 문자열 — 따옴표 · 역슬래시 · 제어 문자만 이스케이프한다. 같은 질문이면 언제나 같은 글이 나온다
    private static StringBuilder string(StringBuilder out, String value) {
        out.append('"');
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            if (c == '"' || c == '\\') {
                out.append('\\').append(c);
            } else if (c < 0x20) {
                out.append(String.format("\\u%04x", (int) c));
            } else {
                out.append(c);
            }
        }
        return out.append('"');
    }

    private static String sha256(String text) {
        try {
            byte[] digest =
                    MessageDigest.getInstance("SHA-256")
                            .digest(text.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 을 쓸 수 없습니다.", e);
        }
    }
}
