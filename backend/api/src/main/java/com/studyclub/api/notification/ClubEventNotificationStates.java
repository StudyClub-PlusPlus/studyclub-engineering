package com.studyclub.api.notification;

import com.studyclub.domain.event.ClubEvent;
import com.studyclub.domain.event.ClubEventRepository;
import com.studyclub.domain.event.EventStatus;
import com.studyclub.domain.event.mail.ClubEventMailRecipientRef;
import com.studyclub.domain.event.mail.ClubEventMailRepository;
import com.studyclub.domain.event.registration.ClubEventRegistration;
import com.studyclub.domain.event.registration.ClubEventRegistrationCancelReason;
import com.studyclub.domain.event.registration.ClubEventRegistrationRepository;
import com.studyclub.domain.event.registration.ClubEventRegistrationStatus;
import com.studyclub.notification.Notification;
import com.studyclub.notification.NotificationEventType;
import com.studyclub.notification.NotificationStatus;
import java.time.Instant;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * 재발송 판정 재료 — 행사 메일 실패 건 중 <b>지금 행사 · 신청 상태로는 다시 보낼 수 없는</b> 행의 ID (specs/event-mail 「재발송 가능 조건」).
 * 목록의 {@code canResend} 와 재발송 접수가 {@link NotificationRecipientAccounts} 와 함께 이 한 곳을 거친다. 행마다 읽지 않고
 * 신청 · 행사 · 메일 수신자를 ID 묶음으로 한 번씩 읽는다.
 */
@Component
@RequiredArgsConstructor
class ClubEventNotificationStates {

    private final ClubEventRegistrationRepository registrationRepository;
    private final ClubEventRepository clubEventRepository;
    private final ClubEventMailRepository mailRepository;

    private record MailRecipient(Long mailId, Long accountId) {}

    Set<Long> stateChangedIds(Collection<Notification> notifications) {
        List<Notification> rows =
                notifications.stream()
                        .filter(row -> row.getEventType().isClubEvent())
                        .filter(row -> row.getStatus() == NotificationStatus.FAILED)
                        .toList();
        if (rows.isEmpty()) {
            return Set.of();
        }
        Set<Long> mailIds = new HashSet<>();
        Set<Long> registrationIds = new HashSet<>();
        for (Notification row : rows) {
            if (isOperatorMail(row.getEventType())) {
                mailIds.add(row.getReferenceId());
            } else {
                registrationIds.add(row.getReferenceId());
            }
        }
        Map<MailRecipient, ClubEventMailRecipientRef> recipients = new HashMap<>();
        if (!mailIds.isEmpty()) {
            for (ClubEventMailRecipientRef ref : mailRepository.findRecipientRefs(mailIds)) {
                recipients.put(new MailRecipient(ref.mailId(), ref.accountId()), ref);
                registrationIds.add(ref.registrationId());
            }
        }
        Map<Long, ClubEventRegistration> registrations =
                registrationRepository.findAllById(registrationIds).stream()
                        .collect(
                                Collectors.toMap(
                                        ClubEventRegistration::getId, Function.identity()));
        Set<Long> eventIds = new HashSet<>();
        registrations.values().forEach(r -> eventIds.add(r.getClubEventId()));
        recipients.values().forEach(r -> eventIds.add(r.clubEventId()));
        Map<Long, ClubEvent> events =
                clubEventRepository.findAllById(eventIds).stream()
                        .collect(Collectors.toMap(ClubEvent::getId, Function.identity()));

        Instant now = Instant.now();
        Set<Long> changed = new HashSet<>();
        for (Notification row : rows) {
            ClubEventRegistration registration;
            if (isOperatorMail(row.getEventType())) {
                ClubEventMailRecipientRef ref =
                        recipients.get(
                                new MailRecipient(row.getReferenceId(), row.getRecipientUserId()));
                registration = ref == null ? null : registrations.get(ref.registrationId());
            } else {
                registration = registrations.get(row.getReferenceId());
            }
            ClubEvent event =
                    registration == null ? null : events.get(registration.getClubEventId());
            if (registration == null
                    || event == null
                    || !stillHolds(row.getEventType(), registration, event, now)) {
                changed.add(row.getId());
            }
        }
        return changed;
    }

    /** 스펙 표 — 그 메일을 만든 상태가 지금도 그대로인가. */
    private static boolean stillHolds(
            NotificationEventType type,
            ClubEventRegistration registration,
            ClubEvent event,
            Instant now) {
        boolean eventCancelled = event.getStatus() == EventStatus.CANCELLED;
        ClubEventRegistrationStatus status = registration.getStatus();
        ClubEventRegistrationCancelReason reason = registration.getCancelReason();
        return switch (type) {
            case EVENT_REGISTRATION_CONFIRMED, EVENT_ANNOUNCEMENT ->
                    status == ClubEventRegistrationStatus.CONFIRMED && !eventCancelled;
            case EVENT_REGISTRATION_PENDING ->
                    status == ClubEventRegistrationStatus.PENDING
                            && !eventCancelled
                            && now.isBefore(event.effectiveEndsAt());
            case EVENT_REGISTRATION_DECLINED ->
                    status == ClubEventRegistrationStatus.DECLINED && !eventCancelled;
            case EVENT_REGISTRATION_CANCELLED ->
                    status == ClubEventRegistrationStatus.CANCELLED
                            && (reason == ClubEventRegistrationCancelReason.ADMIN_CANCELLED
                                    || reason == ClubEventRegistrationCancelReason.SELF_CANCELLED);
            case EVENT_CANCELLATION ->
                    eventCancelled && reason == ClubEventRegistrationCancelReason.EVENT_CANCELLED;
            default -> true;
        };
    }

    private static boolean isOperatorMail(NotificationEventType type) {
        return type == NotificationEventType.EVENT_ANNOUNCEMENT
                || type == NotificationEventType.EVENT_CANCELLATION;
    }
}
