package com.studyclub.domain.event;

import jakarta.persistence.LockModeType;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** 행사 애그리거트 저장소. 참여 방식·질문은 루트를 통해서만 바뀌어 저장소가 따로 없다. */
public interface ClubEventRepository extends JpaRepository<ClubEvent, Long>, ClubEventPageQuery {

    /**
     * 행사 행만 쓰기 잠금으로 읽는다 ({@code SELECT … FOR UPDATE}). 같은 행사의 정원·확정 방식·참여 방식을 읽고 판단하거나 바꾸는 트랜잭션은
     * 이것을 <b>첫 조회</b>로 쓴다 — 잠금 전에 일반 조회를 하면 MySQL 의 읽기 시점이 고정되어 앞 요청이 커밋한 신청을 못 본다
     * (specs/event/spec.md 「같은 행사에 쓰는 요청의 처리 순서」). 하위 행은 조인하지 않아 잠금이 행사 한 행에 그친다.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select e from ClubEvent e where e.id = :id")
    Optional<ClubEvent> findByIdForUpdate(@Param("id") Long id);

    /** 같은 계정이 같은 {@code Idempotency-Key} 로 이미 만든 행사 (N1). */
    Optional<ClubEvent> findByCreatedByAndCreateIdempotencyKey(
            Long createdBy, String createIdempotencyKey);

    /** 목록 한 페이지의 행사를 참여 방식과 함께 — 행마다 방식을 따로 읽지 않는다. 순서는 보장하지 않는다. */
    @Query("select distinct e from ClubEvent e left join fetch e.channels where e.id in :ids")
    List<ClubEvent> findAllWithChannelsByIdIn(@Param("ids") Collection<Long> ids);
}
