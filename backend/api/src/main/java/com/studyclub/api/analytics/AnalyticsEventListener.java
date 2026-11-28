package com.studyclub.api.analytics;

import com.studyclub.common.event.EventMeta;
import com.studyclub.domain.account.AccountActivatedEvent;
import com.studyclub.domain.account.AccountIdentityRepository;
import com.studyclub.domain.account.UserRegisteredEvent;
import com.studyclub.domain.event.ClubEventCancelledEvent;
import com.studyclub.domain.event.ClubEventRegistrationSubmittedEvent;
import com.studyclub.domain.event.ClubEventRegistrationsCancelledEvent;
import com.studyclub.domain.event.registration.ClubEventRegistration;
import com.studyclub.domain.event.registration.ClubEventRegistrationRepository;
import java.util.LinkedHashMap;
import java.util.List;
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
 *   <li>{@code account.activated} (첫 스터디 신청 또는 첫 행사 신청) → {@code
 *       Activated{activation_action=study_applied|event_applied}}
 *   <li>{@code club_event.registration_submitted} → {@code Event Registration Completed}
 *   <li>{@code club_event.registrations_cancelled} → {@code Event Registration Cancelled}
 *   <li>{@code club_event.cancelled} → 함께 취소된 신청마다 {@code Event Registration
 *       Cancelled{cancel_type=event_cancelled}}
 * </ul>
 *
 * <p>커밋 뒤·별도 스레드에서 돈다. 실패는 삼킨다 — 이미 커밋된 사실을 되돌릴 수 없다.
 */
@Component
public class AnalyticsEventListener {

    private static final Logger log = LoggerFactory.getLogger(AnalyticsEventListener.class);

    private final AnalyticsPrivacyService privacy;
    private final AmplitudeClient amplitude;
    private final Ga4Client ga4;
    private final ClubEventRegistrationRepository registrationRepository;
    private final AccountIdentityRepository identityRepository;

