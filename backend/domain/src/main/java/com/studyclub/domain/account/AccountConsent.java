package com.studyclub.domain.account;

import com.studyclub.domain.support.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;

/**
 * 회원 약관 동의 이력. 온보딩 완료 시 유형별 1행(버전 포함).
 * 약관 개정 시 같은 {@link ConsentType} 에 새 {@code consentVersion} 행을 추가한다.
 */
@Entity
@Table(
    name = "ACCOUNT_CONSENT",
    uniqueConstraints = {
        @UniqueConstraint(
            name = "uk_account_consent_account_type_version",
            columnNames = {"ACCOUNT_ID", "CONSENT_TYPE", "CONSENT_VERSION"})
    },
    indexes = {
        @Index(name = "idx_account_consent_account", columnList = "ACCOUNT_ID")
    }
)
public class AccountConsent extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "ACCOUNT_ID", nullable = false)
    private Long accountId;

    @Enumerated(EnumType.STRING)
    @Column(name = "CONSENT_TYPE", nullable = false, length = 20)
    private ConsentType consentType;

    @Column(nullable = false)
    private boolean agreed;

    @Column(name = "AGREED_AT", nullable = false)
    private Instant agreedAt;

    @Column(name = "CONSENT_VERSION", nullable = false, length = 20)
    private String consentVersion;

    protected AccountConsent() {
    }

    public AccountConsent(
            Long accountId,
            ConsentType consentType,
            boolean agreed,
            Instant agreedAt,
            String consentVersion) {
        this.accountId = accountId;
        this.consentType = consentType;
        this.agreed = agreed;
        this.agreedAt = agreedAt;
        this.consentVersion = consentVersion;
    }

    public Long getId() { return id; }
    public Long getAccountId() { return accountId; }
    public ConsentType getConsentType() { return consentType; }
    public boolean isAgreed() { return agreed; }
    public Instant getAgreedAt() { return agreedAt; }
    public String getConsentVersion() { return consentVersion; }
}
