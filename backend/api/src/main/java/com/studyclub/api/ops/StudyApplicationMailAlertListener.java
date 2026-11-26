package com.studyclub.api.ops;

import com.studyclub.notification.StudyApplicationMailSkipped;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
@Slf4j
public class StudyApplicationMailAlertListener {
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void logSkipped(StudyApplicationMailSkipped event) {
        log.warn(
                "study-application-mail-skipped: eventType=STUDY_APPLICATION_RECEIVED studyId={} applicationId={} reason={} occurredAt={}",
                event.studyId(),
                event.applicationId(),
                event.reason(),
                event.meta().occurredAt());
    }
}
