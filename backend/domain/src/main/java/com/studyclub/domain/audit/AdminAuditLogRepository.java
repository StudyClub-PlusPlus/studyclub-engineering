package com.studyclub.domain.audit;

import java.time.Instant;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** 운영 API는 수정하지 않는다. 보관 기한이 끝난 행만 정리 서비스에서 파기한다. */
public interface AdminAuditLogRepository extends JpaRepository<AdminAuditLog, Long> {
    @Query(
            "SELECT a FROM AdminAuditLog a WHERE a.id > :afterId AND a.createdAt <= :before ORDER BY a.id")
    List<AdminAuditLog> findRetentionCandidates(
            @Param("afterId") long afterId, @Param("before") Instant before, Pageable pageable);

    @Modifying
    @Query("DELETE FROM AdminAuditLog a WHERE a.id IN :ids")
    int deleteExpiredIds(@Param("ids") List<Long> ids);

    long countByActionAndParticipantRoleIsNull(AdminAuditAction action);
}
