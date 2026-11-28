package com.studyclub.api.timezone;

import com.studyclub.domain.account.AccountDeleted;
import com.studyclub.domain.account.UserRegisteredEvent;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * 회원 시간대가 바뀐 트랜잭션이 커밋된 뒤 후보 캐시를 비운다. 커밋 전에 비우면 그사이 다른 요청이 옛 값을 다시 채운다. 같은 스레드에서 바로 비워 다음 GET 이 반영된
 * 값을 본다 (PRD §3 「다음 진입 요청에 최신 집계」).
 */
@Component
public class MemberTimeZoneCacheInvalidator {

    private final MemberTimeZoneCandidateService candidates;

    public MemberTimeZoneCacheInvalidator(MemberTimeZoneCandidateService candidates) {
        this.candidates = candidates;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onProfileTimeZoneChanged(MemberTimeZonesChanged event) {
        candidates.invalidate();
    }

    /** 온보딩 완료 — {@code UserRegisteredEvent} 는 계정당 처음 완료할 때 한 번 나간다. */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onOnboardingCompleted(UserRegisteredEvent event) {
        candidates.invalidate();
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onAccountDeleted(AccountDeleted event) {
        candidates.invalidate();
    }
}
