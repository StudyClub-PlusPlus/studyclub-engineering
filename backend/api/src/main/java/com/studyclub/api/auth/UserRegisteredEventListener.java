package com.studyclub.api.auth;

import com.studyclub.domain.account.UserRegisteredEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * {@code UserRegisteredEvent} 소비. 실제 웰컴메일 발송은 알림팀 담당이라
 * (specs/user-onboarding/spec.md) 여기서는 "커밋 후 1회 발행됐다"만 로그로 남긴다 —
 * 이 코드베이스에는 아직 메일/큐 인프라가 없다.
 *
 * <p>{@code AFTER_COMMIT} — 저장이 실패했는데 이벤트가 나가는 일을 막는다.
 */
@Component
public class UserRegisteredEventListener {

    private static final Logger log = LoggerFactory.getLogger(UserRegisteredEventListener.class);

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onUserRegistered(UserRegisteredEvent event) {
        log.info("UserRegisteredEvent accountId={}", event.accountId());
    }
}
