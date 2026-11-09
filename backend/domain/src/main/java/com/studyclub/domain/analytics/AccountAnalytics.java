package com.studyclub.domain.analytics;

import com.studyclub.domain.support.BaseEntity;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** 수집 설정과 외부 삭제 진행을 회원당 한 행에 보관한다. ACCOUNT와 삭제 cascade를 두지 않는다. */
@Entity
@Table(name = "ACCOUNT_ANALYTICS")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class AccountAnalytics extends BaseEntity {
    public static final long COLLECTION_DRAIN_SECONDS = 90;

    @Id
    @Column(name = "ACCOUNT_ID")
    private Long accountId;

    @Column(name = "ANALYTICS_USER_ID", length = 100)
    private String analyticsUserId;

    @Column(name = "OPTED_OUT_AT")
    private Instant optedOutAt;

    @Column(name = "GA_CLIENT_IDS", columnDefinition = "text", nullable = false)
    private String gaClientIds = "";

    @Enumerated(EnumType.STRING)
    @Column(name = "GA4_DELETION_STATUS", nullable = false, length = 20)
    private AnalyticsDeletionStatus ga4DeletionStatus = AnalyticsDeletionStatus.NOT_REQUESTED;

    @Enumerated(EnumType.STRING)
    @Column(name = "AMPLITUDE_DELETION_STATUS", nullable = false, length = 20)
    private AnalyticsDeletionStatus amplitudeDeletionStatus = AnalyticsDeletionStatus.NOT_REQUESTED;

    @Column(name = "AMPLITUDE_DELETION_IDS", columnDefinition = "text")
    private String amplitudeDeletionIds;

    @Column(name = "AMPLITUDE_DELETION_REQUESTED_AT")
    private Instant amplitudeDeletionRequestedAt;

    public AccountAnalytics(Long accountId) {
        this.accountId = Objects.requireNonNull(accountId);
    }

    public void assignIdentity(String id) {
        if (analyticsUserId != null || optedOutAt != null) return;
        analyticsUserId = Objects.requireNonNull(id);
    }

    public boolean isEnabled() {
        return analyticsUserId != null && optedOutAt == null;
    }

    public boolean optOut(Instant now) {
        if (optedOutAt != null) return false;
        optedOutAt = Objects.requireNonNull(now);
        // 식별자를 한 번도 만든 적이 없는 계정은 외부 삭제 대상이 없다.
        if (analyticsUserId == null && gaClientIds.isEmpty()) {
            ga4DeletionStatus = AnalyticsDeletionStatus.DONE;
            amplitudeDeletionStatus = AnalyticsDeletionStatus.DONE;
        }
        return true;
    }

    public Instant deletionReadyAt() {
        return optedOutAt == null ? null : optedOutAt.plusSeconds(COLLECTION_DRAIN_SECONDS);
    }

    public boolean isDeletionReady(Instant now) {
        return optedOutAt != null && !deletionReadyAt().isAfter(now);
    }

    public void ga4Requested() {
        if (ga4DeletionStatus == AnalyticsDeletionStatus.NOT_REQUESTED)
            ga4DeletionStatus = AnalyticsDeletionStatus.REQUESTED;
    }

    public void amplitudeRequested(String ids, Instant now) {
        if (amplitudeDeletionStatus != AnalyticsDeletionStatus.NOT_REQUESTED) return;
        if (ids == null || ids.isBlank() || ids.equals("[]"))
            throw new IllegalArgumentException("Deletion IDs required");
        amplitudeDeletionIds = ids;
        amplitudeDeletionRequestedAt = Objects.requireNonNull(now);
        amplitudeDeletionStatus = AnalyticsDeletionStatus.REQUESTED;
    }

    public void amplitudeCompleted() {
        if (amplitudeDeletionStatus != AnalyticsDeletionStatus.REQUESTED)
            throw new IllegalStateException("Deletion not requested");
        amplitudeDeletionStatus = AnalyticsDeletionStatus.DONE;
        amplitudeDeletionIds = null;
    }

    /** GA의 모든 식별자 접수와 Amplitude 완료 이후 로컬 식별자를 정리한다. GA 실제 완료를 뜻하지 않는다. */
    public boolean canReleaseIdentifiers() {
        return ga4DeletionStatus != AnalyticsDeletionStatus.NOT_REQUESTED
                && amplitudeDeletionStatus == AnalyticsDeletionStatus.DONE;
    }

    public void clearIdentifiersAfterDeletion() {
        if (optedOutAt == null || !canReleaseIdentifiers())
            throw new IllegalStateException("Deletion not complete");
        analyticsUserId = null;
        gaClientIds = "";
        amplitudeDeletionIds = null;
        amplitudeDeletionRequestedAt = null;
    }

    public List<String> clientIds() {
        return gaClientIds.isEmpty() ? List.of() : List.of(gaClientIds.split(","));
    }

    public void rememberClientId(String clientId) {
        if (!isEnabled() || clientIds().contains(clientId)) return;
        if (!clientId.matches("[0-9]{1,20}\\.[0-9]{1,20}"))
            throw new IllegalArgumentException("Invalid client ID");
        if (clientIds().size() >= 128)
            throw new IllegalStateException("Client ID capacity reached");
        gaClientIds = gaClientIds.isEmpty() ? clientId : gaClientIds + "," + clientId;
    }
}
