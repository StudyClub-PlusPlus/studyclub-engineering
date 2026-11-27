package com.studyclub.api.ops;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.OptionalInt;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class OpsAlertBundleTest {

    private static final class MutableClock extends Clock {
        Instant now = Instant.parse("2026-12-05T10:00:00Z");

        @Override
        public java.time.ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(java.time.ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    }

    @Test
    @DisplayName("창의 첫 건만 보내고, 창 안의 나머지는 묶어 다음 창 첫 경보에 건수를 더한다. 키가 다르면 따로 센다")
    void bundles() {
        MutableClock clock = new MutableClock();
        OpsAlertBundle bundle = new OpsAlertBundle(Duration.ofMinutes(10), clock);

        assertThat(bundle.record("DECLINED:1", 1)).isEqualTo(OptionalInt.of(1));
        assertThat(bundle.record("DECLINED:1", 1)).isEmpty();
        assertThat(bundle.record("DECLINED:1", 1)).isEmpty();
        assertThat(bundle.record("DECLINED:2", 1)).isEqualTo(OptionalInt.of(1));

        clock.now = clock.now.plus(Duration.ofMinutes(10));
        assertThat(bundle.record("DECLINED:1", 1)).isEqualTo(OptionalInt.of(3));
        assertThat(bundle.record("DECLINED:1", 1)).isEmpty();
    }

    @Test
    @DisplayName("한 번에 여러 건을 건너뛰면 첫 경보가 그 건수를 그대로 싣는다 — 종료 자동 전환 30건")
    void bulkCount() {
        OpsAlertBundle bundle = new OpsAlertBundle(Duration.ofMinutes(10), new MutableClock());

        assertThat(bundle.record("DECLINED:1", 30)).isEqualTo(OptionalInt.of(30));
        assertThat(bundle.record("DECLINED:1", 2)).isEmpty();
    }
}
