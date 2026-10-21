package com.studyclub.api.auth.validation;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
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
    @ValueSource(
            strings = {
                "Asia/Tokyo",
                "Europe/London",
                "UTC",
                "Not/AZone",
                "asia/seoul",
                " Asia/Seoul",
                "Asia/Seoul "
            })
    @DisplayName("존재하는 IANA ID 라도 목록에 없으면 거절한다 — 대소문자·앞뒤 공백도 고치지 않고 그대로 비교한다")
    void rejectsUnlistedZones(String value) {
        assertThat(validator.isValid(value, null)).isFalse();
    }

    @Test
    @DisplayName("허용 목록은 정확히 넷이다 — 화면의 ONBOARDING_ZONES 와 글자 단위로 같아야 하므로 늘거나 줄면 여기서 잡는다")
    void allowedListIsExactlyTheFourOnScreen() {
        assertThat(TimeZoneValidator.ALLOWED)
                .containsExactlyInAnyOrder(
                        "Asia/Seoul",
                        "America/New_York",
                        "America/Vancouver",
                        "America/Los_Angeles");
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {" "})
    @DisplayName("null·빈 값은 통과한다 — 필수 여부는 @NotBlank 가 담당한다")
    void passesBlank(String value) {
        assertThat(validator.isValid(value, null)).isTrue();
    }
}
