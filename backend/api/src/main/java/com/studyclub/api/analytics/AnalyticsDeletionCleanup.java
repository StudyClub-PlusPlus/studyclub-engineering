package com.studyclub.api.analytics;

import com.studyclub.api.cleanup.CleanupResult;
import com.studyclub.domain.analytics.AccountAnalyticsRepository;
import java.time.Instant;
import java.util.List;
import org.slf4j.*;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

@Service
public class AnalyticsDeletionCleanup {
    private static final Logger log = LoggerFactory.getLogger(AnalyticsDeletionCleanup.class);
    private final AccountAnalyticsRepository profiles;
    private final AnalyticsDeletionWorker worker;

    public AnalyticsDeletionCleanup(
            AccountAnalyticsRepository profiles, AnalyticsDeletionWorker worker) {
        this.profiles = profiles;
        this.worker = worker;
    }

    public CleanupResult cleanUp(Instant now) {
        long afterId = 0, held = 0;
        int deleted = 0, failed = 0;
        while (true) {
            List<Long> ids = profiles.findDeletionCandidates(afterId, PageRequest.of(0, 100));
            if (ids.isEmpty()) break;
            for (Long id : ids) {
                afterId = id;
                try {
                    CleanupResult result = worker.process(id, now);
                    deleted += result.deleted();
                    failed += result.failed();
                    held += result.held();
                } catch (RuntimeException e) {
                    failed++;
                    log.warn("analytics cleanup failed type={}", e.getClass().getSimpleName());
                }
            }
        }
        return new CleanupResult(deleted, failed, held, false);
    }
}
