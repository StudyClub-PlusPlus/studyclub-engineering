package com.studyclub.api.auth;

import static org.assertj.core.api.Assertions.assertThat;

import com.studyclub.domain.account.AccountConsent;
import com.studyclub.domain.account.ConsentType;
import java.time.Instant;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** 동의 변경 규칙 — AGREED_AT 은 "지금 값으로 정한 시각" 이다. */
class AccountConsentTest {

    private static final Instant AGREED_AT = Instant.parse("2026-01-01T00:00:00Z");
    private static final Instant LATER = Instant.parse("2026-02-01T00:00:00Z");

    private AccountConsent marketingConsent(boolean agreed) {
        return new AccountConsent(1L, ConsentType.MARKETING, agreed, AGREED_AT, "1.0");
    }

    @Test
    @DisplayName("값이 바뀌면 동의 여부와 시각을 같이 바꾼다")
    void changesAgreementAndTime() {
        AccountConsent consent = marketingConsent(true);

        consent.changeAgreement(false, LATER);

        assertThat(consent.isAgreed()).isFalse();
        assertThat(consent.getAgreedAt()).isEqualTo(LATER);
    }

    @Test
    @DisplayName("값이 지금과 같으면 시각을 그대로 둔다 — 다시 누른 시각이 아니라 정한 시각이어야 한다")
    void keepsTimeWhenValueIsSame() {
        AccountConsent consent = marketingConsent(true);

        consent.changeAgreement(true, LATER);

        assertThat(consent.isAgreed()).isTrue();
        assertThat(consent.getAgreedAt()).isEqualTo(AGREED_AT);
    }
}
