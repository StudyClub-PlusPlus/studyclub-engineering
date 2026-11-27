package com.studyclub.api.event;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doCallRealMethod;
import static org.mockito.Mockito.doThrow;

import com.studyclub.domain.event.ClubEvent;
import com.studyclub.domain.event.ClubEventRegistrationPort;
import com.studyclub.domain.event.ClubEventRegistrationsDeclinedEvent;
import com.studyclub.domain.event.ClubEventRepository;
import com.studyclub.domain.event.EventChannel;
import com.studyclub.domain.event.EventConfirmation;
import com.studyclub.domain.event.EventDraft;
import com.studyclub.domain.event.registration.ClubEventRegistration;
import com.studyclub.domain.event.registration.ClubEventRegistrationRepository;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

/**
 * 행사 종료 시 확인 대기 자동 전환 (specs/event-participant 「행사 종료 시 확인 대기 자동 전환」). 스케줄러는 테스트 설정에서 꺼져 있어 서비스를 직접
 * 부른다.
 */
@SpringBootTest
@Import(ClubEventEndSettlementIntegrationTest.RecorderConfig.class)
class ClubEventEndSettlementIntegrationTest {

    private static final long CAPTAIN = 7301L;

    @Autowired ClubEventEndSettlementService settlementService;
    @Autowired ClubEventEndSettlementScheduler scheduler;
    @Autowired ClubEventRepository clubEventRepository;
    @Autowired ClubEventRegistrationRepository registrationRepository;
    @Autowired JdbcTemplate jdbcTemplate;
    @Autowired DeclinedRecorder recorder;

    @MockitoSpyBean ClubEventRegistrationPort registrationPort;

    private Instant now;

    @TestConfiguration
    static class RecorderConfig {
        @Bean
        DeclinedRecorder declinedRecorder() {
            return new DeclinedRecorder();
        }

        @Bean
        ClubEventEndSettlementScheduler clubEventEndSettlementScheduler(
                ClubEventEndSettlementService service) {
            return new ClubEventEndSettlementScheduler(service);
        }
    }

    static class DeclinedRecorder {
        final List<ClubEventRegistrationsDeclinedEvent> events = new CopyOnWriteArrayList<>();

        @EventListener
        void on(ClubEventRegistrationsDeclinedEvent event) {
            events.add(event);
        }
    }

    @BeforeEach
    void setUp() {
        cleanUp();
        recorder.events.clear();
        now = Instant.now().truncatedTo(ChronoUnit.SECONDS);
    }

    @AfterEach
    void cleanUp() {
        jdbcTemplate.update("DELETE FROM NOTIFICATION WHERE EVENT_TYPE LIKE 'EVENT_%'");
        jdbcTemplate.update("DELETE FROM CLUB_EVENT_REGISTRATION");
        jdbcTemplate.update("DELETE FROM CLUB_EVENT_QUESTION");
        jdbcTemplate.update("DELETE FROM CLUB_EVENT_CHANNEL");
        jdbcTemplate.update("DELETE FROM CLUB_EVENT");
    }

    @Test
    @DisplayName("종료된 행사의 확인 대기만 참가 불가 · 바꾼 사람 없음, 참가 확정은 그대로. 이벤트 EVENT_ENDED 한 번")
    void declinesPendingOfEndedEvent() {
        long eventId = createEvent();
        long pending1 = register(eventId);
        long pending2 = register(eventId);
        long confirmed = register(eventId);
        setStatus(confirmed, "CONFIRMED");
        endEvent(eventId);

        assertThat(settlementService.findCandidates(now)).containsExactly(eventId);
        assertThat(settlementService.settle(eventId, now)).isEqualTo(2);

        for (long id : List.of(pending1, pending2)) {
            assertThat(statusOf(id)).isEqualTo("DECLINED");
            assertThat(changedBy(id)).isNull();
        }
        assertThat(statusOf(confirmed)).isEqualTo("CONFIRMED");
        assertThat(recorder.events)
                .singleElement()
                .satisfies(
                        event -> {
                            assertThat(event.clubEventId()).isEqualTo(eventId);
                            assertThat(event.registrationIds()).containsExactly(pending1, pending2);
                            assertThat(event.cause())
                                    .isEqualTo(
                                            ClubEventRegistrationsDeclinedEvent.Cause.EVENT_ENDED);
                            assertThat(event.meta().actorId()).isNull();
                        });
    }

    @Test
    @DisplayName("취소된 행사 · 종료 전 행사(시작 뒤 포함)는 후보가 아니고, 직접 불러도 건너뛴다")
    void skipsCancelledAndNotEnded() {
        long cancelled = createEvent();
        long inCancelled = register(cancelled);
        endEvent(cancelled);
        jdbcTemplate.update("UPDATE CLUB_EVENT SET STATUS = 'CANCELLED' WHERE ID = ?", cancelled);
        long running = createEvent();
        long inRunning = register(running);
        moveTimes(
                running,
                now.minus(Duration.ofHours(2)),
                now.minus(Duration.ofHours(1)),
                now.plus(Duration.ofHours(1)));

        assertThat(settlementService.findCandidates(now)).isEmpty();
        assertThat(settlementService.settle(cancelled, now)).isZero();
        assertThat(settlementService.settle(running, now)).isZero();

        assertThat(statusOf(inCancelled)).isEqualTo("PENDING");
        assertThat(statusOf(inRunning)).isEqualTo("PENDING");
        assertThat(recorder.events).isEmpty();
    }

