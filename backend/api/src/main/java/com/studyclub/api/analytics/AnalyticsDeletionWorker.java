package com.studyclub.api.analytics;

import com.studyclub.api.cleanup.CleanupResult;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.analytics.*;
import java.time.Instant;
import java.util.*;
import java.util.function.Consumer;
import org.slf4j.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.client.RestClientResponseException;

@Service
public class AnalyticsDeletionWorker {
    private static final Logger log = LoggerFactory.getLogger(AnalyticsDeletionWorker.class);
    private final AccountAnalyticsRepository profiles;
    private final AccountRepository accounts;
    private final AnalyticsDeletionGateway gateway;
    private final TransactionTemplate transaction;

    public AnalyticsDeletionWorker(
            AccountAnalyticsRepository profiles,
            AccountRepository accounts,
            AnalyticsDeletionGateway gateway,
            PlatformTransactionManager manager) {
        this.profiles = profiles;
        this.accounts = accounts;
        this.gateway = gateway;
        transaction = new TransactionTemplate(manager);
        transaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    private record Target(
            Long accountId,
            String userId,
            List<String> clients,
            AnalyticsDeletionStatus ga4,
            AnalyticsDeletionStatus amplitude,
            String amplitudeIds,
            Instant amplitudeRequestedAt) {}

    public CleanupResult process(Long accountId, Instant now) {
        Target target =
                transaction.execute(
                        tx -> {
                            AccountAnalytics p = profiles.findByIdForUpdate(accountId).orElse(null);
                            if (p == null) return null;
                            if (p.getOptedOutAt() == null) {
                                if (accounts.existsById(accountId)) return null;
                                p.optOut(now);
                            }
                            if (!p.isDeletionReady(now)) return null;
                            return new Target(
                                    accountId,
                                    p.getAnalyticsUserId(),
                                    p.clientIds(),
                                    p.getGa4DeletionStatus(),
                                    p.getAmplitudeDeletionStatus(),
                                    p.getAmplitudeDeletionIds(),
                                    p.getAmplitudeDeletionRequestedAt());
                        });
        if (target == null) return CleanupResult.completed(0, 0);
        int failed = 0;
        if (target.ga4() == AnalyticsDeletionStatus.NOT_REQUESTED) {
            try {
                Set<String> clients = new LinkedHashSet<>(target.clients());
                if (target.userId() != null)
                    clients.add(AnalyticsIdentity.serverClientId(target.userId()));
                gateway.submitGa4(target.userId(), List.copyOf(clients));
                apply(target, AnalyticsProvider.GA4, AccountAnalytics::ga4Requested);
            } catch (RuntimeException e) {
                failed++;
                failure(AnalyticsProvider.GA4, e);
            }
        }
        try {
            if (target.amplitude() == AnalyticsDeletionStatus.NOT_REQUESTED) {
                String ids = gateway.submitAmplitude(target.userId());
                apply(target, AnalyticsProvider.AMPLITUDE, p -> p.amplitudeRequested(ids, now));
            } else if (target.amplitude() == AnalyticsDeletionStatus.REQUESTED
                    && gateway.amplitudeDone(
                            target.amplitudeIds(), target.amplitudeRequestedAt())) {
                apply(target, AnalyticsProvider.AMPLITUDE, AccountAnalytics::amplitudeCompleted);
            }
        } catch (RuntimeException e) {
            failed++;
            failure(AnalyticsProvider.AMPLITUDE, e);
        }

        boolean removed =
                Boolean.TRUE.equals(
                        transaction.execute(
                                tx -> {
                                    AccountAnalytics p =
                                            profiles.findByIdForUpdate(accountId).orElse(null);
                                    if (p == null || !p.canReleaseIdentifiers()) return false;
                                    if (!accounts.existsById(accountId)) profiles.delete(p);
                                    else p.clearIdentifiersAfterDeletion();
                                    return true;
                                }));
        return new CleanupResult(removed ? 1 : 0, failed, removed ? 0 : 1, false);
    }

    private void apply(
            Target target, AnalyticsProvider provider, Consumer<AccountAnalytics> change) {
        transaction.executeWithoutResult(
                tx ->
                        profiles.findByIdForUpdate(target.accountId())
                                .ifPresent(
                                        p -> {
                                            if (!Objects.equals(
                                                            p.getAnalyticsUserId(), target.userId())
                                                    || p.getOptedOutAt() == null) return;
                                            if (provider == AnalyticsProvider.GA4
                                                    && p.getGa4DeletionStatus() == target.ga4())
                                                change.accept(p);
                                            if (provider == AnalyticsProvider.AMPLITUDE
                                                    && p.getAmplitudeDeletionStatus()
                                                            == target.amplitude()
                                                    && Objects.equals(
                                                            p.getAmplitudeDeletionIds(),
                                                            target.amplitudeIds())
                                                    && Objects.equals(
                                                            p.getAmplitudeDeletionRequestedAt(),
                                                            target.amplitudeRequestedAt()))
                                                change.accept(p);
                                        }));
    }

    private void failure(AnalyticsProvider provider, RuntimeException e) {
        String category =
                e instanceof RestClientResponseException response
                        ? "HTTP_" + response.getStatusCode().value()
                        : Set.of(
                                                "DELETION_NOT_CONFIGURED",
                                                "USER_NOT_FOUND",
                                                "INVALID_DELETION_RESPONSE",
                                                "DELETION_INTERRUPTED")
                                        .contains(e.getMessage() == null ? "" : e.getMessage())
                                ? e.getMessage()
                                : e.getClass().getSimpleName();
        // 원문 예외·회원번호·외부 식별자를 기록하지 않는다.
        log.warn("analytics deletion provider={} failure={}", provider, category);
    }
}
