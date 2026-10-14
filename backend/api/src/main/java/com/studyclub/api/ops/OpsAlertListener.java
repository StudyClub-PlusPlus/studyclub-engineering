package com.studyclub.api.ops;

import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.UserRegisteredEvent;
import com.studyclub.domain.application.StudyApplicationSubmitted;
import java.util.LinkedHashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * 운영자가 초반에 알아야 할 도메인 이벤트를 구독해 {@link OpsAlertNotifier} 로 보낸다 (specs/ops-alerts/spec.md).
 *
 * <p>커밋 뒤({@code AFTER_COMMIT})·별도 스레드({@code @Async})에서 돈다 — 롤백된 사실은 알리지 않고, 요청을 막지 않는다. 발행하는 서비스와
 * 다른 빈이어야 한다 (같은 빈 안에서 부르면 프록시를 안 거쳐 {@code @Async} 가 무시된다). 실패는 삼킨다.
 */
@Component
public class OpsAlertListener {

    private static final Logger log = LoggerFactory.getLogger(OpsAlertListener.class);

    private final OpsAlertNotifier notifier;
    private final AccountRepository accountRepository;

    public OpsAlertListener(OpsAlertNotifier notifier, AccountRepository accountRepository) {
        this.notifier = notifier;
        this.accountRepository = accountRepository;
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onUserRegistered(UserRegisteredEvent event) {
        try {
            // UserRegisteredEvent 는 accountId 만 싣는다 (기존 계약) — 표시 필드는 커밋된 행에서 읽는다
            accountRepository
                    .findById(event.accountId())
                    .ifPresent(
                            account -> {
                                Map<String, String> fields = new LinkedHashMap<>();
                                fields.put("닉네임", account.getNickname());
                                fields.put("이메일", OpsAlertNotifier.maskEmail(account.getEmail()));
                                notifier.send(OpsAlertNotifier.Level.INFO, "신규 가입", fields);
                            });
        } catch (RuntimeException e) {
            log.warn("ops-alert: 가입 알림 실패 ({})", e.getClass().getSimpleName());
        }
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onStudyApplicationSubmitted(StudyApplicationSubmitted event) {
        try {
            Map<String, String> fields = new LinkedHashMap<>();
            fields.put("스터디", event.studyTitle() + " (#" + event.studyId() + ")");
            fields.put("신청자", event.applicantNickname());
            fields.put("신청 ID", String.valueOf(event.applicationId()));
            notifier.send(OpsAlertNotifier.Level.INFO, "스터디 신청 접수", fields);
        } catch (RuntimeException e) {
            log.warn("ops-alert: 신청 알림 실패 ({})", e.getClass().getSimpleName());
        }
    }
}
