package com.studyclub.api.ops;

import com.studyclub.notification.StudyApplicationMailSkipped;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/** 전송은 트랜잭션 밖에서 한다. 집계는 인스턴스 메모리이고 개별 누락 로그가 진단의 정본이다. */
@Component
public class StudyApplicationMailAlerts {
    private static final Duration WINDOW = Duration.ofMinutes(10);
    private final OpsAlertNotifier notifier;
    private final Clock clock;
    private final Map<Key, Pending> pending = new HashMap<>();

    @Autowired
    public StudyApplicationMailAlerts(OpsAlertNotifier notifier) {
        this(notifier, Clock.systemUTC());
    }

    StudyApplicationMailAlerts(OpsAlertNotifier notifier, Clock clock) {
        this.notifier = notifier;
        this.clock = clock;
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onSkipped(StudyApplicationMailSkipped event) {
        Summary summary = record(event);
        if (summary != null) {
            send(summary);
        }
    }

    private synchronized Summary record(StudyApplicationMailSkipped event) {
        Instant now = clock.instant();
        Key key = new Key(event.studyId(), event.reason());
        Pending previous = pending.get(key);
        if (previous == null || !now.isBefore(previous.nextAt())) {
            long count = previous == null ? 1 : previous.count() + 1;
            pending.put(key, new Pending(now.plus(WINDOW), 0, event));
            return new Summary(event, count);
        }
        pending.put(key, new Pending(previous.nextAt(), previous.count() + 1, event));
        return null;
    }

    @Async
    @Scheduled(fixedDelay = 30_000)
    public void flush() {
        for (Summary summary : drain()) {
            send(summary);
        }
    }

    private synchronized List<Summary> drain() {
        Instant now = clock.instant();
        List<Summary> summaries = new ArrayList<>();
        var iterator = pending.entrySet().iterator();
        while (iterator.hasNext()) {
            var entry = iterator.next();
            var value = entry.getValue();
            if (now.isBefore(value.nextAt())) {
                continue;
            }
            if (value.count() == 0) {
                iterator.remove();
            } else {
                summaries.add(new Summary(value.last(), value.count()));
                entry.setValue(new Pending(now.plus(WINDOW), 0, value.last()));
            }
        }
        return summaries;
    }

    private void send(Summary summary) {
        var event = summary.event();
        Map<String, String> fields = new LinkedHashMap<>();
        fields.put("조건", "STUDY_APPLICATION_RECEIVED");
        fields.put("스터디 ID", event.studyId().toString());
        fields.put("최근 신청 ID", event.applicationId().toString());
        fields.put("사유", event.reason().name());
        fields.put("누락 건수", Long.toString(summary.count()));
        fields.put("최근 발생 시각", event.meta().occurredAt().toString());
        notifier.send(OpsAlertNotifier.Level.WARN, "스터디 신청 메일 예약 누락", fields);
    }

    private record Key(Long studyId, StudyApplicationMailSkipped.Reason reason) {}

    private record Pending(Instant nextAt, long count, StudyApplicationMailSkipped last) {}

    private record Summary(StudyApplicationMailSkipped event, long count) {}
}
