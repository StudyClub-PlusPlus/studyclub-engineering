package com.studyclub.domain.account;

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

/** 한 회원의 소셜 로그인 수단. 식별은 {@code (issuer, providerAccountId)} — 이메일이 아니라 OAuth {@code sub}. */
@Entity
@Table(
        name = "ACCOUNT_IDENTITY",
        uniqueConstraints = {
            @UniqueConstraint(
                    name = "uk_account_identity_account_issuer",
                    columnNames = {"ACCOUNT_ID", "ISSUER"}),
            @UniqueConstraint(
                    name = "uk_account_identity_issuer_provider",
                    columnNames = {"ISSUER", "PROVIDER_ACCOUNT_ID"})
        })
public class AccountIdentity extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "ACCOUNT_ID", nullable = false)
    private Long accountId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Issuer issuer;

    /** OAuth 제공자 {@code sub}. */
    @Column(name = "PROVIDER_ACCOUNT_ID", nullable = false)
    private String providerAccountId;

    /** 제공자가 준 이메일 원본. ACCOUNT.EMAIL 과 다를 수 있다. */
    @Column(name = "PROVIDER_EMAIL", nullable = false, length = 255)
    private String providerEmail;

    @Column(name = "LAST_LOGIN_AT")
    private Instant lastLoginAt;

    protected AccountIdentity() {}

    public AccountIdentity(
            Long accountId,
            Issuer issuer,
            String providerAccountId,
            String providerEmail,
            Instant lastLoginAt) {
        this.accountId = accountId;
        this.issuer = issuer;
        this.providerAccountId = providerAccountId;
        this.providerEmail = providerEmail;
        this.lastLoginAt = lastLoginAt;
    }

    public Long getId() {
        return id;
    }

    public Long getAccountId() {
        return accountId;
    }

    public Issuer getIssuer() {
        return issuer;
    }

    public String getProviderAccountId() {
        return providerAccountId;
    }

    public String getProviderEmail() {
        return providerEmail;
    }

    public Instant getLastLoginAt() {
        return lastLoginAt;
    }

    public void recordLogin(Instant at) {
        this.lastLoginAt = at;
    }
}
