package com.studyclub.common.privacy;

/**
 * 이메일 마스킹 — {@code h***@gmail.com}. 앞 1자 + {@code ***} + {@code @} 이후 (security-guide.md 의 마스킹 기준).
 *
 * <p>가린 모양이 화면마다 다르면 같은 사람이 다른 사람처럼 보인다. 목록·알림처럼 이메일을 가려 내보내는 곳은 모두 이 한 곳을 쓴다.
 */
public final class EmailMasking {

    /** 가릴 수 없는 값(null·{@code @} 없음·로컬파트 없음)에 주는 값 — 원본의 일부도 드러내지 않는다. */
    private static final String FULLY_MASKED = "***";

    private EmailMasking() {}

    public static String mask(String email) {
        if (email == null) {
            return FULLY_MASKED;
        }
        int at = email.indexOf('@');
        // @ 가 없거나 맨 앞이면 로컬파트가 없어 앞 1자를 보여 줄 근거도 없다
        if (at < 1) {
            return FULLY_MASKED;
        }
        return email.charAt(0) + "***" + email.substring(at);
    }
}