    public AnalyticsEventListener(
            AmplitudeClient amplitude,
            Ga4Client ga4,
            ClubEventRegistrationRepository registrationRepository,
            AccountIdentityRepository identityRepository,
            AnalyticsPrivacyService privacy) {
        this.privacy = privacy;
        this.amplitude = amplitude;
        this.ga4 = ga4;
        this.registrationRepository = registrationRepository;
        this.identityRepository = identityRepository;
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onUserRegistered(UserRegisteredEvent event) {
        try {
            String method = signupMethod(event.accountId());
            privacy.whenAllowed(
                    event.accountId(),
                    event.gaClientId(),
                    analyticsId -> {
                        amplitude.send(
                                "User Signed Up",
                                analyticsId,
                                "user_signed_up_" + analyticsId,
                                event.meta().occurredAt(),
                                Map.of("method", method, "signup_surface", "onboarding"));
                        ga4.send(
                                "sign_up",
                                analyticsId,
                                event.gaClientId(),
                                Map.of("method", method));
                    });
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

    /**
     * 첫 활성화 — 신청 트랜잭션이 {@code ACCOUNT.ACTIVATED_AT} 을 채웠을 때만 난다. insert_id 가 계정 기준이라 재전송돼도 중복이
     * 지워진다.
     */
    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onAccountActivated(AccountActivatedEvent event) {
        if (!amplitude.enabled() && !ga4.enabled()) {
            return;
        }
        try {
            String action = event.action().name().toLowerCase(Locale.ROOT);
            Map<String, Object> properties = new LinkedHashMap<>();
            properties.put("activation_action", action);
            if (event.studyId() != null) {
                properties.put("study_id", String.valueOf(event.studyId()));
            }
            if (event.clubEventId() != null) {
                properties.put("event_id", String.valueOf(event.clubEventId()));
            }
            privacy.whenAllowed(
                    event.accountId(),
                    null,
                    analyticsId -> {
                        amplitude.send(
                                "Activated",
                                analyticsId,
                                "activated_" + analyticsId,
                                event.meta().occurredAt(),
                                properties);
                        ga4.send(
                                "activated",
                                analyticsId,
                                null,
                                Map.of("activation_action", action));
                    });
        } catch (RuntimeException e) {
            log.warn(
                    "amplitude: 활성화 이벤트 실패 eventId={} ({})",
                    event.meta().eventId(),
                    e.getClass().getSimpleName());
        }
    }

    /** 행사 신청 완료 — 접수 상태(확인 대기 · 참가 확정)와 함께. 같은 키의 재시도는 새 신청을 만들지 않아 이 이벤트도 다시 나지 않는다. */
    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onEventRegistrationSubmitted(ClubEventRegistrationSubmittedEvent event) {
        if (!amplitude.enabled()) {
            return;
        }
        try {
            registrationRepository
                    .findById(event.registrationId())
                    .ifPresent(
                            registration ->
                                    privacy.whenAllowed(
                                            registration.getAccountId(),
                                            null,
                                            analyticsId ->
                                                    amplitude.send(
                                                            "Event Registration Completed",
                                                            analyticsId,
                                                            "event_registration_completed_"
                                                                    + registration.getId(),
                                                            event.meta().occurredAt(),
                                                            Map.of(
                                                                    "event_id",
                                                                    String.valueOf(
                                                                            event.clubEventId()),
                                                                    "registration_id",
                                                                    String.valueOf(
                                                                            registration.getId()),
                                                                    "channel",
                                                                    lower(
                                                                            registration
                                                                                    .getChannel()),
                                                                    "status",
                                                                    lower(event.status())))));
        } catch (RuntimeException e) {
            log.warn(
                    "amplitude: 행사 신청 이벤트 실패 eventId={} ({})",
                    event.meta().eventId(),
                    e.getClass().getSimpleName());
        }
    }

    /** 행사 신청 취소 완료 (본인 · 운영진 개별) — 바꾼 신청마다 한 건. 탈퇴 취소는 이 도메인 이벤트가 나지 않아 보내지 않는다. */
    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onEventRegistrationsCancelled(ClubEventRegistrationsCancelledEvent event) {
        sendRegistrationsCancelled(
                event.registrationIds(), event.clubEventId(), lower(event.cause()), event.meta());
    }

    /** 행사 전체 취소 — 함께 취소된 신청마다 신청자 기준으로 한 건. 바뀐 신청이 없으면 보내지 않는다. */
    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onClubEventCancelled(ClubEventCancelledEvent event) {
        sendRegistrationsCancelled(
                event.cancelledRegistrationIds(),
                event.clubEventId(),
                "event_cancelled",
                event.meta());
    }

    private void sendRegistrationsCancelled(
            List<Long> registrationIds, Long clubEventId, String cancelType, EventMeta meta) {
        if (!amplitude.enabled() || registrationIds.isEmpty()) {
            return;
        }
        for (ClubEventRegistration registration :
                registrationRepository.findAllById(registrationIds)) {
            try {
                privacy.whenAllowed(
                        registration.getAccountId(),
                        null,
                        analyticsId ->
                                amplitude.send(
                                        "Event Registration Cancelled",
                                        analyticsId,
                                        "event_registration_cancelled_" + registration.getId(),
                                        meta.occurredAt(),
                                        Map.of(
                                                "event_id",
                                                String.valueOf(clubEventId),
                                                "registration_id",
                                                String.valueOf(registration.getId()),
                                                "channel",
                                                lower(registration.getChannel()),
                                                "cancel_type",
                                                cancelType)));
            } catch (RuntimeException e) {
                log.warn(
                        "amplitude: 행사 취소 이벤트 실패 eventId={} ({})",
                        meta.eventId(),
                        e.getClass().getSimpleName());
            }
        }
    }

    private static String lower(Enum<?> value) {
        return value.name().toLowerCase(Locale.ROOT);
    }
}
