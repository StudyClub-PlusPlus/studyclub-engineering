package com.studyclub.api.event;

import com.studyclub.domain.event.ClubEventRegistrationPort;
import com.studyclub.domain.event.EventSeatCounts;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * 신청 테이블이 생기기 전의 임시 어댑터 — 모든 행사에 신청이 0 건이고, 일괄 확정은 바꾸는 것이 없다. 등록·수정·조회 API 가 신청 스펙과 독립적으로 돌게 한다.
 *
 * <p>TODO(crew-apply-event): 신청 스펙 구현 PR 이 신청 테이블을 읽는 실제 어댑터(방식·상태별 GROUP BY 한 번, {@code WHERE
 * STATUS = 'PENDING'} 조건부 갱신)를 넣으면서 이 클래스를 지운다. 테스트는 {@code @MockitoBean} 으로 포트를 바꿔 끼운다.
 */
@Component
class EmptyClubEventRegistrationAdapter implements ClubEventRegistrationPort {

    @Override
    public Map<Long, EventSeatCounts> countActiveSeatsByEventIds(Collection<Long> eventIds) {
        return Map.of();
    }

    @Override
    public EventSeatCounts countActiveSeats(Long eventId) {
        return EventSeatCounts.none();
    }

    @Override
    public List<Long> confirmPendingRegistrations(Long eventId) {
        return List.of();
    }
}
