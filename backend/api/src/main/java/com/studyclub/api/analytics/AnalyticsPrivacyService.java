package com.studyclub.api.analytics;

import com.studyclub.api.audit.AdminAuditRecorder;
import com.studyclub.common.error.*;
import com.studyclub.domain.account.*;
import com.studyclub.domain.analytics.*;
import com.studyclub.domain.audit.AdminAuditLog;
import com.studyclub.domain.feedback.FeedbackRepository;
import java.time.Instant;
import java.util.function.Consumer;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AnalyticsPrivacyService {
    private final AccountRepository accounts;
    private final AccountAnalyticsRepository profiles;
    private final FeedbackRepository feedbacks;
    private final AdminAuditRecorder audits;
    private final AnalyticsIdentity identity;
    private final ApplicationEventPublisher events;

    public AnalyticsPrivacyService(
            AccountRepository accounts,
            AccountAnalyticsRepository profiles,
            FeedbackRepository feedbacks,
            AdminAuditRecorder audits,
            AnalyticsIdentity identity,
            ApplicationEventPublisher events) {
        this.accounts = accounts;
        this.profiles = profiles;
        this.feedbacks = feedbacks;
        this.audits = audits;
        this.identity = identity;
        this.events = events;
    }

    public record View(String userId, boolean enabled, Instant optedOutAt) {}

    /** 관리자에게는 분석 식별자 자체를 반환하지 않는다. */
    public record AdminView(
            boolean accountExists,
            boolean enabled,
            boolean canOptOut,
            Instant optedOutAt,
            AnalyticsDeletionStatus ga4DeletionStatus,
            AnalyticsDeletionStatus amplitudeDeletionStatus) {}

    private View view(AccountAnalytics profile) {
        boolean enabled = identity.configured() && profile.isEnabled();
        return new View(
                enabled ? profile.getAnalyticsUserId() : null, enabled, profile.getOptedOutAt());
    }

    @Transactional
    public void initialize(Long accountId) {
        lockedProfile(accountId, true);
    }

    private AccountAnalytics lockedProfile(Long accountId, boolean createIdentity) {
        accounts.findByIdForUpdate(accountId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
        AccountAnalytics profile =
                profiles.findByIdForUpdate(accountId)
                        .orElseGet(() -> new AccountAnalytics(accountId));
        if (createIdentity
                && identity.configured()
                && profile.getAnalyticsUserId() == null
                && profile.getOptedOutAt() == null)
            profile.assignIdentity(identity.forAccount(accountId));
        return profiles.save(profile);
    }

    @Transactional
    public View current(Long accountId) {
        return view(lockedProfile(accountId, true));
    }

    @Transactional(readOnly = true)
    public AdminView adminView(Long accountId) {
        boolean exists = accounts.existsById(accountId);
        AccountAnalytics p = profiles.findById(accountId).orElse(null);
        return new AdminView(
                exists,
                exists && p != null && identity.configured() && p.isEnabled(),
                exists && (p == null || p.getOptedOutAt() == null),
                p == null ? null : p.getOptedOutAt(),
                p == null ? null : p.getGa4DeletionStatus(),
                p == null ? null : p.getAmplitudeDeletionStatus());
    }

    @Transactional
    public View registerBrowser(Long accountId, String clientId) {
        AccountAnalytics profile = lockedProfile(accountId, true);
        if (identity.configured() && profile.isEnabled()) profile.rememberClientId(clientId);
        return view(profile);
    }

    /** 전송과 중단은 같은 회원 잠금으로 직렬화한다. */
    @Transactional
    public void whenAllowed(Long accountId, String clientId, Consumer<String> send) {
        if (!identity.configured() || accounts.findByIdForUpdate(accountId).isEmpty()) return;
        AccountAnalytics profile = lockedProfile(accountId, true);
        if (!profile.isEnabled()) return;
        if (clientId != null && clientId.matches("[0-9]{1,20}\\.[0-9]{1,20}"))
            profile.rememberClientId(clientId);
        send.accept(profile.getAnalyticsUserId());
    }

    /** 중단 설정과 감사 기록은 함께 성공해야 하므로 한 트랜잭션으로 묶는다. */
    @Transactional
    public AdminView optOut(Long actorId, Long feedbackId) {
        Long target =
                feedbacks
                        .findAccountIdById(feedbackId)
                        .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
        AccountAnalytics profile = lockedProfile(target, false);
        if (profile.optOut(Instant.now())) {
            audits.record(AdminAuditLog.analyticsOptOut(actorId, target, feedbackId));
            events.publishEvent(AnalyticsDeletionRequested.of(profile));
        }
        return adminView(target);
    }

    /** 회원 삭제와 같은 트랜잭션. 식별자를 지우면 외부 삭제를 재시도할 수 없으므로 행을 유지한다. */
    @Transactional
    public void onAccountDeletion(Long accountId) {
        profiles.findByIdForUpdate(accountId)
                .ifPresent(
                        profile -> {
                            profile.optOut(Instant.now());
                            events.publishEvent(AnalyticsDeletionRequested.of(profile));
                        });
    }
}
