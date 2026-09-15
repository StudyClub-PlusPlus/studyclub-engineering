package com.studyclub.notification;

import java.time.Instant;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface NotificationRepository extends JpaRepository<Notification, Long> {

    /** 백오피스 발송 이력 조회 — 볼륨이 아직 작아 전체를 가져와 Java 에서 필터·페이지한다(StudyListService 와 동일한 방식). */
    List<Notification> findAllByOrderByCreatedAtDesc();

    /**
     * 다중 서버 환경에서 같은 PENDING 행을 두 인스턴스가 동시에 집어가지 않도록 잠근다. InnoDB 가 행 락 획득을 원자적으로 처리하므로 이 SELECT 자체가
     * 클레임이다 — 애플리케이션이 조율할 필요가 없다 (specs/notification/spec.md).
     *
     * <p>이 메서드는 반드시 뒤이은 {@link #markProcessing} bulk UPDATE 와 같은 트랜잭션(같은 커넥션) 안에서 호출한다. 트랜잭션이 커밋되기
     * 전까지 락이 유지된다.
     */
    @Query(
            value =
                    """
            SELECT ID
            FROM NOTIFICATION
            WHERE STATUS = 'PENDING'
              AND (SCHEDULED_AT IS NULL OR SCHEDULED_AT <= :now)
            ORDER BY COALESCE(SCHEDULED_AT, CREATED_AT)
            LIMIT :batchSize
            FOR UPDATE SKIP LOCKED
            """,
            nativeQuery = true)
    List<Long> findClaimableIds(@Param("batchSize") int batchSize, @Param("now") Instant now);

    @Modifying
    @Query(
            "update Notification n set n.status = :status, n.lockedAt = :lockedAt where n.id in :ids")
    void markProcessing(
            @Param("ids") List<Long> ids,
            @Param("status") NotificationStatus status,
            @Param("lockedAt") Instant lockedAt);

    /** 재수거 — {@code lockedAt} 기준 컷오프를 넘겨 멈춘 PROCESSING 행을 다시 PENDING 으로 되돌린다. */
    @Modifying
    @Query(
            "update Notification n set n.status = :pending, n.lockedAt = null "
                    + "where n.status = :processing and n.lockedAt < :cutoff")
    int reclaimStuckProcessing(
            @Param("pending") NotificationStatus pending,
            @Param("processing") NotificationStatus processing,
            @Param("cutoff") Instant cutoff);
}
