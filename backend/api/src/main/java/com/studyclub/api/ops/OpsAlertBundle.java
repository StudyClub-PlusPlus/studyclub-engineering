package com.studyclub.api.ops;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.OptionalInt;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 같은 키의 경보를 한 창(기본 10분)에 한 번으로 묶는다. 창의 첫 사건에 경보를 보내고, 창 안의 나머지는 세기만 한다. 다음 창의 첫 경보에 그 사이 묶인 건수를 더해
 * 보낸다. 서버마다 따로 센다 — 여러 대면 대수만큼 경보가 날 수 있다.
 */
final class OpsAlertBundle {

    private record Window(Instant openedAt, int bundled) {}

    private final Duration window;
    private final Clock clock;
    private final Map<String, Window> windows = new ConcurrentHashMap<>();

    OpsAlertBundle(Duration window, Clock clock) {
        this.window = window;
        this.clock = clock;
    }

    /** 지금 보내야 하면 이 경보가 대신하는 건수(자기 포함), 창 안이라 묶였으면 비어 있다. */
    OptionalInt record(String key) {
        Instant now = clock.instant();
        int[] send = {0};
        windows.compute(
                key,
                (k, current) -> {
                    if (current == null || !now.isBefore(current.openedAt().plus(window))) {
                        send[0] = 1 + (current == null ? 0 : current.bundled());
                        return new Window(now, 0);
                    }
                    return new Window(current.openedAt(), current.bundled() + 1);
                });
        return send[0] == 0 ? OptionalInt.empty() : OptionalInt.of(send[0]);
    }
}
