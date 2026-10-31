package com.studyclub.api.audit;

import com.studyclub.api.cleanup.CleanupResult;
import com.studyclub.domain.audit.AdminAuditAction;
import com.studyclub.domain.audit.AdminAuditLog;
import com.studyclub.domain.audit.AdminAuditLogRepository;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

@Service
public class AuditRetentionService {
    private static final Logger log = LoggerFactory.getLogger(AuditRetentionService.class);
    private static final int BATCH_SIZE = 100;
    private final AdminAuditLogRepository repository;
    private final TransactionTemplate transaction;
    private final int accessYears;

    public AuditRetentionService(
            AdminAuditLogRepository repository,
            PlatformTransactionManager manager,
            @Value("${audit.retention.access-years:1}") int accessYears) {
        if (accessYears != 1 && accessYears != 2) {
            throw new IllegalArgumentException("audit.retention.access-years는 1 또는 2여야 합니다.");
        }
        this.repository = repository;
        this.accessYears = accessYears;
        transaction = new TransactionTemplate(manager);
        transaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    public CleanupResult cleanUp(Instant now) {
        Instant before = now.minus(365, ChronoUnit.DAYS);
        long afterId = 0;
        int deleted = 0;
        int failed = 0;
        while (true) {
            List<AdminAuditLog> candidates =
                    repository.findRetentionCandidates(
                            afterId, before, PageRequest.of(0, BATCH_SIZE));
            if (candidates.isEmpty()) break;
            for (AdminAuditLog entry : candidates) {
                if (!entry.isRetentionExpired(now, accessYears)) continue;
                try {
                    Integer count =
                            transaction.execute(
                                    status -> repository.deleteExpiredIds(List.of(entry.getId())));
                    deleted += count == null ? 0 : count;
                } catch (RuntimeException e) {
                    failed++;
                    log.warn(
                            "감사 기록 정리 실패 id={} error={}",
                            entry.getId(),
                            e.getClass().getSimpleName());
                }
            }
            afterId = candidates.getLast().getId();
            if (candidates.size() < BATCH_SIZE) break;
        }
        long held = repository.countByActionAndParticipantRoleIsNull(AdminAuditAction.WITHDRAW);
        return new CleanupResult(deleted, failed, held, false);
    }
}