    @Test
    @DisplayName("후보를 고른 뒤 종료 시각을 늘리면 잠금 뒤 다시 판정해 건너뛴다")
    void rechecksAfterLock() {
        long eventId = createEvent();
        long pending = register(eventId);
        endEvent(eventId);
        assertThat(settlementService.findCandidates(now)).containsExactly(eventId);

        jdbcTemplate.update(
                "UPDATE CLUB_EVENT SET ENDS_AT = ? WHERE ID = ?",
                Timestamp.from(now.plus(Duration.ofHours(1))),
                eventId);

        assertThat(settlementService.settle(eventId, now)).isZero();
        assertThat(statusOf(pending)).isEqualTo("PENDING");
        assertThat(recorder.events).isEmpty();
    }

    @Test
    @DisplayName("두 번 연속 실행해도 이벤트는 한 번 — 두 번째는 바꿀 확인 대기가 없다")
    void idempotent() {
        long eventId = createEvent();
        register(eventId);
        endEvent(eventId);

        assertThat(settlementService.settle(eventId, now)).isEqualTo(1);
        assertThat(settlementService.settle(eventId, now)).isZero();
        assertThat(settlementService.findCandidates(now)).isEmpty();
        assertThat(recorder.events).hasSize(1);
    }

    @Test
    @DisplayName("스케줄러 — 한 행사의 실패가 다음 행사를 막지 않는다. 실패한 행사는 롤백되어 다음 주기에 다시 후보다")
    void failureDoesNotBlockOthers() {
        long failing = createEvent();
        long inFailing = register(failing);
        endEvent(failing);
        long healthy = createEvent();
        long inHealthy = register(healthy);
        endEvent(healthy);
        doThrow(new IllegalStateException("boom"))
                .when(registrationPort)
                .declinePendingRegistrationsForEventEnd(eq(failing));

        try {
            scheduler.run();
        } finally {
            doCallRealMethod().when(registrationPort).declinePendingRegistrationsForEventEnd(any());
        }

        assertThat(statusOf(inFailing)).isEqualTo("PENDING");
        assertThat(statusOf(inHealthy)).isEqualTo("DECLINED");
        assertThat(recorder.events)
                .singleElement()
                .satisfies(event -> assertThat(event.clubEventId()).isEqualTo(healthy));
        assertThat(settlementService.findCandidates(Instant.now())).containsExactly(failing);
    }

    // ── 도우미 ─────────────────────────────────────────────────────────────

    private long createEvent() {
        Instant startsAt = now.plus(Duration.ofDays(5));
        EventDraft draft =
                new EventDraft(
                        "연말 네트워킹 밋업",
                        "한 해를 마무리하며 크루끼리 만나요",
                        "행사 소개",
                        "Asia/Seoul",
                        startsAt,
                        startsAt.plus(Duration.ofHours(3)),
                        startsAt.minus(Duration.ofDays(1)),
                        EventConfirmation.REVIEW,
                        List.of(
                                com.studyclub.domain.event.ChannelDraft.online(
                                        100, "https://meet.example.com/abc")),
                        List.of());
        return clubEventRepository
                .saveAndFlush(ClubEvent.publish(draft, CAPTAIN, UUID.randomUUID().toString(), now))
                .getId();
    }

    private long register(long eventId) {
        return registrationRepository
                .saveAndFlush(
                        ClubEventRegistration.submit(
                                eventId,
                                CAPTAIN + 100 + registrationRepository.count(),
                                EventChannel.ONLINE,
                                EventConfirmation.REVIEW,
                                "Asia/Seoul",
                                List.of(),
                                Map.of(),
                                UUID.randomUUID().toString()))
                .getId();
    }

    private void endEvent(long eventId) {
        moveTimes(
                eventId,
                now.minus(Duration.ofDays(2)),
                now.minus(Duration.ofDays(1)),
                now.minus(Duration.ofMinutes(1)));
    }

    private void moveTimes(long eventId, Instant deadline, Instant startsAt, Instant endsAt) {
        jdbcTemplate.update(
                "UPDATE CLUB_EVENT SET DEADLINE_AT = ?, STARTS_AT = ?, ENDS_AT = ? WHERE ID = ?",
                Timestamp.from(deadline),
                Timestamp.from(startsAt),
                Timestamp.from(endsAt),
                eventId);
    }

    private void setStatus(long registrationId, String status) {
        jdbcTemplate.update(
                "UPDATE CLUB_EVENT_REGISTRATION SET STATUS = ? WHERE ID = ?",
                status,
                registrationId);
    }

    private String statusOf(long registrationId) {
        return jdbcTemplate.queryForObject(
                "SELECT STATUS FROM CLUB_EVENT_REGISTRATION WHERE ID = ?",
                String.class,
                registrationId);
    }

    private Long changedBy(long registrationId) {
        return jdbcTemplate.queryForObject(
                "SELECT STATUS_CHANGED_BY FROM CLUB_EVENT_REGISTRATION WHERE ID = ?",
                Long.class,
                registrationId);
    }
}
