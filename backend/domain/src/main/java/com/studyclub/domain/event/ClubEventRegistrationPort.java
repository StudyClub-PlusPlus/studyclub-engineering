package com.studyclub.domain.event;

import java.util.Collection;
import java.util.List;
import java.util.Map;

/**
 * 행사가 신청 애그리거트에게 묻고 시키는 것 — 방식·상태별 수 세기와 확정 방식 전환의 일괄 확정. 신청 테이블과 그 규칙은 신청 스펙(crew-apply-event)이
 * 정한다. 이 스펙은 수만 읽고, {@code REVIEW → AUTO} 때 {@code PENDING → CONFIRMED} 만 쓴다 (specs/event/spec.md
 * 데이터 모델).
 *
 * <p>호출 순서 계약: 수정 트랜잭션은 {@link ClubEventRepository#findByIdForUpdate} 로 행사 행을 잠근 <b>뒤에</b> 이 포트를
 * 부른다. 잠금 전에 신청을 읽으면 MySQL 의 읽기 시점이 고정되어 앞 요청이 커밋한 신청을 못 본다.
 */
public interface ClubEventRegistrationPort {

    /**
     * 목록 한 페이지의 행사 ID 묶음에 GROUP BY 한 번. 신청이 없는 행사는 맵에 없어도 된다 — 호출자가 {@link EventSeatCounts#none()}
     * 으로 본다.
     */
    Map<Long, EventSeatCounts> countActiveSeatsByEventIds(Collection<Long> eventIds);

    /** 행사 하나의 방식·상태별 수. 상세·수정이 쓴다. */
    EventSeatCounts countActiveSeats(Long eventId);

    /**
     * 그 행사의 {@code PENDING} 신청을 전부 {@code CONFIRMED} 로 바꾸고, 실제로 바꾼 신청 ID 를 돌려준다. {@code WHERE
     * STATUS = 'PENDING'} 같은 조건부 갱신으로 이미 바뀐 신청은 건드리지 않는다. 행사 행 잠금을 잡은 트랜잭션 안에서만 부른다.
     */
    List<Long> confirmPendingRegistrations(Long eventId);
}
