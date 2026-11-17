package com.studyclub.api.cleanup;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;

import com.studyclub.api.audit.AdminAuditRecorder;
import com.studyclub.api.audit.AuditRetentionService;
import com.studyclub.api.feedback.FeedbackRetentionService;
import com.studyclub.domain.account.SystemRole;
import com.studyclub.domain.audit.AdminAuditLog;
import com.studyclub.domain.audit.AdminAuditLogRepository;
import com.studyclub.domain.feedback.Feedback;
import com.studyclub.domain.feedback.FeedbackRepository;
import com.studyclub.domain.feedback.FeedbackType;
import com.studyclub.domain.participant.ParticipantRole;
import com.studyclub.domain.participant.ParticipantStatus;
import com.studyclub.domain.retention.RetentionPolicy;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.PageRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

@SpringBootTest(
        properties = {
            "spring.datasource.url=jdbc:h2:mem:retention-backfill;MODE=MySQL;DB_CLOSE_DELAY=-1",
            "audit.retention.access-years=2"
        })
class RetentionBackfillIntegrationTest {
    private static final Instant CREATED = Instant.parse("2024-02-29T12:00:00Z");
    @Autowired RetentionBackfillService backfill;
    @Autowired AdminAuditRecorder recorder;
    @Autowired AuditRetentionService auditCleanup;
    @Autowired FeedbackRetentionService feedbackCleanup;
    @MockitoSpyBean FeedbackRepository feedbacks;
    @Autowired AdminAuditLogRepository audits;
    @Autowired JdbcTemplate jdbc;
    @Autowired PlatformTransactionManager manager;

    @BeforeEach
    void clear() {
        feedbacks.deleteAllInBatch();
        audits.deleteAllInBatch();
    }

    @Test
    @DisplayName("신규 문의와 감사 기록은 저장 시 생성일 기준의 규칙과 만료일을 함께 남긴다")
    void newRecordsPersistMetadata() {
        Feedback feedback = feedbacks.saveAndFlush(feedback());
        AdminAuditLog audit = AdminAuditLog.emailReveal(1L, 2L);
        new TransactionTemplate(manager).executeWithoutResult(status -> recorder.record(audit));
        Feedback savedFeedback = feedbacks.findById(feedback.getId()).orElseThrow();
        AdminAuditLog savedAudit = audits.findById(audit.getId()).orElseThrow();
        assertThat(savedFeedback.getCreatedAt()).isEqualTo(feedback.getCreatedAt());
        assertThat(savedAudit.getCreatedAt()).isEqualTo(audit.getCreatedAt());
        assertThat(savedFeedback.getRetentionPolicy()).isEqualTo(RetentionPolicy.FEEDBACK_V1);
        assertThat(savedFeedback.getExpiresAt())
                .isEqualTo(RetentionPolicy.FEEDBACK_V1.expiresAt(savedFeedback.getCreatedAt()));
        assertThat(savedAudit.getRetentionPolicy())
                .isEqualTo(RetentionPolicy.AUDIT_ACCESS_TWO_YEARS_V1);
        assertThat(savedAudit.getExpiresAt())
                .isEqualTo(
                        RetentionPolicy.AUDIT_ACCESS_TWO_YEARS_V1.expiresAt(
                                savedAudit.getCreatedAt()));
    }

    @Test
    @DisplayName("2년 설정에서도 기존 테스트 기록은 원래 기준일의 V1으로 채우고 재실행 시 유지한다")
    void legacyV1UsesOriginalDatesAndIsIdempotent() {
        Feedback unanswered = legacyFeedback(null);
        Feedback answered = legacyFeedback("2024-06-01T01:02:03.123456Z");
        AdminAuditLog access = legacyAudit(AdminAuditLog.emailReveal(1L, 2L));
        AdminAuditLog member =
                legacyAudit(
                        AdminAuditLog.withdraw(
                                1L, 2L, 3L, ParticipantStatus.ACTIVE, ParticipantRole.MEMBER));
        AdminAuditLog authority =
                legacyAudit(AdminAuditLog.roleChange(1L, 2L, SystemRole.MEMBER, SystemRole.ADMIN));
        AdminAuditLog unknown =
                legacyAudit(AdminAuditLog.withdraw(1L, 2L, 3L, ParticipantStatus.ACTIVE, null));

        // 초기화 전에는 오래된 생성일만으로 삭제 후보에 포함하지 않는다.
        assertThat(
                        feedbacks.findRetentionCandidateIds(
                                0, Instant.parse("2030-01-01T00:00:00Z"), PageRequest.of(0, 100)))
                .isEmpty();
        assertThat(
                        audits.findRetentionCandidates(
                                0, Instant.parse("2030-01-01T00:00:00Z"), PageRequest.of(0, 100)))
                .isEmpty();
        backfill.run(null);
        assertFeedback(unanswered, "2025-02-28T12:00:00Z");
        assertFeedback(answered, "2025-06-01T01:02:03.123456Z");
        for (var entry : java.util.List.of(access, member)) {
            var saved = audits.findById(entry.getId()).orElseThrow();
            assertThat(saved.getRetentionPolicy()).isEqualTo(RetentionPolicy.AUDIT_ACCESS_V1);
            assertThat(saved.getExpiresAt()).isEqualTo(Instant.parse("2025-02-28T12:00:00Z"));
        }
        assertThat(audits.findById(authority.getId()).orElseThrow().getExpiresAt())
                .isEqualTo(Instant.parse("2027-02-28T12:00:00Z"));
        var held = audits.findById(unknown.getId()).orElseThrow();
        assertThat(held.getRetentionPolicy())
                .isEqualTo(RetentionPolicy.AUDIT_WITHDRAW_UNCLASSIFIED_V1);
        assertThat(held.getExpiresAt()).isNull();
        assertThat(held.getActorIp()).isNull();
        assertThat(held.getParticipantRole()).isNull();

        Instant changedExpiry = Instant.parse("2031-01-01T00:00:00Z");
        jdbc.update(
                "UPDATE FEEDBACK SET EXPIRES_AT=? WHERE ID=?",
                Timestamp.from(changedExpiry),
                unanswered.getId());
        jdbc.update(
                "UPDATE ADMIN_AUDIT_LOG SET EXPIRES_AT=? WHERE ID=?",
                Timestamp.from(changedExpiry),
                access.getId());
        backfill.run(null);
        assertFeedback(unanswered, changedExpiry.toString());
        assertThat(audits.findById(access.getId()).orElseThrow().getExpiresAt())
                .isEqualTo(changedExpiry);
        assertThat(auditCleanup.cleanUp(Instant.parse("2030-01-01T00:00:00Z")).held()).isEqualTo(1);
    }

