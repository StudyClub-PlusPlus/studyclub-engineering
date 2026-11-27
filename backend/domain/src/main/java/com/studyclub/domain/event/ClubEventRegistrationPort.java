package com.studyclub.domain.event;

import java.util.Collection;
import java.util.List;
import java.util.Map;

/**
 * 행사가 신청 애그리거트에게 묻고 시키는 것 — 방식·상태별 수 세기, 확정 방식 전환의 일괄 확정, 행사 취소의 일괄 취소. 신청 테이블과 그 규칙은 신청
 * 스펙(crew-apply-event)이 정한다 (실제 어댑터: api 모듈 {@code ClubEventRegistrationAdapter}). 이 스펙은 수만 읽고,
 * {@code REVIEW → AUTO} 때 {@code PENDING → CONFIRMED} 만 쓴다 (specs/event/spec.md 데이터 모델).
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
     * 그 행사의 {@code PENDING} 신청을 전부 {@code CONFIRMED} 로 바꾸고, 실제로 바꾼 신청 ID 를 돌려준다. 바꾼 사람({@code
     * STATUS_CHANGED_BY})은 확정 방식을 바꿔 저장한 캡틴이다. {@code WHERE STATUS = 'PENDING'} 같은 조건부 갱신으로 이미 바뀐
     * 신청은 건드리지 않는다. 행사 행 잠금을 잡은 트랜잭션 안에서만 부른다.
     */
    List<Long> confirmPendingRegistrations(Long eventId, Long actorAccountId);

    /**
     * 행사 취소 — 그 행사의 {@code PENDING} · {@code CONFIRMED} 신청을 전부 {@code CANCELLED} · {@code
     * EVENT_CANCELLED} 로 바꾸고, 실제로 바꾼 신청 ID 를 돌려준다 (없으면 빈 목록). 바꾼 사람은 취소한 캡틴이다. 행사 행 잠금을 잡은 트랜잭션
     * 안에서만 부른다.
     */
    List<Long> cancelActiveRegistrationsForEventCancellation(Long eventId, Long actorAccountId);

    /**
     * 취소 안내 대상 수 — 유효 신청이거나 행사 취소로 취소된 신청 중 계정이 남은 수. 취소 전 행사에는 행사 취소로 취소된 신청이 없고 취소된 행사에는 유효 신청이
     * 없어, 취소 전이면 「지금 취소하면 받을 사람」, 취소 뒤면 「받을 사람」이 된다 (specs/event-status 「운영 상세에 더하는 판정 필드」).
     */
    int countCancellationRecipients(Long eventId);

    /**
     * 행사 종료 자동 전환 — 그 행사의 {@code PENDING} 신청을 전부 {@code DECLINED} 로 바꾸고, 실제로 바꾼 신청 ID 를 돌려준다 (없으면 빈
     * 목록). 시스템 처리라 바꾼 사람은 null 이다. 행사 행 잠금을 잡은 트랜잭션 안에서만 부른다.
     */
    List<Long> declinePendingRegistrationsForEventEnd(Long eventId);
}
