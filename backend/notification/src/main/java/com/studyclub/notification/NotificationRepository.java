package com.studyclub.notification;

import java.time.Instant;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface NotificationRepository extends JpaRepository<Notification, Long> {

    /** 테스트 전용 — 계정 하나가 받은 알림을 뒤져볼 때만 쓴다. 백오피스 조회는 볼륨이 계속 느는 아웃박스라 {@link #findPage} 를 쓴다. */
    List<Notification> findAllByOrderByCreatedAtDesc();

    /**
     * 백오피스 발송 이력 조회 — LIMIT/OFFSET 을 DB 에 위임한다. {@code eventType}/{@code status} 는 null 이면 필터를 적용하지
     * 않는다(Enum 을 그대로 바인딩하지 않고 이름으로 비교하는 이유는 네이티브 쿼리라 Hibernate 의 enum 타입 추론을 못 받기 때문).
     */
    @Query(
            value =
                    """
            SELECT *
            FROM NOTIFICATION
            WHERE (:eventType IS NULL OR EVENT_TYPE = :eventType)
              AND (:status IS NULL OR STATUS = :status)
            ORDER BY CREATED_AT DESC
            LIMIT :limit OFFSET :offset
            """,
            nativeQuery = true)
    List<Notification> findPage(
            @Param("eventType") String eventType,
            @Param("status") String status,
            @Param("limit") int limit,
            @Param("offset") int offset);

    /** {@link #findPage} 와 같은 필터로 전체 건수를 센다 — 응답의 {@code total} 필드용. */
    @Query(
            value =
                    """
            SELECT COUNT(*)
            FROM NOTIFICATION
            WHERE (:eventType IS NULL OR EVENT_TYPE = :eventType)
              AND (:status IS NULL OR STATUS = :status)
            """,
            nativeQuery = true)
    long countFiltered(@Param("eventType") String eventType, @Param("status") String status);

    /**
     * 다중 서버 환경에서 같은 PENDING 행을 두 인스턴스가 동시에 집어가지 않도록 잠근다. InnoDB 가 행 락 획득을 원자적으로 처리하므로 이 SELECT 자체가
     * 클레임이다 — 애플리케이션이 조율할 필요가 없다 (specs/notification/spec.md).
     *
     * <p>이 메서드는 반드시 뒤이은 {@code Notification.markProcessing} 저장과 같은 트랜잭션(같은 커넥션) 안에서 호출한다. 트랜잭션이
     * 커밋되기 전까지 락이 유지된다.
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

    /**
     * {@code lockedAt} 기준 컷오프를 넘겨 멈춘 PROCESSING 행을 잠근다. {@link #findClaimableIds} 와 같은 이유로 FOR
     * UPDATE SKIP LOCKED 를 쓴다 — 마침 다른 인스턴스가 이 행에 대해 {@code markSent}/{@code markFailed} 를 커밋하는 중이면
     * 이번 재수거 사이클에서는 건드리지 않고 넘어간다(그 커밋이 끝나면 STATUS 가 PROCESSING 이 아니게 되어 다음 조회부터 자연히 제외된다).
     */
    @Query(
            value =
                    """
            SELECT ID
            FROM NOTIFICATION
            WHERE STATUS = 'PROCESSING'
              AND LOCKED_AT < :cutoff
            FOR UPDATE SKIP LOCKED
            """,
            nativeQuery = true)
    List<Long> findStuckProcessingIds(@Param("cutoff") Instant cutoff);
}
