package com.studyclub.domain.account;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AccountConsentRepository extends JpaRepository<AccountConsent, Long> {

    List<AccountConsent> findByAccountId(Long accountId);

    /** UNIQUE(ACCOUNT_ID, CONSENT_TYPE, CONSENT_VERSION) 이라 최대 1행이다. */
    Optional<AccountConsent> findByAccountIdAndConsentTypeAndConsentVersion(
            Long accountId, ConsentType consentType, String consentVersion);
}
