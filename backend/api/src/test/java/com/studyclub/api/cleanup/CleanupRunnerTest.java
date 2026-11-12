package com.studyclub.api.cleanup;

import static org.assertj.core.api.Assertions.assertThat;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class CleanupRunnerTest {
    @Test
    @DisplayName("0건 성공도 시각을 남기며 실패·저장소 미설정은 성공 시각을 덮어쓰지 않는다")
    void metricsDistinguishEmptySuccessFailureAndSkipped() {
        SimpleMeterRegistry registry = new SimpleMeterRegistry();
        CleanupRunner runner = new CleanupRunner(registry);
        runner.register("audit", true);
        assertThat(registry.get("cleanup.last.success.seconds").gauge().value()).isZero();
        runner.run("audit", () -> CleanupResult.completed(0, 0));
        double successAt = registry.get("cleanup.last.success.seconds").gauge().value();
        assertThat(successAt).isPositive();
        runner.run("audit", () -> new CleanupResult(2, 1, 4, false));
        runner.run(
                "audit",
                () -> {
                    throw new IllegalStateException("test");
                });
        runner.run("audit", CleanupResult::unavailable);
        assertThat(registry.get("cleanup.last.success.seconds").gauge().value())
                .isEqualTo(successAt);
        assertThat(registry.get("cleanup.deleted").counter().count()).isEqualTo(2);
        assertThat(registry.get("cleanup.failures").counter().count()).isEqualTo(2);
        assertThat(registry.get("cleanup.runs").tag("outcome", "failed").counter().count())
                .isEqualTo(2);
    }
}
