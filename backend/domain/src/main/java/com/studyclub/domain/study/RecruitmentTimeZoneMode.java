package com.studyclub.domain.study;

import java.util.Arrays;
import java.util.Optional;

/** 모집 시간대 방식. DB · API 에는 소문자 {@link #code()} 로 쓴다. specs/timezone/spec.md §3.2 */
public enum RecruitmentTimeZoneMode {
    /** 아직 정하지 않았다. {@code ALL} · {@code SELECTED} 로 저절로 바뀌지 않는다. */
    UNSET("unset"),
    /** 전 지역 — 앞으로 생길 지역도 포함. 모든 후보를 체크한 {@code SELECTED} 와 다르다. */
    ALL("all"),
    SELECTED("selected");

    private final String code;

    RecruitmentTimeZoneMode(String code) {
        this.code = code;
    }

    public String code() {
        return code;
    }

    public static Optional<RecruitmentTimeZoneMode> fromCode(String code) {
        return Arrays.stream(values()).filter(mode -> mode.code.equals(code)).findFirst();
    }
}
