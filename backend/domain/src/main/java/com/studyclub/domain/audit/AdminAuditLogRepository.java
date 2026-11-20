package com.studyclub.domain.audit;

import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** 운영 API는 수정하지 않는다. 보관 기한이 끝난 행만 정리 서비스에서 파기한다. */
public interface AdminAuditLogRepository extends JpaRepository<AdminAuditLog, Long> {
    @Query(
            "SELECT a FROM AdminAuditLog a WHERE a.id > :afterId AND a.retentionPolicy IS NOT NULL AND a.expiresAt <= :now ORDER BY a.id")
    List<AdminAuditLog> findRetentionCandidates(
            @Param("afterId") long afterId, @Param("now") Instant now, Pageable pageable);

    @Modifying
    @Query(
            "DELETE FROM AdminAuditLog a WHERE a.id IN :ids AND a.retentionPolicy IS NOT NULL AND a.expiresAt <= :now")
    int deleteExpiredIds(@Param("ids") List<Long> ids, @Param("now") Instant now);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from AdminAuditLog a where a.retentionPolicy is null order by a.id")
    List<AdminAuditLog> findWithoutRetentionForUpdate(Pageable pageable);

    long countByActionAndParticipantRoleIsNull(AdminAuditAction action);
}
