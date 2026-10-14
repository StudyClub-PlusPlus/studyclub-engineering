package com.studyclub.domain.account;

import com.studyclub.common.event.DomainEvent;
import com.studyclub.common.event.EventMeta;

/**
 * 온보딩 완료 = 가입 완료 시 ACCOUNT 당 정확히 1회 발행되는 이벤트. 페이로드는 accountId 뿐 — 마케팅 동의 등 나머지는 소비하는 쪽이
 * ACCOUNT_CONSENT 에서 읽는다 (specs/user-onboarding/spec.md, specs/domain-events/spec.md).
 */
public record UserRegisteredEvent(EventMeta meta, Long accountId) implements DomainEvent {

    public static final String NAME = "user.registered";

    /** 본인이 온보딩을 끝내므로 행위자 = 그 계정. */
    public static UserRegisteredEvent of(Long accountId) {
        return new UserRegisteredEvent(EventMeta.now(accountId), accountId);
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
