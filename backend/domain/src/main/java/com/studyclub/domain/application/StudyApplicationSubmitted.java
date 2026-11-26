package com.studyclub.domain.application;

import com.studyclub.common.event.DomainEvent;
import com.studyclub.common.event.EventMeta;

/**
 * 스터디 신청이 접수됐다 (STUDY_APPLICATION 저장). 신청 트랜잭션 안에서 발행되고, 구독자는 커밋 뒤에 받는다
 * (specs/domain-events/spec.md). 페이로드는 id 와 표시용 이름뿐 — 답변·연락처는 싣지 않는다.
 */
public record StudyApplicationSubmitted(
        EventMeta meta,
        Long applicationId,
        Long studyId,
        String studyTitle,
        Long accountId,
        String applicantNickname)
        implements DomainEvent {

    public static final String NAME = "study_application.submitted";

    /** 신청자 본인이 제출하므로 행위자 = 신청자 계정. */
    public static StudyApplicationSubmitted of(
            Long applicationId,
            Long studyId,
            String studyTitle,
            Long accountId,
            String applicantNickname) {
        return new StudyApplicationSubmitted(
                EventMeta.now(accountId),
                applicationId,
                studyId,
                studyTitle,
                accountId,
                applicantNickname);
    }

    @Override
    public String name() {
        return NAME;
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
