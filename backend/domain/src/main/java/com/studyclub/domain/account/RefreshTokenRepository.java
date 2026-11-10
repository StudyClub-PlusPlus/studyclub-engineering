package com.studyclub.domain.account;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Long> {

    Optional<RefreshToken> findByTokenHash(String tokenHash);

    @Modifying
    @Query("DELETE FROM RefreshToken t WHERE t.tokenHash = :tokenHash")
    void deleteByTokenHash(@Param("tokenHash") String tokenHash);

    /** 탈퇴 시 해당 계정의 모든 refresh token 을 삭제한다. */
    @Modifying
    @Query("DELETE FROM RefreshToken t WHERE t.accountId = :accountId")
    void deleteByAccountId(@Param("accountId") Long accountId);
}
