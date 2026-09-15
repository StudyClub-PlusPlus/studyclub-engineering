package com.studyclub.notification;

import java.time.Instant;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 폴링 스케줄러가 쓰는 트랜잭션 경계. {@link NotificationPollingScheduler} 의 {@code @Scheduled} 메서드에서 이 클래스의 메서드를
 * self-invocation(내부에서 {@code this.method()}) 으로 부르면 Spring AOP 프록시를 안 거쳐 {@code @Transactional} 이
 * 조용히 무시된다 — 그래서 스케줄러와 별도 빈으로 분리했다(specs/notification/spec.md 의 "self-invocation으로 우회되지 않게 함"
 * 요구사항).
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class NotificationClaimService {

    private final NotificationRepository notificationRepository;

    /** {@code locked_at} 기준 컷오프를 넘겨 멈춘 PROCESSING 행을 PENDING 으로 되돌린다. 클레임 직전에 호출한다. */
    @Transactional
    public void reclaimStuck(long reclaimTimeoutMinutes) {
        Instant cutoff = Instant.now().minusSeconds(reclaimTimeoutMinutes * 60);
        int reclaimed =
                notificationRepository.reclaimStuckProcessing(
                        NotificationStatus.PENDING, NotificationStatus.PROCESSING, cutoff);
        if (reclaimed > 0) {
            log.warn("재수거된 PROCESSING 알림 {}건 (cutoff={})", reclaimed, cutoff);
        }
    }

    /**
     * SELECT ... FOR UPDATE SKIP LOCKED 로 클레임한 뒤 PROCESSING 으로 전환한다. SELECT 와 UPDATE 가 반드시 같은
     * 트랜잭션(같은 커넥션) 안에 있어야 한다 — 락이 중간에 풀리면 다른 인스턴스가 같은 행을 중복 클레임할 수 있다.
     */
    @Transactional
    public List<Notification> claim(int batchSize) {
        List<Long> ids = notificationRepository.findClaimableIds(batchSize, Instant.now());
        if (ids.isEmpty()) {
            return List.of();
        }
        notificationRepository.markProcessing(ids, NotificationStatus.PROCESSING, Instant.now());
        return notificationRepository.findAllById(ids);
    }

    @Transactional
    public void markSent(Long notificationId) {
        notificationRepository.findById(notificationId).ifPresent(n -> n.markSent(Instant.now()));
    }

    @Transactional
    public void markFailed(Long notificationId, NotificationErrorType errorType) {
        notificationRepository.findById(notificationId).ifPresent(n -> n.markFailed(errorType));
    }
}
