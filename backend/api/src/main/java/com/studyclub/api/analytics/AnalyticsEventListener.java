package com.studyclub.api.analytics;

import com.studyclub.domain.account.AccountIdentityRepository;
import com.studyclub.domain.account.UserRegisteredEvent;
import com.studyclub.domain.application.StudyApplicationRepository;
import com.studyclub.domain.application.StudyApplicationSubmitted;
import java.util.Locale;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * 도메인 이벤트를 Amplitude 서버 이벤트로 옮긴다 (GA4 Measurement Protocol 로도 sign_up·activated 를 함께 보낸다)
 * (specs/analytics/spec.md). 서버가 정본이라 애드블록·탭 닫힘에 빠지지 않는다.
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
    private final Ga4Client ga4;
    private final StudyApplicationRepository applicationRepository;
    private final AccountIdentityRepository identityRepository;

    public AnalyticsEventListener(
            AmplitudeClient amplitude,
            Ga4Client ga4,
            StudyApplicationRepository applicationRepository,
            AccountIdentityRepository identityRepository) {
        this.amplitude = amplitude;
        this.ga4 = ga4;
        this.applicationRepository = applicationRepository;
        this.identityRepository = identityRepository;
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onUserRegistered(UserRegisteredEvent event) {
        try {
            String method = signupMethod(event.accountId());
            amplitude.send(
                    "User Signed Up",
                    event.accountId(),
                    "user_signed_up_account_" + event.accountId(),
                    event.meta().occurredAt(),
                    Map.of("method", method, "signup_surface", "onboarding"));
            ga4.send("sign_up", event.accountId(), event.gaClientId(), Map.of("method", method));
        } catch (RuntimeException e) {
            log.warn(
                    "amplitude: 가입 이벤트 실패 eventId={} ({})",
                    event.meta().eventId(),
                    e.getClass().getSimpleName());
        }
    }

    /** 가입한 로그인 수단 (google·apple). 가입 시점엔 수단이 하나뿐이다. 못 찾으면 google — 애플 이전 가입은 전부 구글이다 */
    private String signupMethod(Long accountId) {
        return identityRepository.findByAccountId(accountId).stream()
                .findFirst()
                .map(identity -> identity.getIssuer().name().toLowerCase(Locale.ROOT))
                .orElse("google");
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onStudyApplicationSubmitted(StudyApplicationSubmitted event) {
        if (!amplitude.enabled() && !ga4.enabled()) {
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
            // 사용자 요청 맥락이 없어 합성 client_id — GA4 유입 귀속은 안 된다
            ga4.send(
                    "activated",
                    event.accountId(),
                    null,
                    Map.of("activation_action", "study_applied"));
        } catch (RuntimeException e) {
            log.warn(
                    "amplitude: 활성화 이벤트 실패 eventId={} ({})",
                    event.meta().eventId(),
                    e.getClass().getSimpleName());
        }
    }
}
