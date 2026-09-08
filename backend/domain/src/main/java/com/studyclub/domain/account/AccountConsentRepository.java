package com.studyclub.domain.account;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AccountConsentRepository extends JpaRepository<AccountConsent, Long> {

    List<AccountConsent> findByAccountId(Long accountId);
}
