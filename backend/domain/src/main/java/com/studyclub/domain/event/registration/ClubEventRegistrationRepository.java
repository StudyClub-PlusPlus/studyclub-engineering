package com.studyclub.domain.event.registration;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * 행사 신청 저장소. 같은 행사의 신청을 읽고 판단하거나 바꾸는 트랜잭션은 그 행사 행 잠금({@code ClubEventRepository.findByIdForUpdate})
 * 뒤에 이 저장소를 부른다 — 잠금 전에 읽으면 MySQL 의 읽기 시점이 고정되어 앞 요청이 커밋한 신청을 못 본다 (specs/event/spec.md 「같은 행사에 쓰는
 * 요청의 처리 순서」).
 *
 * <p>여러 행을 바꾸는 갱신은 {@code WHERE STATUS …} 조건부라 이미 바뀐 신청은 건드리지 않는다. 벌크 갱신은 {@code @LastModifiedDate}
 * 를 거치지 않아 {@code UPDATED_AT} 을 직접 채운다.
 */
public interface ClubEventRegistrationRepository
        extends JpaRepository<ClubEventRegistration, Long> {

    /** 행사 묶음의 방식 · 상태별 수 — GROUP BY 한 번. 신청이 없는 행사는 결과에 없다. */
    @Query(
            "select new com.studyclub.domain.event.registration.RegistrationSeatCount("
                    + " r.clubEventId, r.channel, r.status, count(r))"
                    + " from ClubEventRegistration r"
                    + " where r.clubEventId in :eventIds and r.status in :statuses"
                    + " group by r.clubEventId, r.channel, r.status")
    List<RegistrationSeatCount> countGroupedByEvent(
            @Param("eventIds") Collection<Long> eventIds,
            @Param("statuses") Collection<ClubEventRegistrationStatus> statuses);

    @Query(
            "select r.id from ClubEventRegistration r"
                    + " where r.clubEventId = :eventId and r.status = :status order by r.id")
    List<Long> findIdsByClubEventIdAndStatus(
            @Param("eventId") Long eventId, @Param("status") ClubEventRegistrationStatus status);

    /** 고른 신청 중 아직 {@code from} 인 것만 {@code to} 로. 실제로 바꾼 행 수를 돌려준다. */
    @Modifying(flushAutomatically = true)
    @Query(
            "update ClubEventRegistration r"
                    + " set r.status = :to, r.statusChangedAt = :now, r.statusChangedBy = :actor,"
                    + " r.updatedAt = :now"
                    + " where r.id in :ids and r.status = :from")
    int changeStatusWhere(
            @Param("ids") Collection<Long> ids,
            @Param("from") ClubEventRegistrationStatus from,
            @Param("to") ClubEventRegistrationStatus to,
            @Param("actor") Long actorAccountId,
            @Param("now") Instant now);

    /** 이 행사의 내 신청 전부, 최신 먼저 — 중복 · 참가 불가 이력 판정과 「내 최신 신청」. */
    List<ClubEventRegistration> findByAccountIdAndClubEventIdOrderByCreatedAtDescIdDesc(
            Long accountId, Long clubEventId);

    /** 사이트 목록 — 화면에 그릴 행사들의 내 신청. 행사별 최신 한 건은 호출자가 고른다. */
    List<ClubEventRegistration> findByAccountIdAndClubEventIdIn(
            Long accountId, Collection<Long> clubEventIds);

    /** 내 행사 — 내 신청 전부, 최신 먼저. 행사별 첫 행이 그 행사의 최신 신청이다. */
    List<ClubEventRegistration> findByAccountIdOrderByCreatedAtDescIdDesc(Long accountId);

    /** 같은 계정이 같은 {@code Idempotency-Key} 로 이미 만든 신청 (event-registration 「신청 제출」 1-1). */
    Optional<ClubEventRegistration> findByAccountIdAndSubmitIdempotencyKey(
            Long accountId, String submitIdempotencyKey);

    /** 회원 탈퇴 — 그 계정 신청이 걸린 행사 ID 를 상태와 관계없이, 잠금 순서인 ID 오름차순으로. */
    @Query(
            "select distinct r.clubEventId from ClubEventRegistration r"
                    + " where r.accountId = :accountId order by r.clubEventId")
    List<Long> findClubEventIdsByAccountId(@Param("accountId") Long accountId);

    /**
     * 회원 탈퇴 — 고른 행사에서 그 계정의 유효 신청({@code PENDING} · {@code CONFIRMED})을 {@code CANCELLED} · {@code
     * ACCOUNT_DELETED} 로. 바꾼 사람은 시스템이라 null. 바꾼 행 수를 돌려준다.
     */
    @Modifying(flushAutomatically = true)
    @Query(
            "update ClubEventRegistration r"
                    + " set r.status = :cancelled, r.cancelReason = :reason,"
                    + " r.statusChangedAt = :now, r.statusChangedBy = null, r.updatedAt = :now"
                    + " where r.accountId = :accountId and r.clubEventId in :eventIds"
                    + " and r.status in :active")
    int cancelForAccountDeletion(
            @Param("accountId") Long accountId,
            @Param("eventIds") Collection<Long> eventIds,
            @Param("active") Collection<ClubEventRegistrationStatus> active,
            @Param("cancelled") ClubEventRegistrationStatus cancelled,
            @Param("reason") ClubEventRegistrationCancelReason reason,
            @Param("now") Instant now);

    default int cancelActiveForAccountDeletion(
            Long accountId, Collection<Long> eventIds, Instant now) {
        return cancelForAccountDeletion(
                accountId,
                eventIds,
                List.of(ClubEventRegistrationStatus.PENDING, ClubEventRegistrationStatus.CONFIRMED),
                ClubEventRegistrationStatus.CANCELLED,
                ClubEventRegistrationCancelReason.ACCOUNT_DELETED,
                now);
    }
}
