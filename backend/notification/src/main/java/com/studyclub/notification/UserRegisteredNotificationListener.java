package com.studyclub.notification;

import com.studyclub.domain.account.UserRegisteredEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * {@code UserRegisteredEvent} 를 구독해 웰컴메일용 {@code NOTIFICATION} 행을 만든다. {@code api/auth} 에 있던 로그 전용
 * 플레이스홀더를 대신한다 (specs/notification/spec.md).
 *
 * <p><b>{@code AFTER_COMMIT}</b> — 이미 병합된 온보딩 스펙·코드가 이 phase 로 확정해 배포돼 있다. ACCOUNT 트랜잭션이 이미 커밋된 뒤에
 * 이벤트가 나가므로, 여기서 새로 만드는 {@code NOTIFICATION} INSERT 는 그것과 원자적으로 묶이지 않는다는 것도 이미 알려진 제약이다.
 */
@Component
@Slf4j
@RequiredArgsConstructor
public class UserRegisteredNotificationListener {

    private final NotificationCreationService notificationCreationService;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onUserRegistered(UserRegisteredEvent event) {
        try {
            notificationCreationService.createWelcomeEmailNotification(event.accountId());
        } catch (RuntimeException e) {
            // 이미 커밋된 회원가입과 알림 저장 실패를 분리하고, 수신자 정보 없이 원인을 기록한다.
            log.error(
                    "웰컴메일 알림 생성 실패. accountId={}, cause={}",
                    event.accountId(),
                    e.getClass().getSimpleName());
        }
    }
}
