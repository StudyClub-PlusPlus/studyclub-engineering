package com.studyclub.api.notification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.studyclub.notification.*;
import com.studyclub.notification.mail.*;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@SpringBootTest(
        properties =
                "spring.datasource.url=jdbc:h2:mem:notification-polling;MODE=MySQL;DB_CLOSE_DELAY=-1")
class NotificationPollingIntegrationTest {
    @Autowired NotificationRepository notificationRepository;
    @Autowired NotificationTemplateRepository notificationTemplateRepository;
    @Autowired NotificationPollingScheduler notificationPollingScheduler;
    @Autowired NotificationClaimService notificationClaimService;
    @Autowired JdbcTemplate jdbcTemplate;
    @MockitoBean MailClient mailClient;
    private NotificationTemplate template;

    @BeforeEach
    void setUp() {
        notificationRepository.deleteAll();
        notificationTemplateRepository.deleteAll();
        template =
                notificationTemplateRepository.save(
                        new NotificationTemplate(
                                NotificationEventType.USER_REGISTERED,
                                NotificationChannel.EMAIL,
                                "{{nickname}}님 환영합니다",
                                "안녕하세요, {{nickname}}님."));
    }

    private Notification pending() {
        return notificationRepository.save(
                Notification.pendingImmediate(
                        NotificationEventType.USER_REGISTERED,
                        NotificationChannel.EMAIL,
                        "recipient@example.com",
                        null,
                        template.getId(),
                        Map.of("nickname", "홍길동")));
    }

    private Notification reload(Notification notification) {
        return notificationRepository.findById(notification.getId()).orElseThrow();
    }

    @Test
    @DisplayName("클레임을 먼저 커밋하고 트랜잭션 밖에서 발송한다 — 성공 건은 다시 보내지 않는다")
    void sendsAfterClaimCommit() {
        Notification notification = pending();
        doAnswer(
                        invocation -> {
                            assertThat(
                                            TransactionSynchronizationManager
                                                    .isActualTransactionActive())
                                    .isFalse();
                            Notification processing = reload(notification);
                            assertThat(processing.getStatus())
                                    .isEqualTo(NotificationStatus.PROCESSING);
                            assertThat(processing.getLockedAt()).isNotNull();
                            return null;
                        })
                .when(mailClient)
                .send(any(), anyString(), anyString(), anyString());

        notificationPollingScheduler.poll();
        Notification sent = reload(notification);
        assertThat(sent.getStatus()).isEqualTo(NotificationStatus.SENT);
        assertThat(sent.getSentAt()).isNotNull();
        assertThat(sent.getLockedAt()).isNull();
        notificationPollingScheduler.poll();
        verify(mailClient)
                .send(MailCategory.NOTIFY, "recipient@example.com", "홍길동님 환영합니다", "안녕하세요, 홍길동님.");
    }

    @Test
    @DisplayName("발송 실패는 원인을 기록하고 FAILED 로 남긴다 — 자동 재시도하지 않는다")
    void recordsProviderFailure() {
        Notification notification = pending();
        doThrow(new MailSendException(NotificationErrorType.PROVIDER_ERROR, "test failure", null))
                .when(mailClient)
                .send(any(), anyString(), anyString(), anyString());
        notificationPollingScheduler.poll();
        notificationPollingScheduler.poll();
        Notification failed = reload(notification);
        assertThat(failed.getStatus()).isEqualTo(NotificationStatus.FAILED);
        assertThat(failed.getErrorType()).isEqualTo(NotificationErrorType.PROVIDER_ERROR);
        assertThat(failed.getSentAt()).isNull();
        assertThat(failed.getLockedAt()).isNull();
        verify(mailClient).send(any(), anyString(), anyString(), anyString());
    }

    @Test
    @DisplayName("템플릿이 사라졌으면 TEMPLATE_MISSING 으로 끝내고 메일을 호출하지 않는다")
    void recordsMissingTemplate() {
        Notification notification = pending();
        notificationTemplateRepository.delete(template);
        notificationPollingScheduler.poll();
        assertThat(reload(notification).getErrorType())
                .isEqualTo(NotificationErrorType.TEMPLATE_MISSING);
        assertThat(reload(notification).getStatus()).isEqualTo(NotificationStatus.FAILED);
        verifyNoInteractions(mailClient);
    }

    @Test
    @DisplayName("예상 못한 오류도 FAILED 로 기록한다 — 배치의 다음 알림은 계속 보낸다")
    void continuesAfterUnexpectedFailure() {
        pending();
        pending();
        doThrow(new IllegalStateException("test failure"))
                .doNothing()
                .when(mailClient)
                .send(any(), anyString(), anyString(), anyString());
        notificationPollingScheduler.poll();
        assertThat(notificationRepository.findAll())
                .extracting(Notification::getStatus)
                .containsExactlyInAnyOrder(NotificationStatus.FAILED, NotificationStatus.SENT);
        assertThat(notificationRepository.findAll())
                .filteredOn(n -> n.getStatus() == NotificationStatus.FAILED)
                .extracting(Notification::getErrorType)
                .containsExactly(NotificationErrorType.UNKNOWN);
    }

    @Test
    @DisplayName("5분 넘게 멈춘 PROCESSING 만 회수한다 — 최근 클레임과 최종 상태는 보존한다")
    void reclaimsOnlyStaleProcessing() {
        Notification stale = pending();
        stale.markProcessing(Instant.now().minusSeconds(360));
        notificationRepository.save(stale);
        Notification recent = pending();
        recent.markProcessing(Instant.now());
        notificationRepository.save(recent);
        Notification failed = pending();
        Instant failedLockedAt = Instant.now().minusSeconds(360);
        failed.markProcessing(failedLockedAt);
        failed.markFailed(NotificationErrorType.INVALID_RECIPIENT, failedLockedAt);
        notificationRepository.save(failed);
        notificationClaimService.reclaimStuck(5);
        assertThat(reload(stale).getStatus()).isEqualTo(NotificationStatus.PENDING);
        assertThat(reload(stale).getLockedAt()).isNull();
        assertThat(reload(recent).getStatus()).isEqualTo(NotificationStatus.PROCESSING);
        assertThat(reload(failed).getStatus()).isEqualTo(NotificationStatus.FAILED);
    }

    @Test
    @DisplayName("배치 크기와 예약 시각을 지킨다 — 클레임된 행은 다음 클레임에서 제외한다")
    void limitsClaimsAndSkipsFutureNotifications() {
        Notification immediate = pending();
        Notification due = pending();
        Notification future = pending();
        jdbcTemplate.update(
                "UPDATE NOTIFICATION SET SCHEDULED_AT = ? WHERE ID = ?",
                Timestamp.from(Instant.now().minusSeconds(60)),
                due.getId());
        jdbcTemplate.update(
                "UPDATE NOTIFICATION SET SCHEDULED_AT = ? WHERE ID = ?",
                Timestamp.from(Instant.now().plusSeconds(3600)),
                future.getId());
        assertThat(notificationClaimService.claim(1))
                .extracting(Notification::getId)
                .containsExactly(due.getId());
        assertThat(notificationClaimService.claim(100))
                .extracting(Notification::getId)
                .containsExactly(immediate.getId());
        assertThat(notificationClaimService.claim(100)).isEmpty();
        assertThat(reload(future).getStatus()).isEqualTo(NotificationStatus.PENDING);
    }
}
