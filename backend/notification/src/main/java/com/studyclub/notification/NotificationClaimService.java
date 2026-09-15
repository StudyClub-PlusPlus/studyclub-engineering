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

    /**
     * {@code locked_at} 기준 컷오프를 넘겨 멈춘 PROCESSING 행을 PENDING 으로 되돌린다. 클레임 직전에 호출한다.
     *
     * <p>엔티티를 로드해 {@link Notification#reclaim()} 을 거쳐 저장한다(bulk UPDATE 가 아니다) — bulk UPDATE 는
     * {@code BaseEntity} 의 {@code AuditingEntityListener} 를 우회해 {@code UPDATED_AT} 이 실제 상태 전이 시각을
     * 반영하지 못하게 만든다.
     */
    @Transactional
    public void reclaimStuck(long reclaimTimeoutMinutes) {
        Instant cutoff = Instant.now().minusSeconds(reclaimTimeoutMinutes * 60);
        List<Long> ids = notificationRepository.findStuckProcessingIds(cutoff);
        if (ids.isEmpty()) {
            return;
        }
        List<Notification> stuck = notificationRepository.findAllById(ids);
        stuck.forEach(Notification::reclaim);
        log.warn("재수거된 PROCESSING 알림 {}건 (cutoff={})", stuck.size(), cutoff);
    }

    /**
     * SELECT ... FOR UPDATE SKIP LOCKED 로 클레임한 뒤 PROCESSING 으로 전환한다. SELECT 와 저장이 반드시 같은 트랜잭션(같은
     * 커넥션) 안에 있어야 한다 — 락이 중간에 풀리면 다른 인스턴스가 같은 행을 중복 클레임할 수 있다.
     *
     * <p>{@link #reclaimStuck} 과 같은 이유로 bulk UPDATE 대신 엔티티를 로드해 {@link Notification#markProcessing}
     * 을 거친다.
     */
    @Transactional
    public List<Notification> claim(int batchSize) {
        List<Long> ids = notificationRepository.findClaimableIds(batchSize, Instant.now());
        if (ids.isEmpty()) {
            return List.of();
        }
        List<Notification> claimed = notificationRepository.findAllById(ids);
        Instant lockedAt = Instant.now();
        claimed.forEach(n -> n.markProcessing(lockedAt));
        return claimed;
    }

    /**
     * {@code expectedLockedAt} 은 호출자가 {@link #claim} 에서 받은 클레임 토큰이다. 그 사이 재수거되어 소유권을 잃었으면 {@link
     * Notification#markSent} 가 {@link NotificationClaimLostException} 을 던지는데, 이는 버그가 아니라 "이미 다른
     * 인스턴스가 처리했다"는 예상된 경쟁 결과이므로 예외를 전파하지 않고 경고 로그만 남긴다 — 여기서 전파하면 폴링 스케줄러의 배치 나머지 처리가 조용히 중단된다.
     */
    @Transactional
    public void markSent(Long notificationId, Instant expectedLockedAt) {
        notificationRepository
                .findById(notificationId)
                .ifPresentOrElse(
                        n -> {
                            try {
                                n.markSent(Instant.now(), expectedLockedAt);
                            } catch (NotificationClaimLostException e) {
                                log.warn(
                                        "발송 완료 처리 스킵 — 이미 재수거되어 클레임 소유권을 잃음. notificationId={}",
                                        notificationId);
                            }
                        },
                        () ->
                                log.warn(
                                        "markSent 대상 알림을 찾을 수 없습니다. notificationId={}",
                                        notificationId));
    }

    /** {@link #markSent} 와 같은 이유로 {@code expectedLockedAt} 을 받고, 소유권을 잃은 경우 예외를 삼킨다. */
    @Transactional
    public void markFailed(
            Long notificationId, NotificationErrorType errorType, Instant expectedLockedAt) {
        notificationRepository
                .findById(notificationId)
                .ifPresentOrElse(
                        n -> {
                            try {
                                n.markFailed(errorType, expectedLockedAt);
                            } catch (NotificationClaimLostException e) {
                                log.warn(
                                        "실패 처리 스킵 — 이미 재수거되어 클레임 소유권을 잃음. notificationId={}",
                                        notificationId);
                            }
                        },
                        () ->
                                log.warn(
                                        "markFailed 대상 알림을 찾을 수 없습니다. notificationId={}",
                                        notificationId));
    }
}
