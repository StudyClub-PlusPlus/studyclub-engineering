package com.studyclub.domain.account;

import com.studyclub.domain.support.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * stage 테스트 로그인 가입 코드 (specs/stage-email-login). 메일 하나에 여러 줄이 쌓이고 확인은 맨 마지막 줄만 본다. 코드는 HMAC 으로만
 * 저장한다. {@code codeCopy} 는 EMAIL_CODE_COPY 가 켜진 stage 에서만 채운다 — 에이전트 테스터가 DB 로 읽는 칸.
 */
@Entity
@Table(
        name = "EMAIL_SIGNUP_CODE",
        indexes = @Index(name = "idx_email_signup_code_email", columnList = "EMAIL, ID"))
public class EmailSignupCode extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 255)
    private String email;

    /** HMAC-SHA256(jwt.secret, "email:code") hex */
    @Column(nullable = false, length = 64)
    private String codeHash;

    @Column(length = 6)
    private String codeCopy;

    @Column(nullable = false)
    private int attempts;

    @Column(nullable = false)
    private Instant expiresAt;

    private Instant usedAt;

    protected EmailSignupCode() {}

    public EmailSignupCode(String email, String codeHash, String codeCopy, Instant expiresAt) {
        this.email = email;
        this.codeHash = codeHash;
        this.codeCopy = codeCopy;
        this.expiresAt = expiresAt;
    }

    /** 쓸 수 없는 코드 — 이미 씀 · 만료 · 틀린 횟수 초과 */
    public boolean isDead(Instant now, int maxAttempts) {
        return usedAt != null || now.isAfter(expiresAt) || attempts >= maxAttempts;
    }

    public Long getId() {
        return id;
    }

    public String getEmail() {
        return email;
    }

    public String getCodeHash() {
        return codeHash;
    }

    public String getCodeCopy() {
        return codeCopy;
    }

    public int getAttempts() {
        return attempts;
    }
}
