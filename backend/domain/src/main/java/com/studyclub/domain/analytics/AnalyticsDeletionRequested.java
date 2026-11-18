package com.studyclub.domain.analytics;

import com.studyclub.common.event.DomainEvent;
import com.studyclub.common.event.EventMeta;
import java.time.Instant;

/** 분석 식별자를 이벤트에 복사하지 않는다. 재시작 시 ACCOUNT_ANALYTICS에서 미처리 건을 회수한다. */
public record AnalyticsDeletionRequested(EventMeta meta, Long accountId, Instant readyAt)
        implements DomainEvent {
    public static AnalyticsDeletionRequested of(AccountAnalytics profile) {
        return new AnalyticsDeletionRequested(
                EventMeta.now(profile.getAccountId()),
                profile.getAccountId(),
                profile.deletionReadyAt());
    }

    @Override
    public String name() {
        return "analytics.deletion_requested";
    }

    @Override
    public String aggregateType() {
        return "account_analytics";
    }

    @Override
    public String aggregateId() {
        return String.valueOf(accountId);
    }
}
