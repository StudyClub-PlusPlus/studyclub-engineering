package com.studyclub.api.event;

import com.studyclub.domain.event.ClubEvent;
import com.studyclub.domain.event.ClubEventRegistrationPort;
import com.studyclub.domain.event.ClubEventRegistrationsDeclinedEvent;
import com.studyclub.domain.event.ClubEventRepository;
import com.studyclub.domain.event.EventStatus;
import com.studyclub.domain.event.registration.ClubEventRegistrationRepository;
import com.studyclub.domain.event.registration.ClubEventRegistrationStatus;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * 행사 종료 때 남은 확인 대기 신청을 참가 불가로 바꾼다 (specs/event-participant 「행사 종료 시 확인 대기 자동 전환」). 후보는 잠금 없이 고르고,
 * 행사마다 새 트랜잭션에서 행사 행을 잠근 뒤 다시 판정한다 — 고른 뒤 캡틴이 종료 시각을 늘렸거나 행사를 취소했을 수 있다.
 */
@Service
public class ClubEventEndSettlementService {

    private final ClubEventRepository clubEventRepository;
    private final ClubEventRegistrationRepository registrationRepository;
    private final ClubEventRegistrationPort registrationPort;
    private final ApplicationEventPublisher eventPublisher;

    public ClubEventEndSettlementService(
            ClubEventRepository clubEventRepository,
            ClubEventRegistrationRepository registrationRepository,
            ClubEventRegistrationPort registrationPort,
            ApplicationEventPublisher eventPublisher) {
        this.clubEventRepository = clubEventRepository;
        this.registrationRepository = registrationRepository;
        this.registrationPort = registrationPort;
        this.eventPublisher = eventPublisher;
    }

    /** 처리 순서 1 — 확인 대기 신청이 있고 취소되지 않았으며 종료된 행사 ID, 오름차순. */
    @Transactional(readOnly = true)
    public List<Long> findCandidates(Instant now) {
        List<Long> eventIds =
                registrationRepository.findDistinctClubEventIdsByStatus(
                        ClubEventRegistrationStatus.PENDING);
        if (eventIds.isEmpty()) {
            return List.of();
        }
        return clubEventRepository.findAllById(eventIds).stream()
                .filter(event -> isEnded(event, now))
                .map(ClubEvent::getId)
                .sorted(Comparator.naturalOrder())
                .toList();
    }

    /**
     * 처리 순서 2 — 행사 하나를 새 트랜잭션에서. 바꾼 신청이 있으면 {@code EVENT_ENDED} 참가 불가 이벤트를 내고, 메일 행은 커밋 직전 구독자가 같은
     * 트랜잭션에 만든다. 실패하면 이 행사만 롤백된다.
     *
     * @return 바꾼 신청 수
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public int settle(Long eventId, Instant now) {
        ClubEvent event = clubEventRepository.findByIdForUpdate(eventId).orElse(null);
        if (event == null || !isEnded(event, now)) {
            return 0;
        }
        List<Long> declined = registrationPort.declinePendingRegistrationsForEventEnd(eventId);
        if (declined.isEmpty()) {
            return 0;
        }
        eventPublisher.publishEvent(
                ClubEventRegistrationsDeclinedEvent.of(
                        eventId,
                        declined,
                        ClubEventRegistrationsDeclinedEvent.Cause.EVENT_ENDED,
                        null));
        return declined.size();
    }

    private static boolean isEnded(ClubEvent event, Instant now) {
        return event.getStatus() != EventStatus.CANCELLED
                && !now.isBefore(event.getStartsAt())
                && !now.isBefore(event.effectiveEndsAt());
    }
}
