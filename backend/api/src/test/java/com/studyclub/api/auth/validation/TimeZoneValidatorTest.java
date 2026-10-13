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
                "America/Los_Angeles"
            })
    @DisplayName("화면 드롭다운의 넷은 통과한다 — 온보딩·프로필 수정이 같은 목록을 쓴다")
    void acceptsListedZones(String value) {
        assertThat(validator.isValid(value, null)).isTrue();
    }

    @ParameterizedTest
    @ValueSource(strings = {"Asia/Tokyo", "Europe/London", "UTC", "Not/AZone", "asia/seoul"})
    @DisplayName("존재하는 IANA ID 라도 목록에 없으면 거절한다 — 반 편성이 이 값으로 갈린다")
    void rejectsUnlistedZones(String value) {
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
