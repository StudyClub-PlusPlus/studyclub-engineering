package com.studyclub.api.event;

import com.studyclub.domain.event.ClubEventRegistrationPort;
import com.studyclub.domain.event.EventSeatCounts;
import com.studyclub.domain.event.registration.ClubEventRegistrationRepository;
import com.studyclub.domain.event.registration.ClubEventRegistrationStatus;
import com.studyclub.domain.event.registration.RegistrationSeatCount;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * 행사 애그리거트가 신청에게 묻고 시키는 것({@link ClubEventRegistrationPort})을 신청 테이블로 답한다. 행사 쪽은 신청 테이블을 직접 모른다.
 *
 * <p>신청 엔티티 · 저장소는 domain 모듈의 {@code com.studyclub.domain.event.registration} 에 있지만, 스프링 빈은 api ·
 * notification 패키지만 스캔하므로 어댑터는 여기 둔다.
 */
@Component
@RequiredArgsConstructor
class ClubEventRegistrationAdapter implements ClubEventRegistrationPort {

    private static final List<ClubEventRegistrationStatus> SEAT_STATUSES =
            List.of(ClubEventRegistrationStatus.PENDING, ClubEventRegistrationStatus.CONFIRMED);

    private final ClubEventRegistrationRepository registrationRepository;

    @Override
    public Map<Long, EventSeatCounts> countActiveSeatsByEventIds(Collection<Long> eventIds) {
        if (eventIds.isEmpty()) {
            return Map.of();
        }
        Map<Long, EventSeatCounts> counts = new HashMap<>();
        for (RegistrationSeatCount row :
                registrationRepository.countGroupedByEvent(eventIds, SEAT_STATUSES)) {
            EventSeatCounts current =
                    counts.getOrDefault(row.clubEventId(), EventSeatCounts.none());
            int pending = current.pending(row.channel());
            int confirmed = current.confirmed(row.channel());
            if (row.status() == ClubEventRegistrationStatus.PENDING) {
                pending = Math.toIntExact(row.count());
            } else {
                confirmed = Math.toIntExact(row.count());
            }
            counts.put(row.clubEventId(), current.with(row.channel(), pending, confirmed));
        }
        return counts;
    }

    @Override
    public EventSeatCounts countActiveSeats(Long eventId) {
        return countActiveSeatsByEventIds(List.of(eventId))
                .getOrDefault(eventId, EventSeatCounts.none());
    }

    @Override
    public List<Long> confirmPendingRegistrations(Long eventId, Long actorAccountId) {
        List<Long> pendingIds =
                registrationRepository.findIdsByClubEventIdAndStatus(
                        eventId, ClubEventRegistrationStatus.PENDING);
        if (pendingIds.isEmpty()) {
            return List.of();
        }
        // 행사 행 잠금 아래라 읽은 PENDING 이 그대로 남아 있다. 조건부 갱신은 그 가정이 깨져도 이미 바뀐 신청을 덮어쓰지 않기 위한 안전망이다
        registrationRepository.changeStatusWhere(
                pendingIds,
                ClubEventRegistrationStatus.PENDING,
                ClubEventRegistrationStatus.CONFIRMED,
                actorAccountId,
                Instant.now().truncatedTo(ChronoUnit.MICROS));
        return pendingIds;
    }
}
