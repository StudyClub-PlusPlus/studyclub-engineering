package com.studyclub.notification;

import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface NotificationRepository extends JpaRepository<Notification, Long> {

    /** 테스트 전용 — 계정 하나가 받은 알림을 뒤져볼 때만 쓴다. 백오피스 조회는 볼륨이 계속 느는 아웃박스라 {@link #findPage} 를 쓴다. */
    List<Notification> findAllByOrderByCreatedAtDesc();

    /**
     * 회원 탈퇴 — 이 계정이 수신자인 알림 이력을 잠그고 조회한다(비식별화 대상, specs/user-leave/spec.md).
     *
     * <p>{@code FOR UPDATE}(SKIP LOCKED 아님)인 이유: 폴링 스케줄러가 마침 이 행을 클레임·완료 처리 중이면 그 트랜잭션이 끝날 때까지 기다린
     * 뒤 최신 상태를 읽어야 한다. 일반 조회는 트랜잭션 스냅샷을 읽어, 그 사이 PENDING→PROCESSING 으로 바뀐 행을 여전히 PENDING 으로 보고 취소해
     * 버리거나 스케줄러의 갱신을 덮어쓸 수 있다. SKIP LOCKED 로 건너뛰면 잠긴 행은 비식별화가 누락돼 PII 가 남는다. 반대로 이 락을 먼저 잡으면 스케줄러의
     * {@code findClaimableIds}(SKIP LOCKED)는 이 행을 건너뛰어 취소 대상이 발송되지 않는다.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select n from Notification n where n.recipientUserId = :recipientUserId")
    List<Notification> findByRecipientUserIdForUpdate(
            @Param("recipientUserId") Long recipientUserId);

    /**
     * 회원 탈퇴 — 이 계정이 보낸 공지({@code REFERENCE_ID})의 메일 행을 잠그고 조회한다(보낸 사람 이름 비식별화). {@link
     * #findByRecipientUserIdForUpdate} 와 같은 이유로 {@code FOR UPDATE} 다.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query(
            "select n from Notification n where n.eventType = :eventType"
                    + " and n.referenceId in :referenceIds order by n.id")
    List<Notification> findByReferenceIdsForUpdate(
            @Param("eventType") NotificationEventType eventType,
            @Param("referenceIds") Collection<Long> referenceIds);

    /** 이 사람이 보낸 알림 — 보낸 사람이 탈퇴할 때 보낸 사람 이름을 비식별화할 행을 잠그고 읽는다. 공지가 스터디 삭제로 사라져도 찾는다. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query(
            "select n from Notification n where n.eventType = :eventType"
                    + " and n.senderAccountId = :senderAccountId order by n.id")
    List<Notification> findBySenderAccountIdForUpdate(
            @Param("eventType") NotificationEventType eventType,
            @Param("senderAccountId") Long senderAccountId);

    /**
     * 완료 처리(markSent/markFailed) 전용 — 행을 잠근다({@code AccountRepository.findByEmailForUpdate} 와 같은
     * 이유). 일반 {@code findById} 는 트랜잭션 시작 시점의 스냅샷을 읽을 뿐이라, 이 값을 읽어 자바에서 상태·lockedAt 을 확인한 뒤 저장하는 사이에
     * 다른 트랜잭션(재수거 등)이 같은 행을 먼저 바꿔도 알아채지 못하고 덮어쓸 수 있다 — 확인과 갱신이 원자적이지 않다는 리뷰 지적. {@code FOR UPDATE}
     * 로 읽으면 그 사이 재수거의 {@code FOR UPDATE SKIP LOCKED} 가 이 행을 건너뛰어 이번 재수거 사이클에서 손대지 않으므로, 확인·갱신이 사실상
     * 한 트랜잭션 안에서 원자적으로 처리된다.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select n from Notification n where n.id = :id")
    Optional<Notification> findByIdForUpdate(@Param("id") Long id);

    /**
     * 백오피스 발송 이력 조회 — LIMIT/OFFSET 을 DB 에 위임한다. 같은 시각에 만든 건이 많아도 페이지 경계에서 순서가 흔들리지 않게 {@code ID} 를
     * 보조 정렬 키로 쓴다.
     *
     * <p>{@code eventType}/{@code status} 는 null 이면 필터를 적용하지 않는다(Enum 을 그대로 바인딩하지 않고 이름으로 비교하는 이유는
     * 네이티브 쿼리라 Hibernate 의 enum 타입 추론을 못 받기 때문).
     */
    @Query(
            value =
                    """
            SELECT *
            FROM NOTIFICATION
            WHERE (:eventType IS NULL OR EVENT_TYPE = :eventType)
              AND (:status IS NULL OR STATUS = :status)
            ORDER BY CREATED_AT DESC, ID DESC
            LIMIT :limit OFFSET :offset
            """,
            nativeQuery = true)
    List<Notification> findPage(
            @Param("eventType") String eventType,
            @Param("status") String status,
            @Param("limit") int limit,
            @Param("offset") int offset);

    /**
     * 고른 ID 의 발송 이력 — 재발송을 접수한 건의 끝({@code SENT}·{@code FAILED})을 쫓을 때 쓴다. {@link #findPage} 와 같은
     * 정렬이다.
     */
    List<Notification> findAllByIdInOrderByCreatedAtDescIdDesc(Collection<Long> ids);

    /**
     * 재발송 접수 전용 — 고른 행을 모두 잠그고 읽는다. {@link #findByIdForUpdate} 와 같은 이유다: 폴링이 같은 행을 클레임하거나 다른 캡틴이 같은
     * 건을 누르는 중이면 그 트랜잭션이 끝날 때까지 기다린 뒤 <b>최신 상태</b>를 읽어야, 같은 줄이 두 번 나가지 않는다. ID 오름차순으로 잠가 교착을 피한다.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select n from Notification n where n.id in :ids order by n.id asc")
    List<Notification> findAllByIdInForUpdate(@Param("ids") Collection<Long> ids);

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
     * 공지별 메일 결과 — 받는 사람마다 가진 상태를 {@code REFERENCE_ID} 별로 한 번에 읽는다 (기록 목록이 공지마다 조회하지 않게 — N+1). 같은
     * 조건의 템플릿이 여럿이면 한 사람에게 행이 여러 개라, 건수는 행 수가 아니라 받는 사람별 대표 상태로 센다 ({@link
     * NotificationStatus#representative}). {@code DISTINCT} 로 같은 (공지, 사람, 상태)는 한 번만 온다.
     */
    @Query(
            "SELECT DISTINCT new com.studyclub.notification.NotificationRecipientStatus("
                    + "n.referenceId, n.recipientUserId, n.status)"
                    + " FROM Notification n"
                    + " WHERE n.eventType = :eventType AND n.referenceId IN :referenceIds")
    List<NotificationRecipientStatus> findRecipientStatuses(
            @Param("eventType") NotificationEventType eventType,
            @Param("referenceIds") Collection<Long> referenceIds);

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
