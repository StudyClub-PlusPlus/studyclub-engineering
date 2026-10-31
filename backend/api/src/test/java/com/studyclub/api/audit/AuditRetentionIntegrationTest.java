package com.studyclub.api.audit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;

import com.studyclub.api.auth.AccountDeletionService;
import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountLeaveReasonRepository;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.LeaveReason;
import com.studyclub.domain.account.SystemRole;
import com.studyclub.domain.audit.AdminAuditLog;
import com.studyclub.domain.audit.AdminAuditLogRepository;
import com.studyclub.domain.participant.ParticipantRole;
import com.studyclub.domain.participant.ParticipantStatus;
import com.studyclub.domain.participant.StudyParticipant;
import com.studyclub.domain.participant.StudyParticipantRepository;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

@SpringBootTest(
        properties =
                "spring.datasource.url=jdbc:h2:mem:audit-retention;MODE=MySQL;DB_CLOSE_DELAY=-1")
class AuditRetentionIntegrationTest {
    private static final Instant NOW = Instant.parse("2026-10-31T12:00:00Z");
    @Autowired AuditRetentionService service;
    @MockitoSpyBean AdminAuditLogRepository repository;
    @Autowired JdbcTemplate jdbc;
    @Autowired PlatformTransactionManager manager;
    @Autowired AccountDeletionService accountDeletion;
    @Autowired AccountRepository accounts;
    @Autowired StudyParticipantRepository participants;
    @Autowired AccountLeaveReasonRepository leaveReasons;

    @AfterEach
    void resetRequest() {
        RequestContextHolder.resetRequestAttributes();
    }

