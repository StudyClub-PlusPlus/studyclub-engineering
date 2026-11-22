package com.studyclub.domain.analytics;

import static org.assertj.core.api.Assertions.*;

import java.time.Instant;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class AnalyticsPrivacyTest {
    @Test
    @DisplayName("저장된 ID는 바뀌지 않고 중단은 되돌리지 않는다")
    void identityAndOptOut() {
        var p = new AccountAnalytics(42L);
        p.assignIdentity("old");
        p.assignIdentity("new");
        assertThat(p.getAnalyticsUserId()).isEqualTo("old");
        Instant now = Instant.now();
        assertThat(p.optOut(now)).isTrue();
        assertThat(p.optOut(now.plusSeconds(5))).isFalse();
        p.assignIdentity("new");
        p.rememberClientId("123.456");
        assertThat(p.isEnabled()).isFalse();
        assertThat(p.clientIds()).isEmpty();
        assertThat(p.isDeletionReady(now.plusSeconds(89))).isFalse();
        assertThat(p.isDeletionReady(now.plusSeconds(90))).isTrue();
    }

    @Test
    @DisplayName("브라우저 식별자는 중복·잘못된 값·무한 증가를 허용하지 않는다")
    void boundedClients() {
        var p = new AccountAnalytics(42L);
        p.assignIdentity("protected");
        assertThatThrownBy(() -> p.rememberClientId("bad"))
                .isInstanceOf(IllegalArgumentException.class);
        for (int i = 0; i < 128; i++) {
            p.rememberClientId(i + ".123");
            p.rememberClientId(i + ".123");
        }
        assertThat(p.clientIds()).hasSize(128);
        assertThatThrownBy(() -> p.rememberClientId("999.123"))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    @DisplayName("GA 접수와 Amplitude 완료 후 식별자를 비워도 중단은 유지된다")
    void releaseIdentifiers() {
        var p = new AccountAnalytics(42L);
        p.assignIdentity("protected");
        p.rememberClientId("123.456");
        p.optOut(Instant.now());
        p.ga4Requested();
        assertThatThrownBy(p::clearIdentifiersAfterDeletion)
                .isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(p::amplitudeCompleted).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> p.amplitudeRequested("[]", Instant.now()))
                .isInstanceOf(IllegalArgumentException.class);
        p.amplitudeRequested("[123]", Instant.now());
        p.amplitudeCompleted();
        p.clearIdentifiersAfterDeletion();
        assertThat(p.getGa4DeletionStatus()).isEqualTo(AnalyticsDeletionStatus.REQUESTED);
        assertThat(p.getAnalyticsUserId()).isNull();
        assertThat(p.clientIds()).isEmpty();
        assertThat(p.getAmplitudeDeletionIds()).isNull();
        assertThat(p.getOptedOutAt()).isNotNull();
        p.assignIdentity("new");
        assertThat(p.isEnabled()).isFalse();
    }

    @Test
    @DisplayName("대상 없음은 첫 확인 후 24시간이 지나 다시 확인될 때만 완료한다")
    void confirmAbsence() {
        var p = new AccountAnalytics(42L);
        Instant now = Instant.parse("2026-11-10T00:00:00Z");
        p.assignIdentity("protected");
        p.optOut(now);
        p.amplitudeNotFound(now);
        p.amplitudeNotFound(now.plusSeconds(86399));
        assertThat(p.getAmplitudeDeletionRequestedAt()).isEqualTo(now);
        assertThat(p.getAmplitudeDeletionStatus()).isEqualTo(AnalyticsDeletionStatus.NOT_REQUESTED);
        p.amplitudeNotFound(now.plusSeconds(86400));
        assertThat(p.getAmplitudeDeletionStatus()).isEqualTo(AnalyticsDeletionStatus.DONE);
        assertThat(p.canReleaseIdentifiers()).isFalse();
        p.ga4Requested();
        p.clearIdentifiersAfterDeletion();
        assertThat(p.getAnalyticsUserId()).isNull();
        assertThat(p.getAmplitudeDeletionRequestedAt()).isNull();
    }

    @Test
    @DisplayName("대상 없음 뒤 실제 삭제가 접수되면 새 요청 시각을 쓰고 완료 확인을 기다린다")
    void dataArrivesAfterAbsentResponse() {
        var p = new AccountAnalytics(42L);
        Instant now = Instant.parse("2026-11-10T00:00:00Z");
        p.assignIdentity("protected");
        p.optOut(now);
        p.amplitudeNotFound(now);
        p.amplitudeRequested("[123]", now.plusSeconds(86400));
        p.amplitudeNotFound(now.plusSeconds(172800));
        assertThat(p.getAmplitudeDeletionStatus()).isEqualTo(AnalyticsDeletionStatus.REQUESTED);
        assertThat(p.getAmplitudeDeletionRequestedAt()).isEqualTo(now.plusSeconds(86400));
        assertThat(p.getAmplitudeDeletionIds()).isEqualTo("[123]");
    }

    @Test
    @DisplayName("식별자를 만든 적이 없는 회원은 외부 삭제를 요청할 필요가 없다")
    void neverCollected() {
        var p = new AccountAnalytics(42L);
        p.optOut(Instant.now());
        assertThat(p.canReleaseIdentifiers()).isTrue();
    }
}
