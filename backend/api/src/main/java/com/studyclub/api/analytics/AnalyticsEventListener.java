package com.studyclub.api.analytics;

import com.studyclub.domain.account.UserRegisteredEvent;
import com.studyclub.domain.application.StudyApplicationRepository;
import com.studyclub.domain.application.StudyApplicationSubmitted;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * 도메인 이벤트를 Amplitude 서버 이벤트로 옮긴다 (specs/analytics/spec.md). 서버가 정본이라 애드블록·탭 닫힘에 빠지지 않는다.
 *
 * <ul>
 *   <li>{@code user.registered} → {@code User Signed Up}
 *   <li>계정의 첫 {@code study_application.submitted} → {@code
 *       Activated{activation_action=study_applied}}
 * </ul>
 *
 * <p>커밋 뒤·별도 스레드에서 돈다. 실패는 삼킨다 — 이미 커밋된 사실을 되돌릴 수 없다.
 */
@Component
public class AnalyticsEventListener {

    private static final Logger log = LoggerFactory.getLogger(AnalyticsEventListener.class);

    private final AmplitudeClient amplitude;
    private final StudyApplicationRepository applicationRepository;

    public AnalyticsEventListener(
            AmplitudeClient amplitude, StudyApplicationRepository applicationRepository) {
        this.amplitude = amplitude;
        this.applicationRepository = applicationRepository;
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onUserRegistered(UserRegisteredEvent event) {
        try {
            amplitude.send(
                    "User Signed Up",
                    event.accountId(),
                    "user_signed_up_account_" + event.accountId(),
                    event.meta().occurredAt(),
                    Map.of("method", "google", "signup_surface", "onboarding"));
        } catch (RuntimeException e) {
            log.warn(
                    "amplitude: 가입 이벤트 실패 eventId={} ({})",
                    event.meta().eventId(),
                    e.getClass().getSimpleName());
        }
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onStudyApplicationSubmitted(StudyApplicationSubmitted event) {
        if (!amplitude.enabled()) {
            return;
        }
        try {
            // 활성화는 계정당 한 번 — 첫 신청일 때만. insert_id 도 계정 기준이라 재전송돼도 중복이 지워진다
            if (applicationRepository.findByAccountId(event.accountId()).size() != 1) {
                return;
            }
            amplitude.send(
                    "Activated",
                    event.accountId(),
                    "activated_account_" + event.accountId(),
                    event.meta().occurredAt(),
                    Map.of(
                            "activation_action",
                            "study_applied",
                            "study_id",
                            String.valueOf(event.studyId())));
        } catch (RuntimeException e) {
            log.warn(
                    "amplitude: 활성화 이벤트 실패 eventId={} ({})",
                    event.meta().eventId(),
                    e.getClass().getSimpleName());
        }
    }
}
