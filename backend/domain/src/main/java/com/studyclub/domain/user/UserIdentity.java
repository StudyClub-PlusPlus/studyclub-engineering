package com.studyclub.domain.user;

import com.studyclub.domain.support.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;

@Entity
@Table(
    name = "USER_IDENTITY",
    uniqueConstraints = {
        @UniqueConstraint(name = "uk_user_identity_user_issuer", columnNames = {"USER_ID", "ISSUER"}),
        @UniqueConstraint(name = "uk_user_identity_issuer_provider", columnNames = {"ISSUER", "PROVIDER_USER_ID"})
    }
)
public class UserIdentity extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "USER_ID", nullable = false)
    private Long userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Issuer issuer;

    @Column(name = "PROVIDER_USER_ID", nullable = false)
    private String providerUserId;

    @Column(name = "LAST_LOGIN_AT")
    private Instant lastLoginAt;

    protected UserIdentity() {
    }

    public UserIdentity(Long userId, Issuer issuer, String providerUserId, Instant lastLoginAt) {
        this.userId = userId;
        this.issuer = issuer;
        this.providerUserId = providerUserId;
        this.lastLoginAt = lastLoginAt;
    }

    public Long getId() { return id; }
    public Long getUserId() { return userId; }
    public Issuer getIssuer() { return issuer; }
    public String getProviderUserId() { return providerUserId; }
    public Instant getLastLoginAt() { return lastLoginAt; }

    public void recordLogin(Instant at) {
        this.lastLoginAt = at;
    }
}
