package com.studyclub.domain.account;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;

public interface AccountConsentRepository extends JpaRepository<AccountConsent, Long> {

    List<AccountConsent> findByAccountId(Long accountId);

    /**
     * 회원 탈퇴 — 동의 이력 파기. Flyway 스키마의 FK cascade 에 기대지 않는다(stage·H2 는 Hibernate 가 스키마를 만들어 FK 가 없다).
     */
    @Transactional
    void deleteByAccountId(Long accountId);
}