    @Test
    @DisplayName("기존 문의의 첫 답변은 V1을 채우며 첫 답변 기한을 한 번만 갱신한다")
    void firstReplyInitializesLegacyAndDoesNotResetOnEdits() {
        Feedback feedback = legacyFeedback(null);
        Instant first = Instant.parse("2026-01-02T12:00:00Z");
        var transaction = new TransactionTemplate(manager);
        transaction.executeWithoutResult(
                status ->
                        feedbacks
                                .findByIdForUpdate(feedback.getId())
                                .orElseThrow()
                                .reply("첫 번째 답변입니다.", 2L, first));
        backfill.run(null);
        transaction.executeWithoutResult(
                status -> {
                    Feedback latest = feedbacks.findByIdForUpdate(feedback.getId()).orElseThrow();
                    latest.reply("수정한 답변입니다.", 2L, first.plusSeconds(86400));
                    latest.changeAdminMemo("추가 확인 메모");
                });
        assertFeedback(feedback, "2027-01-02T12:00:00Z");
    }

    @Test
    @DisplayName("여러 서버가 100건을 넘는 과거 행을 초기화해도 모든 기록을 한 번씩 채운다")
    void concurrentBackfillAcrossBatches() throws Exception {
        for (int i = 0; i < 105; i++) {
            legacyFeedback(null);
            legacyAudit(AdminAuditLog.emailReveal(1L, 2L));
        }
        try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
            var first = executor.submit(() -> backfill.run(null));
            var second = executor.submit(() -> backfill.run(null));
            first.get(20, TimeUnit.SECONDS);
            second.get(20, TimeUnit.SECONDS);
        }
        assertThat(feedbacks.findAll())
                .hasSize(105)
                .allSatisfy(
                        entry -> {
                            assertThat(entry.getRetentionPolicy())
                                    .isEqualTo(RetentionPolicy.FEEDBACK_V1);
                            assertThat(entry.getExpiresAt())
                                    .isEqualTo(Instant.parse("2025-02-28T12:00:00Z"));
                        });
        assertThat(audits.findAll())
                .hasSize(105)
                .allSatisfy(
                        entry -> {
                            assertThat(entry.getRetentionPolicy())
                                    .isEqualTo(RetentionPolicy.AUDIT_ACCESS_V1);
                            assertThat(entry.getExpiresAt())
                                    .isEqualTo(Instant.parse("2025-02-28T12:00:00Z"));
                        });
    }

    @Test
    @DisplayName("초기화 실패 시 해당 정리 실행은 기존 데이터를 삭제하지 않는다")
    void backfillFailureStopsCleanup() {
        Feedback legacy = legacyFeedback(null);
        doThrow(new IllegalStateException("test"))
                .when(feedbacks)
                .findWithoutRetentionForUpdate(any());
        assertThatThrownBy(() -> feedbackCleanup.cleanUp(Instant.parse("2030-01-01T00:00:00Z")))
                .isInstanceOf(IllegalStateException.class);
        assertThat(feedbacks.existsById(legacy.getId())).isTrue();
    }

    private void assertFeedback(Feedback entry, String expiry) {
        var saved = feedbacks.findById(entry.getId()).orElseThrow();
        assertThat(saved.getRetentionPolicy()).isEqualTo(RetentionPolicy.FEEDBACK_V1);
        assertThat(saved.getExpiresAt()).isEqualTo(Instant.parse(expiry));
    }

    private Feedback feedback() {
        return new Feedback(1L, FeedbackType.QUESTION, "테스트 문의", "보관 규칙을 확인합니다.", null, null, null);
    }

    private Feedback legacyFeedback(String repliedAt) {
        Feedback entry = feedback();
        if (repliedAt != null) entry.reply("문의에 대한 답변입니다.", 2L, Instant.parse(repliedAt));
        entry = feedbacks.saveAndFlush(entry);
        jdbc.update(
                "UPDATE FEEDBACK SET CREATED_AT=?, RETENTION_POLICY=NULL, EXPIRES_AT=NULL WHERE ID=?",
                Timestamp.from(CREATED),
                entry.getId());
        return entry;
    }

    private AdminAuditLog legacyAudit(AdminAuditLog entry) {
        entry = audits.saveAndFlush(entry);
        jdbc.update(
                "UPDATE ADMIN_AUDIT_LOG SET CREATED_AT=?, RETENTION_POLICY=NULL, EXPIRES_AT=NULL WHERE ID=?",
                Timestamp.from(CREATED),
                entry.getId());
        return entry;
    }
}
