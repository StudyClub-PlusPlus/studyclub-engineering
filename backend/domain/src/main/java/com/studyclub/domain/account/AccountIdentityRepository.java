package com.studyclub.domain.account;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;

public interface AccountIdentityRepository extends JpaRepository<AccountIdentity, Long> {

    Optional<AccountIdentity> findByIssuerAndProviderAccountId(
            Issuer issuer, String providerAccountId);

    /** 로그인 수단이 하나라도 붙어 있는가 — 소셜 로그인(#49) 전에 가입한 계정은 하나도 없다 */
    boolean existsByAccountId(Long accountId);

    /** 회원 탈퇴 — 로그인 수단 파기. 이 삭제가 빠지면 재가입 시 UNIQUE(ISSUER, PROVIDER_ACCOUNT_ID) 에 걸린다. */
    @Transactional
    void deleteByAccountId(Long accountId);
}
