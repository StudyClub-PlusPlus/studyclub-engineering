package com.studyclub.domain.account;

import com.studyclub.common.event.DomainEvent;
import com.studyclub.common.event.EventMeta;

/**
 * 계정이 처음 활성화됐다 — 첫 스터디 신청 또는 첫 행사 신청이 저장됐고 {@code ACCOUNT.ACTIVATED_AT} 이 그 트랜잭션에서 채워졌다. 계정당 한 번만
 * 난다: 신청 서비스가 계정 행을 잠근 뒤 {@link Account#activate} 가 true 일 때만 낸다. 분석 구독자가 커밋 뒤 {@code Activated} 를
 * 보낸다 (specs/analytics).
 *
 * @param studyId {@code STUDY_APPLIED} 면 그 스터디, 아니면 null
 * @param clubEventId {@code EVENT_APPLIED} 면 그 행사, 아니면 null
 */
public record AccountActivatedEvent(
        EventMeta meta, Long accountId, ActivationAction action, Long studyId, Long clubEventId)
        implements DomainEvent {

    public static final String NAME = "account.activated";

    public static AccountActivatedEvent byStudy(Long accountId, Long studyId) {
        return new AccountActivatedEvent(
                EventMeta.now(accountId), accountId, ActivationAction.STUDY_APPLIED, studyId, null);
    }

    public static AccountActivatedEvent byEvent(Long accountId, Long clubEventId) {
        return new AccountActivatedEvent(
                EventMeta.now(accountId),
                accountId,
                ActivationAction.EVENT_APPLIED,
                null,
                clubEventId);
    }

    @Override
    public String name() {
        return NAME;
    }

    @Override
    public String aggregateType() {
        return "account";
    }

    @Override
    public String aggregateId() {
        return String.valueOf(accountId);
    }
}
