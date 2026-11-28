package com.studyclub.notification;

import com.studyclub.common.event.DomainEvent;
import com.studyclub.common.event.EventMeta;

/** 신청은 접수됐지만 메일을 예약할 수 없었다. 운영 진단에 신청자 개인정보는 싣지 않는다. */
public record StudyApplicationMailSkipped(
        EventMeta meta, Long studyId, Long applicationId, Reason reason) implements DomainEvent {
    public enum Reason {
        OWNER_MISSING,
        OWNER_ACCOUNT_NOT_FOUND,
        OWNER_NOT_ADMIN,
        TEMPLATE_MISSING
    }

    @Override
    public String name() {
        return "study_application.mail_skipped";
    }

    @Override
    public String aggregateType() {
        return "study_application";
    }

    @Override
    public String aggregateId() {
        return String.valueOf(applicationId);
    }
}
