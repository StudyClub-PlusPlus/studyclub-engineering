package com.studyclub.domain.account;

import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * 닉네임 형식 규칙 (specs/user-onboarding/spec.md). 온보딩뿐 아니라 마이페이지 닉네임 변경 등 나중에 생길 다른 진입점에서도 같은 규칙을 쓸 수
 * 있도록 순수 도메인 규칙으로 둔다 — 웹 계층 의존 없음. 중복 검사(DB 조회가 필요한 상태 의존 규칙)는 여기 없다 — {@code AccountRepository} 를
 * 쓰는 호출자의 책임이다.
 */
public final class NicknamePolicy {

    public static final int MIN_LENGTH = 2;
    public static final int MAX_LENGTH = 20;

    /** 모든 언어의 글자(\p{L})·숫자(\p{Nd})·밑줄만 허용. 공백·줄바꿈·그 외 특수문자는 막힌다. */
    private static final Pattern ALLOWED_CHARS = Pattern.compile("^[\\p{L}\\p{Nd}_]+$");

    private static final Pattern ONLY_UNDERSCORES = Pattern.compile("^_+$");

    /** 공식 계정으로 오해할 수 있는 이름 — 완전 일치, 대소문자 무시. */
    private static final Set<String> RESERVED_NAMES = Set.of("운영진", "관리자", "admin");

    private static final String RESERVED_PREFIX = "account_";

    private NicknamePolicy() {}

    /** 검증 전 trim — "trim 후 2~20자" 규칙이 length 판정보다 먼저 적용되어야 한다. */
    public static String normalize(String raw) {
        return raw == null ? null : raw.trim();
    }

    /** 형식이 유효하면 {@code null}, 아니면 사용자에게 보여줄 위반 사유. 호출 전 {@link #normalize} 를 거친 값을 넘긴다. */
    public static String violation(String normalized) {
        if (normalized == null || normalized.isEmpty()) {
            return "닉네임은 필수입니다";
        }
        if (normalized.length() < MIN_LENGTH || normalized.length() > MAX_LENGTH) {
            return "2~20자여야 합니다";
        }
        if (!ALLOWED_CHARS.matcher(normalized).matches()) {
            return "글자·숫자·밑줄(_)만 사용할 수 있습니다";
        }
        if (ONLY_UNDERSCORES.matcher(normalized).matches()) {
            return "밑줄만으로 구성할 수 없습니다";
        }
        String lower = normalized.toLowerCase(Locale.ROOT);
        if (RESERVED_NAMES.contains(lower) || lower.startsWith(RESERVED_PREFIX)) {
            return "사용할 수 없는 닉네임입니다";
        }
        return null;
    }

    public static boolean isValid(String normalized) {
        return violation(normalized) == null;
    }
}
