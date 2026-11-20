package com.studyclub.api.analytics;

import static org.assertj.core.api.Assertions.*;

import org.junit.jupiter.api.*;

class AnalyticsIdentityTest {
    private static final String TEST_KEY = "analytics-test-key-not-for-production-0123456789";

    @Test
    @DisplayName("같은 회원·키·환경은 같은 ID, 다른 회원·환경은 다른 ID다")
    void deterministicAndScoped() {
        var identity = new AnalyticsIdentity(TEST_KEY, "v1", "stage");
        assertThat(identity.forAccount(42L))
                .matches("v1_[0-9a-f]{64}")
                .isEqualTo(identity.forAccount(42L))
                .isNotEqualTo(identity.forAccount(43L));
        assertThat(identity.forAccount(42L))
                .isNotEqualTo(new AnalyticsIdentity(TEST_KEY, "v1", "production").forAccount(42L));
        assertThat(AnalyticsIdentity.serverClientId(identity.forAccount(42L)))
                .matches("[0-9]{1,20}\\.[0-9]{1,20}");
    }

    @Test
    @DisplayName("미설정은 비활성화하고 짧은 키는 거부한다 — 원문 ID로 대체하지 않는다")
    void missingOrWeakKey() {
        assertThat(new AnalyticsIdentity("", "v1", "stage").configured()).isFalse();
        assertThatThrownBy(() -> new AnalyticsIdentity("short", "v1", "stage"))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
