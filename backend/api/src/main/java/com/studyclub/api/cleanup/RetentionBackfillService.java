package com.studyclub.api.cleanup;

import com.studyclub.domain.audit.AdminAuditLog;
import com.studyclub.domain.audit.AdminAuditLogRepository;
import com.studyclub.domain.feedback.Feedback;
import com.studyclub.domain.feedback.FeedbackRepository;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

/** 현재 테스트 기록의 V1 초기화. 설정 변경이나 재시작으로 이미 저장한 기한을 덮어쓰지 않는다. */
@Service
public class RetentionBackfillService implements ApplicationRunner {
    private static final int BATCH_SIZE = 100;
    private final FeedbackRepository feedback;
    private final AdminAuditLogRepository audit;
    private final TransactionTemplate transaction;

    public RetentionBackfillService(
            FeedbackRepository feedback,
            AdminAuditLogRepository audit,
            PlatformTransactionManager manager) {
        this.feedback = feedback;
        this.audit = audit;
        transaction = new TransactionTemplate(manager);
        transaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    @Override
    public void run(ApplicationArguments args) {
        backfillFeedback();
        backfillAudit();
    }

    // 일일 삭제 직전에도 실행하여 순차 배포 중 이전 서버가 저장한 행을 놓치지 않는다.
    public void backfillFeedback() {
        while (true) {
            Integer count =
                    transaction.execute(
                            status -> {
                                var rows =
                                        feedback.findWithoutRetentionForUpdate(
                                                PageRequest.of(0, BATCH_SIZE));
                                rows.forEach(Feedback::initializeRetention);
                                return rows.size();
                            });
            if (count == null || count < BATCH_SIZE) return;
        }
    }

    public void backfillAudit() {
        while (true) {
            Integer count =
                    transaction.execute(
                            status -> {
                                var rows =
                                        audit.findWithoutRetentionForUpdate(
                                                PageRequest.of(0, BATCH_SIZE));
                                rows.forEach(AdminAuditLog::initializeLegacyRetention);
                                return rows.size();
                            });
            if (count == null || count < BATCH_SIZE) return;
        }
    }
}
