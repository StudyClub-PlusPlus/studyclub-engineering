package com.studyclub.domain.analytics;

import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AccountAnalyticsRepository extends JpaRepository<AccountAnalytics, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from AccountAnalytics p where p.accountId = :id")
    Optional<AccountAnalytics> findByIdForUpdate(@Param("id") Long id);

    @Query(
            """
            select p.accountId from AccountAnalytics p
            where p.accountId > :afterId
              and (p.optedOutAt is not null or not exists (select a.id from Account a where a.id = p.accountId))
              and (p.analyticsUserId is not null or p.gaClientIds <> ''
                   or not exists (select a.id from Account a where a.id = p.accountId))
            order by p.accountId
            """)
    List<Long> findDeletionCandidates(@Param("afterId") Long afterId, Pageable pageable);
}