    @Test
    @DisplayName("캡틴이자 네비게이터 탈퇴 시 실제 권한만 IP와 함께 말소 기록으로 남긴다")
    void recordsRevokedAuthorityOnAccountDeletion() {
        Account account = account(SystemRole.ADMIN);
        for (ParticipantStatus status : ParticipantStatus.values()) {
            participants.save(
                    StudyParticipant.builder()
                            .accountId(account.getId())
                            .studyId(1000L + status.ordinal())
                            .studyGroupId(1000L + status.ordinal())
                            .participantRole(ParticipantRole.LEADER)
                            .status(status)
                            .joinedAt(NOW)
                            .build());
        }
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("198.51.100.10");
        request.addHeader("X-Forwarded-For", "203.0.113.99");
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));
        accountDeletion.deleteAccount(account.getId(), LeaveReason.OTHER);
        assertThat(accounts.existsById(account.getId())).isFalse();
        assertThat(repository.findAll())
                .hasSize(3)
                .allSatisfy(
                        entry -> {
                            assertThat(entry.getActorAccountId()).isEqualTo(account.getId());
                            assertThat(entry.getTargetAccountId()).isEqualTo(account.getId());
                            assertThat(entry.getActorIp()).isEqualTo("198.51.100.10");
                            assertThat(entry.getReason()).isEqualTo("ACCOUNT_DELETION");
                            assertThat(entry.getAfterValue()).isEqualTo("NONE");
                        });
        assertThat(repository.findAll())
                .filteredOn(e -> e.getParticipantId() != null)
                .hasSize(2)
                .allSatisfy(
                        e -> assertThat(e.getParticipantRole()).isEqualTo(ParticipantRole.LEADER));
        assertThatThrownBy(() -> accountDeletion.deleteAccount(account.getId(), LeaveReason.OTHER));
        assertThat(repository.count()).isEqualTo(3);
    }

    @Test
    @DisplayName("말소 기록 저장 실패 시 계정·참여·탈퇴 사유를 함께 롤백한다")
    void auditFailureRollsBackAccountDeletion() {
        Account account = account(SystemRole.ADMIN);
        StudyParticipant participant =
                participants.save(
                        StudyParticipant.builder()
                                .accountId(account.getId())
                                .studyId(3000L)
                                .studyGroupId(3000L)
                                .participantRole(ParticipantRole.LEADER)
                                .status(ParticipantStatus.ACTIVE)
                                .joinedAt(NOW)
                                .build());
        long reasonsBefore = leaveReasons.count();
        doThrow(new IllegalStateException("test")).when(repository).save(any(AdminAuditLog.class));
        assertThatThrownBy(() -> accountDeletion.deleteAccount(account.getId(), LeaveReason.OTHER))
                .isInstanceOf(IllegalStateException.class);
        assertThat(accounts.existsById(account.getId())).isTrue();
        assertThat(participants.findById(participant.getId()).orElseThrow().getStatus())
                .isEqualTo(ParticipantStatus.ACTIVE);
        assertThat(leaveReasons.count()).isEqualTo(reasonsBefore);
        assertThat(repository.count()).isZero();
    }

    @Test
    @DisplayName("일반 회원 탈퇴에는 권한 말소 기록을 만들지 않는다")
    void ordinaryMemberHasNoRevocation() {
        Account account = account(SystemRole.MEMBER);
        accountDeletion.deleteAccount(account.getId(), LeaveReason.OTHER);
        assertThat(repository.count()).isZero();
    }

    private Account account(SystemRole role) {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        return accounts.save(
                new Account("audit-" + suffix + "@example.com", "audit_" + suffix, null, role));
    }

    @BeforeEach
    void clear() {
        repository.deleteAllInBatch();
    }

    @Test
    @DisplayName("페이지를 넘는 205건을 빠짐없이 지우며 3년 권한 기록과 과거 역할 미상 중단은 보존한다")
    void pagesAndRetentionClasses() {
        for (int i = 0; i < 205; i++)
            seed(AdminAuditLog.emailReveal(1L, 2L), "2025-10-31T12:00:00Z");
        AdminAuditLog permission =
                seed(
                        AdminAuditLog.roleChange(1L, 2L, SystemRole.MEMBER, SystemRole.ADMIN),
                        "2024-01-01T00:00:00Z");
        AdminAuditLog unknown =
                seed(
                        AdminAuditLog.withdraw(1L, 2L, 3L, ParticipantStatus.ACTIVE, null),
                        "2020-01-01T00:00:00Z");
        seed(
                AdminAuditLog.withdraw(
                        1L, 2L, 4L, ParticipantStatus.ACTIVE, ParticipantRole.MEMBER),
                "2025-10-31T12:00:00Z");
        seed(AdminAuditLog.participantRoleRevoked(2L, 5L), "2023-10-31T12:00:00Z");
        var result = service.cleanUp(NOW);
        assertThat(result.deleted()).isEqualTo(207);
        assertThat(result.held()).isEqualTo(1);
        assertThat(result.failed()).isZero();
        assertThat(repository.findAll())
                .extracting(AdminAuditLog::getId)
                .containsExactlyInAnyOrder(permission.getId(), unknown.getId());
        assertThat(service.cleanUp(NOW).deleted()).isZero();
    }

    @Test
    @DisplayName("한 항목 삭제가 실패해도 뒤 항목을 처리하고 실패 행은 다음 실행에서 재시도한다")
    void isolatesFailures() {
        AdminAuditLog first = seed(AdminAuditLog.discordReveal(1L, 2L), "2024-01-01T00:00:00Z");
        seed(AdminAuditLog.emailReveal(1L, 2L), "2024-01-01T00:00:00Z");
        doThrow(new IllegalStateException("test"))
                .when(repository)
                .deleteExpiredIds(java.util.List.of(first.getId()));
        var result = service.cleanUp(NOW);
        assertThat(result.deleted()).isEqualTo(1);
        assertThat(result.failed()).isEqualTo(1);
        assertThat(repository.existsById(first.getId())).isTrue();
        org.mockito.Mockito.reset(repository);
        assertThat(service.cleanUp(NOW).deleted()).isEqualTo(1);
    }

    @Test
    @DisplayName("2년 보관 설정은 1년 지난 조회 기록을 보존한다")
    void twoYearRequirement() {
        seed(AdminAuditLog.emailReveal(1L, 2L), "2025-10-31T12:00:00Z");
        seed(AdminAuditLog.emailReveal(1L, 2L), "2024-10-31T12:00:00Z");
        assertThat(new AuditRetentionService(repository, manager, 2).cleanUp(NOW).deleted())
                .isEqualTo(1);
        assertThat(repository.count()).isEqualTo(1);
    }

    private AdminAuditLog seed(AdminAuditLog entry, String createdAt) {
        entry = repository.save(entry);
        jdbc.update(
                "UPDATE ADMIN_AUDIT_LOG SET CREATED_AT=? WHERE ID=?",
                Timestamp.from(Instant.parse(createdAt)),
                entry.getId());
        return entry;
    }
}
