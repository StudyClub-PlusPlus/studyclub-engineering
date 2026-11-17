package com.studyclub.domain.account;

import com.studyclub.common.event.DomainEvent;
import com.studyclub.common.event.EventMeta;

/**
 * 온보딩 완료 = 가입 완료 시 ACCOUNT 당 정확히 1회 발행되는 이벤트. 페이로드는 accountId 뿐 — 마케팅 동의 등 나머지는 소비하는 쪽이
 * ACCOUNT_CONSENT 에서 읽는다 (specs/user-onboarding/spec.md, specs/domain-events/spec.md).
 *
 * <p>{@code gaClientId} 는 가입 요청에 실려 온 브라우저 GA4 client_id (nullable) — GA4 서버 전송의 유입 귀속용
 * (specs/analytics).
 */
public record UserRegisteredEvent(EventMeta meta, Long accountId, String gaClientId)
        implements DomainEvent {

    public static final String NAME = "user.registered";

    /** 본인이 온보딩을 끝내므로 행위자 = 그 계정. */
    public static UserRegisteredEvent of(Long accountId) {
        return of(accountId, null);
    }

    public static UserRegisteredEvent of(Long accountId, String gaClientId) {
        return new UserRegisteredEvent(EventMeta.now(accountId), accountId, gaClientId);
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
