package com.studyclub.domain.account;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AccountIdentityRepository extends JpaRepository<AccountIdentity, Long> {

    Optional<AccountIdentity> findByIssuerAndProviderAccountId(
            Issuer issuer, String providerAccountId);
}
