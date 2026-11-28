package com.studyclub.domain.study;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class RecruitmentTimeZonesTest {

    @Test
    @DisplayName("selected: 정본 IANA 로 바꿔 저장한다")
    void selectedNormalizes() {
        RecruitmentTimeZones zones =
                RecruitmentTimeZones.of("selected", List.of("ROK", "US/Pacific"));

        assertThat(zones.mode()).isEqualTo(RecruitmentTimeZoneMode.SELECTED);
        assertThat(zones.zones()).containsExactly("Asia/Seoul", "America/Los_Angeles");
    }

    @Test
    @DisplayName("selected 는 1개 이상, 중복 없이, 유효한 지역만")
    void selectedRules() {
        assertInvalid(() -> RecruitmentTimeZones.of("selected", List.of()));
        assertInvalid(() -> RecruitmentTimeZones.of("selected", null));
        assertInvalid(() -> RecruitmentTimeZones.of("selected", List.of("Asia/Seoul", "ROK")));
        assertInvalid(() -> RecruitmentTimeZones.of("selected", List.of("+09:00")));
        assertInvalid(() -> RecruitmentTimeZones.of("selected", Arrays.asList("Asia/Seoul", null)));
    }

    @Test
    @DisplayName("unset · all 은 빈 목록만, 모르는 mode 는 400")
    void otherModes() {
        assertThat(RecruitmentTimeZones.of("all", null).zones()).isEmpty();
        assertThat(RecruitmentTimeZones.of("unset", List.of()).mode())
                .isEqualTo(RecruitmentTimeZoneMode.UNSET);
        assertInvalid(() -> RecruitmentTimeZones.of("all", List.of("Asia/Seoul")));
        assertInvalid(() -> RecruitmentTimeZones.of("both", List.of()));
        assertInvalid(() -> RecruitmentTimeZones.of(null, List.of()));
    }

    @Test
    @DisplayName("필터: 한국 + LA 는 두 지역 모두에 맞고, all · unset 은 어느 지역에도 맞는다")
    void matches() {
        RecruitmentTimeZones koreaAndLa =
                RecruitmentTimeZones.of("selected", List.of("Asia/Seoul", "America/Los_Angeles"));

        assertThat(koreaAndLa.matches("Asia/Seoul")).isTrue();
        assertThat(koreaAndLa.matches("America/Los_Angeles")).isTrue();
        assertThat(koreaAndLa.matches("America/Toronto")).isFalse();
        assertThat(RecruitmentTimeZones.of("all", null).matches("America/Toronto")).isTrue();
        assertThat(RecruitmentTimeZones.UNSET.matches("America/Toronto")).isTrue();
    }

    @Test
    @DisplayName("라벨: 미정 · 모든 시간대 · 짧은 이름을 표시 순서로 / 로 잇는다")
    void label() {
        assertThat(RecruitmentTimeZones.UNSET.label()).isEqualTo("미정");
        assertThat(RecruitmentTimeZones.of("all", null).label()).isEqualTo("모든 시간대에서 모집");
        assertThat(
                        RecruitmentTimeZones.of(
                                        "selected", List.of("America/Los_Angeles", "Asia/Seoul"))
                                .label())
                .isEqualTo("한국 / 미국 · LA");
    }

    private static void assertInvalid(Runnable action) {
        assertThatThrownBy(action::run)
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).errorCode())
                .isEqualTo(ErrorCode.INVALID_INPUT);
    }
}
