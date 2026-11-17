package com.studyclub.api.analytics;

import com.studyclub.domain.analytics.AnalyticsDeletionRequested;
import java.time.Instant;
import org.slf4j.*;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionalEventListener;

/** 첫 시도만 예약한다. 실패·재시작 복구는 공통 일일 cleanup이 맡는다. */
@Component
@ConditionalOnExpression("${cleanup.enabled:true} && ${analytics.deletion.enabled:true}")
public class AnalyticsDeletionListener {
    private static final Logger log = LoggerFactory.getLogger(AnalyticsDeletionListener.class);
    private final TaskScheduler scheduler;
    private final AnalyticsDeletionWorker worker;

    public AnalyticsDeletionListener(
            @Qualifier("dataCleanupScheduler") TaskScheduler scheduler,
            AnalyticsDeletionWorker worker) {
        this.scheduler = scheduler;
        this.worker = worker;
    }

    @TransactionalEventListener
    public void requested(AnalyticsDeletionRequested event) {
        try {
            scheduler.schedule(
                    () -> {
                        try {
                            worker.process(event.accountId(), Instant.now());
                        } catch (RuntimeException e) {
                            log.warn(
                                    "analytics initial deletion failed type={}",
                                    e.getClass().getSimpleName());
                        }
                    },
                    event.readyAt());
        } catch (RuntimeException e) {
            log.warn(
                    "analytics initial deletion scheduling failed type={}",
                    e.getClass().getSimpleName());
        }
    }
}
