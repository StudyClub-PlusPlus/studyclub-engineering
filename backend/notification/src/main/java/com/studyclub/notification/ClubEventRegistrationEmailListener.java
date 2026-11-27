package com.studyclub.notification;

import com.studyclub.domain.event.ClubEventRegistrationSubmittedEvent;
import com.studyclub.domain.event.ClubEventRegistrationsCancelledEvent;
import com.studyclub.domain.event.ClubEventRegistrationsConfirmedEvent;
import com.studyclub.domain.event.ClubEventRegistrationsDeclinedEvent;
import com.studyclub.domain.event.mail.ClubEventMailTemplateMissing;
import com.studyclub.domain.event.registration.ClubEventRegistrationStatus;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * 신청 상태가 바뀌면 신청자에게 보낼 자동 메일 행을 처리 트랜잭션 안에서 만든다 (specs/event-mail 「자동 메일: 신청 상태 알림」). {@code
 * BEFORE_COMMIT} 이라 행 저장이 실패하면 처리 전체가 롤백된다.
 *
 * <p>그 조건의 템플릿이 없을 때만 예외로 처리는 커밋하고 메일을 건너뛴다(M2). 건너뛴 신청을 한 사실로 묶어 운영 채널 경보로 넘긴다. 행사 전체 취소 · 탈퇴 취소는
 * 이 이벤트들을 내지 않아 메일이 없다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ClubEventRegistrationEmailListener {

    private final NotificationCreationService notificationCreationService;
    private final ApplicationEventPublisher eventPublisher;

    @TransactionalEventListener(phase = TransactionPhase.BEFORE_COMMIT)
    public void onSubmitted(ClubEventRegistrationSubmittedEvent event) {
        NotificationEventType type =
                event.status() == ClubEventRegistrationStatus.CONFIRMED
                        ? NotificationEventType.EVENT_REGISTRATION_CONFIRMED
                        : NotificationEventType.EVENT_REGISTRATION_PENDING;
        create(type, event.clubEventId(), List.of(event.registrationId()));
    }

    @TransactionalEventListener(phase = TransactionPhase.BEFORE_COMMIT)
    public void onConfirmed(ClubEventRegistrationsConfirmedEvent event) {
        create(
                NotificationEventType.EVENT_REGISTRATION_CONFIRMED,
                event.clubEventId(),
                event.registrationIds());
    }

    @TransactionalEventListener(phase = TransactionPhase.BEFORE_COMMIT)
    public void onDeclined(ClubEventRegistrationsDeclinedEvent event) {
        create(
                NotificationEventType.EVENT_REGISTRATION_DECLINED,
                event.clubEventId(),
                event.registrationIds());
    }

    @TransactionalEventListener(phase = TransactionPhase.BEFORE_COMMIT)
    public void onCancelled(ClubEventRegistrationsCancelledEvent event) {
        create(
                NotificationEventType.EVENT_REGISTRATION_CANCELLED,
                event.clubEventId(),
                event.registrationIds());
    }

    private void create(NotificationEventType type, Long clubEventId, List<Long> registrationIds) {
        if (registrationIds.isEmpty()) {
            return;
        }
        if (notificationCreationService.createClubEventRegistrationEmails(
                type, clubEventId, registrationIds)) {
            return;
        }
        log.error(
                "행사 자동 메일 템플릿 없음, 메일을 건너뜀 eventType={} clubEventId={} registrationIds={}",
                type,
                clubEventId,
                registrationIds);
        eventPublisher.publishEvent(
                ClubEventMailTemplateMissing.of(type.name(), clubEventId, registrationIds));
    }
}
