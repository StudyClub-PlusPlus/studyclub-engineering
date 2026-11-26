package com.studyclub.common.validation;

import java.util.regex.Pattern;

/**
 * 이메일 형식 검사 — 화면(프로토 {@code transition} APPLY)과 같은 식 {@code ^[^\s@]+@[^\s@]+\.[^\s@]+$}. 주소가 실제로
 * 있는지는 보지 않는다. 로그인 제공자가 확인한 이메일만 계정이 되므로 실제로 걸리는 일은 드물다 (specs/event-registration 「신청할 수 있나」 6).
 */
public final class EmailFormat {

    private static final Pattern EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");

    private EmailFormat() {}

    /** 비었거나 형식이 틀리면 false. */
    public static boolean isValid(String email) {
        return email != null && EMAIL.matcher(email).matches();
    }
}
