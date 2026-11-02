package com.studyclub.notification.webpush;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 구독 등록·해제 (specs/web-push/spec.md). 같은 주소는 행 하나다. */
@Service
@RequiredArgsConstructor
public class WebPushSubscriptionService {

    private final WebPushSubscriptionRepository repository;

    @Transactional
    public void subscribe(Long accountId, String endpoint, String p256dh, String auth) {
        repository
                .findByEndpointHash(WebPushSubscription.hash(endpoint))
                .ifPresentOrElse(
                        existing -> existing.renew(accountId, p256dh, auth),
                        () ->
                                repository.save(
                                        WebPushSubscription.register(
                                                accountId, endpoint, p256dh, auth)));
    }

    /** 내 구독만 지운다. 없거나 남의 것이면 아무것도 안 한다 — 몰래 남의 기기를 끊을 수 없게. */
    @Transactional
    public void unsubscribe(Long accountId, String endpoint) {
        repository
                .findByEndpointHash(WebPushSubscription.hash(endpoint))
                .filter(s -> s.getAccountId().equals(accountId))
                .ifPresent(repository::delete);
    }

    /** 회원 탈퇴 — 그 사람의 기기를 전부 끊는다. 호출자의 트랜잭션에 참여한다. */
    @Transactional
    public int deleteAllOf(Long accountId) {
        return repository.deleteAllByAccountId(accountId);
    }

    @Transactional(readOnly = true)
    public long countOf(Long accountId) {
        return repository.countByAccountId(accountId);
    }

    @Transactional(readOnly = true)
    public Stats stats() {
        return new Stats(repository.count(), repository.countAccounts());
    }

    public record Stats(long subscriptions, long accounts) {}
}
