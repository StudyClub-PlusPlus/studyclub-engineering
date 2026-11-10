package com.studyclub.domain.account;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/** 발급된 refresh JWT 의 해시 — 로그아웃·탈퇴 시 여기서 지워 무효화한다. */
@Entity
@Table(name = "REFRESH_TOKEN")
public class RefreshToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** SHA-256(token) 의 16진수 표현 — 64자. 토큰 원문을 저장하지 않는다. */
    @Column(name = "TOKEN_HASH", nullable = false, length = 64, unique = true)
    private String tokenHash;

    @Column(name = "ACCOUNT_ID", nullable = false)
    private Long accountId;

    @Column(name = "EXPIRES_AT", nullable = false)
    private Instant expiresAt;

    @Column(name = "CREATED_AT", nullable = false, updatable = false)
    private Instant createdAt;

    protected RefreshToken() {}

    public RefreshToken(String tokenHash, Long accountId, Instant expiresAt) {
        this.tokenHash = tokenHash;
        this.accountId = accountId;
        this.expiresAt = expiresAt;
        this.createdAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public String getTokenHash() {
        return tokenHash;
    }

    public Long getAccountId() {
        return accountId;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }
}
