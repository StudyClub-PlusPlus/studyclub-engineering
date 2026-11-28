package com.studyclub.api.auth.validation;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

class TimeZoneValidatorTest {

    private final TimeZoneValidator validator = new TimeZoneValidator();

    @ParameterizedTest
    @ValueSource(
            strings = {
                "Asia/Seoul",
                "America/New_York",
                "America/Vancouver",
                "America/Los_Angeles",
                "America/Toronto",
                "Asia/Tokyo",
                "Europe/London",
                "Australia/Sydney",
                "UTC",
                "US/Pacific",
                " Asia/Seoul "
            })
    @DisplayName("지역 이름이 있는 IANA 는 모두 통과한다 — 고정 네 개 목록은 없다. deprecated 링크 · 앞뒤 공백은 저장 때 정본으로 바꾼다")
    void acceptsAnyRegion(String value) {
        assertThat(validator.isValid(value, null)).isTrue();
    }

    @ParameterizedTest
    @ValueSource(
            strings = {
                "+09:00",
                "UTC+09:00",
                "GMT+9",
                "Etc/GMT-9",
                "KST",
                "Not/AZone",
                "asia/seoul"
            })
    @DisplayName("오프셋만 있는 ID · 약칭 · 모르는 ID 는 거절한다 — 서울과 도쿄를 가를 수 없다")
    void rejectsOffsetsAndUnknown(String value) {
        assertThat(validator.isValid(value, null)).isFalse();
    }

    @ParameterizedTest
    @ValueSource(strings = {"America/Abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefgh"})
    @DisplayName("64자를 넘으면 거절한다")
    void rejectsTooLong(String value) {
        assertThat(validator.isValid(value, null)).isFalse();
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {" "})
    @DisplayName("null·빈 값은 통과한다 — 필수 여부는 @NotBlank 가 담당한다")
    void passesBlank(String value) {
        assertThat(validator.isValid(value, null)).isTrue();
    }
}
