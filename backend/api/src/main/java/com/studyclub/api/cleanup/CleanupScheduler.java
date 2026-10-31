package com.studyclub.api.cleanup;

import com.studyclub.api.audit.AuditRetentionService;
import com.studyclub.api.feedback.FeedbackRetentionService;
import com.studyclub.api.upload.UploadService;
import java.time.Instant;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** 실행 주기는 한곳에서 관리하고 삭제 규칙은 각 서비스에 둔다. */
@Component
@ConditionalOnProperty(value = "cleanup.enabled", matchIfMissing = true)
public class CleanupScheduler {
    private final CleanupRunner runner;
    private final FeedbackRetentionService feedback;
    private final UploadService storage;
    private final AuditRetentionService audit;
    private final boolean feedbackEnabled;
    private final boolean storageEnabled;
    private final boolean auditEnabled;

    public CleanupScheduler(
            CleanupRunner runner,
            FeedbackRetentionService feedback,
            UploadService storage,
            AuditRetentionService audit,
            @Value("${feedback.retention.enabled:true}") boolean feedbackEnabled,
            @Value("${upload.cleanup.enabled:true}") boolean storageEnabled,
            @Value("${audit.retention.enabled:true}") boolean auditEnabled) {
        this.runner = runner;
        this.feedback = feedback;
        this.storage = storage;
        this.audit = audit;
        this.feedbackEnabled = feedbackEnabled;
        this.storageEnabled = storageEnabled;
        this.auditEnabled = auditEnabled;
        runner.register("feedback", feedbackEnabled);
        runner.register("storage", storageEnabled);
        runner.register("audit", auditEnabled);
    }

    @Scheduled(
            scheduler = "dataCleanupScheduler",
            fixedDelayString = "${cleanup.fixed-delay-ms:86400000}",
            initialDelayString = "${cleanup.initial-delay-ms:60000}")
    public void feedback() {
        if (feedbackEnabled)
            runner.run("feedback", () -> feedback.cleanUpWithResult(Instant.now()));
    }

    @Scheduled(
            scheduler = "dataCleanupScheduler",
            fixedDelayString = "${cleanup.fixed-delay-ms:86400000}",
            initialDelayString = "${cleanup.initial-delay-ms:60000}")
    public void storage() {
        if (storageEnabled) runner.run("storage", () -> storage.cleanUpWithResult(Instant.now()));
    }

    @Scheduled(
            scheduler = "dataCleanupScheduler",
            fixedDelayString = "${cleanup.fixed-delay-ms:86400000}",
            initialDelayString = "${cleanup.initial-delay-ms:60000}")
    public void audit() {
        if (auditEnabled) runner.run("audit", () -> audit.cleanUp(Instant.now()));
    }
}
