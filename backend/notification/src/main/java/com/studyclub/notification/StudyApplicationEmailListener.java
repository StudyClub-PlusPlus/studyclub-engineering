package com.studyclub.notification;

import com.studyclub.common.event.EventMeta;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.SystemRole;
import com.studyclub.domain.application.StudyApplicationSubmitted;
import com.studyclub.domain.study.StudyRepository;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
@RequiredArgsConstructor
public class StudyApplicationEmailListener {
    private final StudyRepository studyRepository;
    private final AccountRepository accountRepository;
    private final NotificationTemplateRepository templateRepository;
    private final NotificationRepository notificationRepository;
    private final StudyApplicationLink link;
    private final ApplicationEventPublisher publisher;

    @TransactionalEventListener(phase = TransactionPhase.BEFORE_COMMIT)
    public void onSubmitted(StudyApplicationSubmitted event) {
        // 신청 서비스가 스터디를 잠갔다. 탈퇴는 담당자를 비운 뒤 알림을 비식별화하므로 새 예약도 정리된다.
        var study = studyRepository.findById(event.studyId()).orElseThrow();
        Long captainId = study.getOwnerCaptainId();
        if (captainId == null) {
            skip(event, StudyApplicationMailSkipped.Reason.OWNER_MISSING);
            return;
        }
        if (captainId.equals(event.accountId())) {
            return;
        }
        var captain = accountRepository.findById(captainId);
        if (captain.isEmpty()) {
            skip(event, StudyApplicationMailSkipped.Reason.OWNER_ACCOUNT_NOT_FOUND);
            return;
        }
        if (captain.get().getSystemRole() != SystemRole.ADMIN) {
            skip(event, StudyApplicationMailSkipped.Reason.OWNER_NOT_ADMIN);
            return;
        }
        var templates =
                templateRepository.findAllByEventTypeAndChannelOrderByIdAsc(
                        NotificationEventType.STUDY_APPLICATION_RECEIVED,
                        NotificationChannel.EMAIL);
        if (templates.isEmpty()) {
            skip(event, StudyApplicationMailSkipped.Reason.TEMPLATE_MISSING);
            return;
        }
        Map<String, Object> payload =
                Map.of(
                        "studyTitle",
                        study.getTitle(),
                        "applicationsUrl",
                        link.forStudy(study.getId()));
        for (var template : templates) {
            notificationRepository.save(
                    Notification.pendingImmediate(
                            NotificationEventType.STUDY_APPLICATION_RECEIVED,
                            NotificationChannel.EMAIL,
                            captain.get().getEmail(),
                            captainId,
                            template.getId(),
                            payload,
                            event.applicationId()));
        }
    }

    private void skip(StudyApplicationSubmitted event, StudyApplicationMailSkipped.Reason reason) {
        publisher.publishEvent(
                new StudyApplicationMailSkipped(
                        EventMeta.now(null), event.studyId(), event.applicationId(), reason));
    }
}
