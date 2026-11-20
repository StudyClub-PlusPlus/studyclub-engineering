package com.studyclub.domain.account;

import java.time.Instant;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

public interface EmailSignupCodeRepository extends JpaRepository<EmailSignupCode, Long> {

    Optional<EmailSignupCode> findFirstByEmailOrderByIdDesc(String email);

    long countByEmailAndCreatedAtAfter(String email, Instant after);

    /** 틀린 횟수 +1 — 동시에 틀려도 max 를 넘지 않게 조건부로. 반영된 행 수(0 이면 이미 죽은 코드) */
    @Transactional
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(
            "update EmailSignupCode c set c.attempts = c.attempts + 1"
                    + " where c.id = :id and c.attempts < :max and c.usedAt is null")
    int addAttempt(@Param("id") Long id, @Param("max") int max);

    /** 한 번만 — 아직 안 쓴 행만 쓴 것으로 표시. 반영된 행 수(0 이면 이미 씀) */
    @Transactional
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update EmailSignupCode c set c.usedAt = :now where c.id = :id and c.usedAt is null")
    int markUsed(@Param("id") Long id, @Param("now") Instant now);
}
