package com.studyclub.notification;

import com.studyclub.notification.mail.MailSendException;
import java.time.Instant;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * PENDING 알림을 30초마다 클레임해 발송한다 (specs/notification/spec.md). 트랜잭션 경계는 전부 {@link
 * NotificationClaimService} 에 있다 — 이 클래스 자체는 트랜잭션이 없는 조율자일 뿐이다.
 */
@Component
@Slf4j
public class NotificationPollingScheduler {

    private final NotificationClaimService notificationClaimService;
    private final WelcomeEmailDispatcher welcomeEmailDispatcher;
    private final int batchSize;
    private final long reclaimTimeoutMinutes;

    public NotificationPollingScheduler(
            NotificationClaimService notificationClaimService,
            WelcomeEmailDispatcher welcomeEmailDispatcher,
            @Value("${notification.polling.batch-size:100}") int batchSize,
            @Value("${notification.polling.reclaim-timeout-minutes:5}")
                    long reclaimTimeoutMinutes) {
        this.notificationClaimService = notificationClaimService;
        this.welcomeEmailDispatcher = welcomeEmailDispatcher;
        this.batchSize = batchSize;
        this.reclaimTimeoutMinutes = reclaimTimeoutMinutes;
    }

    @Scheduled(fixedDelayString = "${notification.polling.fixed-delay-ms:30000}")
    public void poll() {
        notificationClaimService.reclaimStuck(reclaimTimeoutMinutes);

        List<Notification> claimed = notificationClaimService.claim(batchSize);
        for (Notification notification : claimed) {
            // 클레임(SELECT+UPDATE) 트랜잭션은 이미 커밋된 뒤다 — 실제 SES 호출(네트워크)은 트랜잭션 밖에서 한다.
            // lockedAt 을 클레임 토큰으로 들고 있다가 완료 처리 시 그대로 넘긴다 — 발송이 오래 걸려 그 사이 재수거됐다면
            // markSent/markFailed 가 조용히 스킵한다(NotificationClaimService 참고).
            Instant claimToken = notification.getLockedAt();
            try {
                welcomeEmailDispatcher.dispatch(notification);
                notificationClaimService.markSent(notification.getId(), claimToken);
            } catch (MailSendException e) {
                log.error(
                        "알림 발송 실패. notificationId={}, errorType={}",
                        notification.getId(),
                        e.errorType());
                notificationClaimService.markFailed(
                        notification.getId(), e.errorType(), claimToken);
            } catch (RuntimeException e) {
                log.error(
                        "알림 처리 실패. notificationId={}, cause={}",
                        notification.getId(),
                        e.getClass().getSimpleName());
                notificationClaimService.markFailed(
                        notification.getId(), NotificationErrorType.UNKNOWN, claimToken);
            }
        }
    }
}
