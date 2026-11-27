package com.studyclub.api.event;

import java.time.Instant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 1분마다 종료된 행사의 확인 대기 신청을 참가 불가로 바꾼다 ({@link ClubEventEndSettlementService}). 서버가 여러 대면 각자 돌지만 행사 행
 * 잠금이 줄을 세우고 늦은 쪽은 바꿀 신청이 없다.
 *
 * <p>스케줄링을 켜는 다른 설정(정리 작업 · 알림 폴링)은 각자 끌 수 있어 여기서도 켠다. 테스트는 {@code
 * event.end-settlement.enabled=false} 로 끄고 서비스를 직접 부른다.
 */
@Component
@EnableScheduling
@ConditionalOnProperty(value = "event.end-settlement.enabled", matchIfMissing = true)
public class ClubEventEndSettlementScheduler {

    private static final Logger log =
            LoggerFactory.getLogger(ClubEventEndSettlementScheduler.class);

    private final ClubEventEndSettlementService settlementService;

    public ClubEventEndSettlementScheduler(ClubEventEndSettlementService settlementService) {
        this.settlementService = settlementService;
    }

    @Scheduled(fixedDelayString = "${event.end-settlement.fixed-delay-ms:60000}")
    public void run() {
        Instant now = Instant.now();
        for (Long eventId : settlementService.findCandidates(now)) {
            try {
                settlementService.settle(eventId, now);
            } catch (RuntimeException e) {
                log.error("행사 종료 자동 전환 실패 clubEventId={}", eventId, e);
            }
        }
    }
}
