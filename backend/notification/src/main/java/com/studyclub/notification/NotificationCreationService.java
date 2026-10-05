package com.studyclub.notification;

import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountRepository;
import java.util.Map;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * {@code UserRegisteredEvent} 를 받아 웰컴메일용 {@code NOTIFICATION} 행을 만든다 (specs/notification/spec.md).
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class NotificationCreationService {

    private final AccountRepository accountRepository;
    private final NotificationTemplateRepository notificationTemplateRepository;
    private final NotificationRepository notificationRepository;

    /** 계정이나 템플릿이 없으면 로그를 남기고 종료한다. */
    // AFTER_COMMIT 에는 원래 트랜잭션 자원이 남아 있다. 별도 트랜잭션을 열어 INSERT 를 커밋한다.
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void createWelcomeEmailNotification(Long accountId) {
        // 계정 행을 잠그고 읽는다 — 회원 탈퇴(AccountDeletionService)도 같은 행을 잠그므로 둘이 직렬화된다.
        // 탈퇴가 먼저면 계정이 없어 알림을 만들지 않고, 이 리스너가 먼저면 탈퇴가 기다렸다가 방금 만든 알림까지 비식별화한다.
        Optional<Account> account = accountRepository.findByIdForUpdate(accountId);
        if (account.isEmpty()) {
            log.warn("UserRegisteredEvent accountId={} 에 해당하는 계정을 찾을 수 없습니다.", accountId);
            return;
        }

        Optional<NotificationTemplate> template =
                notificationTemplateRepository.findByEventTypeAndChannel(
                        NotificationEventType.USER_REGISTERED, NotificationChannel.EMAIL);
        if (template.isEmpty()) {
            log.error("USER_REGISTERED/EMAIL 알림 템플릿을 찾을 수 없습니다. accountId={}", accountId);
            return;
        }

        Notification notification =
                Notification.pendingImmediate(
                        NotificationEventType.USER_REGISTERED,
                        NotificationChannel.EMAIL,
                        account.get().getEmail(),
                        accountId,
                        template.get().getId(),
                        Map.of("nickname", account.get().getNickname()));
        notificationRepository.save(notification);
    }
}
