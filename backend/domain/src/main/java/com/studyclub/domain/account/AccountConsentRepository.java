package com.studyclub.domain.account;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;

public interface AccountConsentRepository extends JpaRepository<AccountConsent, Long> {

    List<AccountConsent> findByAccountId(Long accountId);

    /** UNIQUE(ACCOUNT_ID, CONSENT_TYPE, CONSENT_VERSION) 이라 최대 1행이다. */
    Optional<AccountConsent> findByAccountIdAndConsentTypeAndConsentVersion(
            Long accountId, ConsentType consentType, String consentVersion);

    /**
     * 회원 탈퇴 — 동의 이력 파기. Flyway 스키마의 FK cascade 에 기대지 않는다(stage·H2 는 Hibernate 가 스키마를 만들어 FK 가 없다).
     */
    @Transactional
    void deleteByAccountId(Long accountId);
}
