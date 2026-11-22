package com.studyclub.api.cleanup;

import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.function.Supplier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/** 작업 실패를 격리하고 0건 실행도 남긴다. 메트릭 태그에 ID·IP를 넣지 않는다. */
@Component
public class CleanupRunner {
    private static final Logger log = LoggerFactory.getLogger(CleanupRunner.class);
    private final MeterRegistry registry;
    private final Map<String, RunState> states = new HashMap<>();

    public CleanupRunner(MeterRegistry registry) {
        this.registry = registry;
    }

    public void register(String job, boolean enabled) {
        RunState state = new RunState();
        states.put(job, state);
        var tags = io.micrometer.core.instrument.Tags.of("task", job);
        registry.gauge("cleanup.enabled", tags, enabled ? 1 : 0);
        registry.gauge("cleanup.last.run.seconds", tags, state, s -> s.lastRun);
        registry.gauge("cleanup.last.success.seconds", tags, state, s -> s.lastSuccess);
        registry.gauge("cleanup.held", tags, state, s -> s.held);
    }

    public void run(String job, Supplier<CleanupResult> work) {
        RunState state = states.get(job);
        state.lastRun = Instant.now().getEpochSecond();
        Timer.Sample timer = Timer.start(registry);
        CleanupResult result;
        try {
            result = work.get();
        } catch (RuntimeException e) {
            log.warn("정리 작업 실패 job={} error={}", job, e.getClass().getSimpleName());
            result = CleanupResult.completed(0, 1);
        }
        state.held = result.held();
        String outcome = result.skipped() ? "skipped" : result.failed() > 0 ? "failed" : "success";
        if (outcome.equals("success")) state.lastSuccess = Instant.now().getEpochSecond();
        registry.counter("cleanup.runs", "task", job, "outcome", outcome).increment();
        registry.counter("cleanup.deleted", "task", job).increment(result.deleted());
        registry.counter("cleanup.failures", "task", job).increment(result.failed());
        long nanos =
                timer.stop(registry.timer("cleanup.duration", "task", job, "outcome", outcome));
        log.info(
                "데이터 정리 job={} outcome={} deleted={} failed={} held={} durationMs={}",
                job,
                outcome,
                result.deleted(),
                result.failed(),
                result.held(),
                nanos / 1_000_000);
    }

    private static class RunState {
        volatile long lastRun;
        volatile long lastSuccess;
        volatile long held;
    }
}
