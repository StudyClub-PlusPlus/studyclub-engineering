package com.studyclub.api.event;

import static org.assertj.core.api.Assertions.assertThat;

import com.studyclub.domain.event.ClubEventRegistrationPort;
import com.studyclub.domain.event.EventChannel;
import com.studyclub.domain.event.EventConfirmation;
import com.studyclub.domain.event.EventQuestionType;
import com.studyclub.domain.event.EventSeatCounts;
import com.studyclub.domain.event.registration.ClubEventRegistration;
import com.studyclub.domain.event.registration.ClubEventRegistrationCancelReason;
import com.studyclub.domain.event.registration.ClubEventRegistrationRepository;
import com.studyclub.domain.event.registration.ClubEventRegistrationStatus;
import com.studyclub.domain.event.registration.RegistrationQuestion;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * 실제 신청 테이블로 답하는 {@link ClubEventRegistrationPort} (specs/event-participant
 * 「ClubEventRegistrationPort 연결」). 신청은 행사 행과 FK 가 없어 행사 행 없이 신청 행만 만든다.
 */
@SpringBootTest
class ClubEventRegistrationAdapterIntegrationTest {

    private static final long EVENT_A = 8101L;
    private static final long EVENT_B = 8102L;
    private static final long EVENT_EMPTY = 8103L;
    private static final long CAPTAIN = 8190L;

    @Autowired ClubEventRegistrationPort port;
    @Autowired ClubEventRegistrationRepository repository;
    @Autowired JdbcTemplate jdbcTemplate;
    @Autowired TransactionTemplate transactionTemplate;

    private long nextAccount = 8200L;

    @AfterEach
    void cleanUp() {
        jdbcTemplate.update(
                "DELETE FROM CLUB_EVENT_REGISTRATION WHERE CLUB_EVENT_ID IN (?, ?, ?)",
                EVENT_A,
                EVENT_B,
                EVENT_EMPTY);
    }

    @Test
    @DisplayName("방식 · 상태별 수 — 확인 대기 · 참가 확정만 세고, 참가 불가 · 취소는 자리를 반환한 것이라 뺀다. 신청 없는 행사는 맵에 없다")
    void countsActiveSeats() {
        register(EVENT_A, EventChannel.ONLINE, ClubEventRegistrationStatus.PENDING);
        register(EVENT_A, EventChannel.ONLINE, ClubEventRegistrationStatus.PENDING);
        register(EVENT_A, EventChannel.ONLINE, ClubEventRegistrationStatus.CONFIRMED);
        register(EVENT_A, EventChannel.ONLINE, ClubEventRegistrationStatus.CANCELLED);
        register(EVENT_A, EventChannel.OFFLINE, ClubEventRegistrationStatus.CONFIRMED);
        register(EVENT_A, EventChannel.OFFLINE, ClubEventRegistrationStatus.DECLINED);
        register(EVENT_B, EventChannel.OFFLINE, ClubEventRegistrationStatus.PENDING);

        Map<Long, EventSeatCounts> counts =
                port.countActiveSeatsByEventIds(List.of(EVENT_A, EVENT_B, EVENT_EMPTY));

        assertThat(counts)
                .containsOnlyKeys(EVENT_A, EVENT_B)
                .containsEntry(EVENT_A, new EventSeatCounts(2, 1, 0, 1))
                .containsEntry(EVENT_B, new EventSeatCounts(0, 0, 1, 0));
        assertThat(port.countActiveSeats(EVENT_A)).isEqualTo(new EventSeatCounts(2, 1, 0, 1));
        assertThat(port.countActiveSeats(EVENT_EMPTY)).isEqualTo(EventSeatCounts.none());
        assertThat(port.countActiveSeatsByEventIds(List.of())).isEmpty();
    }

    @Test
    @DisplayName("일괄 확정 — 그 행사의 확인 대기만 참가 확정으로 바꾸고 바꾼 ID 를 돌려준다. 바꾼 사람은 캡틴. 다시 부르면 바꿀 것이 없다")
    void confirmsPendingOnly() {
        Long pending1 = register(EVENT_A, EventChannel.ONLINE, ClubEventRegistrationStatus.PENDING);
        Long pending2 =
                register(EVENT_A, EventChannel.OFFLINE, ClubEventRegistrationStatus.PENDING);
        Long confirmed =
                register(EVENT_A, EventChannel.ONLINE, ClubEventRegistrationStatus.CONFIRMED);
        Long cancelled =
                register(EVENT_A, EventChannel.ONLINE, ClubEventRegistrationStatus.CANCELLED);
        Long otherEvent =
                register(EVENT_B, EventChannel.ONLINE, ClubEventRegistrationStatus.PENDING);

        List<Long> changed =
                transactionTemplate.execute(
                        status -> port.confirmPendingRegistrations(EVENT_A, CAPTAIN));

        assertThat(changed).containsExactly(pending1, pending2);
        for (Long id : List.of(pending1, pending2)) {
            ClubEventRegistration registration = repository.findById(id).orElseThrow();
            assertThat(registration.getStatus()).isEqualTo(ClubEventRegistrationStatus.CONFIRMED);
            assertThat(registration.getStatusChangedBy()).isEqualTo(CAPTAIN);
            assertThat(registration.getStatusChangedAt()).isNotNull();
        }
        assertThat(repository.findById(confirmed).orElseThrow().getStatusChangedBy()).isNull();
        assertThat(repository.findById(cancelled).orElseThrow().getStatus())
                .isEqualTo(ClubEventRegistrationStatus.CANCELLED);
        assertThat(repository.findById(otherEvent).orElseThrow().getStatus())
                .isEqualTo(ClubEventRegistrationStatus.PENDING);
        List<Long> again =
                transactionTemplate.execute(
                        status -> port.confirmPendingRegistrations(EVENT_A, CAPTAIN));
        assertThat(again).isEmpty();
    }

    @Test
    @DisplayName(
            "행사 취소 — 확인 대기 · 참가 확정만 CANCELLED · EVENT_CANCELLED 로 바꾸고 바꾼 ID 를 돌려준다. 바꾼 사람 · 시각 · UPDATED_AT 을 채운다")
    void cancelsActiveForEventCancellation() {
        Long pending = register(EVENT_A, EventChannel.ONLINE, ClubEventRegistrationStatus.PENDING);
        Long confirmed =
                register(EVENT_A, EventChannel.OFFLINE, ClubEventRegistrationStatus.CONFIRMED);
        Long declined =
                register(EVENT_A, EventChannel.ONLINE, ClubEventRegistrationStatus.DECLINED);
        Long selfCancelled =
                register(EVENT_A, EventChannel.ONLINE, ClubEventRegistrationStatus.CANCELLED);
        jdbcTemplate.update(
                "UPDATE CLUB_EVENT_REGISTRATION SET CANCEL_REASON = 'SELF_CANCELLED' WHERE ID = ?",
                selfCancelled);
        Long otherEvent =
                register(EVENT_B, EventChannel.ONLINE, ClubEventRegistrationStatus.PENDING);
        Instant old = Instant.parse("2026-01-01T00:00:00Z");
        jdbcTemplate.update(
                "UPDATE CLUB_EVENT_REGISTRATION SET UPDATED_AT = ? WHERE CLUB_EVENT_ID IN (?, ?)",
                Timestamp.from(old),
                EVENT_A,
                EVENT_B);

        List<Long> changed =
                transactionTemplate.execute(
                        status ->
                                port.cancelActiveRegistrationsForEventCancellation(
                                        EVENT_A, CAPTAIN));

        assertThat(changed).containsExactly(pending, confirmed);
        for (Long id : List.of(pending, confirmed)) {
            ClubEventRegistration registration = repository.findById(id).orElseThrow();
            assertThat(registration.getStatus()).isEqualTo(ClubEventRegistrationStatus.CANCELLED);
            assertThat(registration.getCancelReason())
                    .isEqualTo(ClubEventRegistrationCancelReason.EVENT_CANCELLED);
            assertThat(registration.getStatusChangedBy()).isEqualTo(CAPTAIN);
            assertThat(registration.getStatusChangedAt()).isNotNull();
            assertThat(registration.getUpdatedAt()).isAfter(old);
        }
        assertThat(repository.findById(declined).orElseThrow().getStatus())
                .isEqualTo(ClubEventRegistrationStatus.DECLINED);
        ClubEventRegistration self = repository.findById(selfCancelled).orElseThrow();
        assertThat(self.getCancelReason())
                .isEqualTo(ClubEventRegistrationCancelReason.SELF_CANCELLED);
        assertThat(self.getUpdatedAt()).isEqualTo(old);
        assertThat(repository.findById(otherEvent).orElseThrow().getStatus())
                .isEqualTo(ClubEventRegistrationStatus.PENDING);
        List<Long> again =
                transactionTemplate.execute(
                        status ->
                                port.cancelActiveRegistrationsForEventCancellation(
                                        EVENT_A, CAPTAIN));
        assertThat(again).isEmpty();
    }

    @Test
    @DisplayName(
            "취소 안내 대상 수 — 취소 전엔 유효 신청, 취소 뒤엔 EVENT_CANCELLED 신청 중 계정이 남은 수. 참가 불가 · 다른 사유 취소는 빠진다")
    void countsCancellationRecipients() {
        long kept = 8301L;
        long kept2 = 8302L;
        long other = 8303L;
        try {
            for (long id : List.of(kept, kept2, other)) {
                insertAccount(id);
            }
            registerFor(EVENT_A, kept, ClubEventRegistrationStatus.PENDING);
            registerFor(EVENT_A, kept2, ClubEventRegistrationStatus.CONFIRMED);
            registerFor(EVENT_A, nextAccount++, ClubEventRegistrationStatus.CONFIRMED);
            registerFor(EVENT_A, other, ClubEventRegistrationStatus.DECLINED);
            Long selfCancelled = registerFor(EVENT_A, other, ClubEventRegistrationStatus.CANCELLED);
            jdbcTemplate.update(
                    "UPDATE CLUB_EVENT_REGISTRATION SET CANCEL_REASON = 'SELF_CANCELLED' WHERE ID = ?",
                    selfCancelled);

            assertThat(port.countCancellationRecipients(EVENT_A)).isEqualTo(2);
            assertThat(port.countCancellationRecipients(EVENT_EMPTY)).isZero();

            transactionTemplate.execute(
                    status -> port.cancelActiveRegistrationsForEventCancellation(EVENT_A, CAPTAIN));
            assertThat(port.countCancellationRecipients(EVENT_A)).isEqualTo(2);

            jdbcTemplate.update("DELETE FROM ACCOUNT WHERE ID = ?", kept);
            assertThat(port.countCancellationRecipients(EVENT_A)).isEqualTo(1);
        } finally {
            for (long id : List.of(kept, kept2, other)) {
                jdbcTemplate.update("DELETE FROM ACCOUNT WHERE ID = ?", id);
            }
        }
    }

    @Test
    @DisplayName("종료 자동 전환 — 그 행사의 확인 대기만 참가 불가로 바꾸고 바꾼 ID 를 돌려준다. 바꾼 사람은 없고 시각 · UPDATED_AT 을 채운다")
    void declinesPendingForEventEnd() {
        Long pending1 = register(EVENT_A, EventChannel.ONLINE, ClubEventRegistrationStatus.PENDING);
        Long pending2 =
                register(EVENT_A, EventChannel.OFFLINE, ClubEventRegistrationStatus.PENDING);
        Long confirmed =
                register(EVENT_A, EventChannel.ONLINE, ClubEventRegistrationStatus.CONFIRMED);
        Long otherEvent =
                register(EVENT_B, EventChannel.ONLINE, ClubEventRegistrationStatus.PENDING);
        Instant old = Instant.parse("2026-01-01T00:00:00Z");
        jdbcTemplate.update(
                "UPDATE CLUB_EVENT_REGISTRATION SET UPDATED_AT = ? WHERE CLUB_EVENT_ID IN (?, ?)",
                Timestamp.from(old),
                EVENT_A,
                EVENT_B);

        List<Long> changed =
                transactionTemplate.execute(
                        status -> port.declinePendingRegistrationsForEventEnd(EVENT_A));

        assertThat(changed).containsExactly(pending1, pending2);
        for (Long id : List.of(pending1, pending2)) {
            ClubEventRegistration registration = repository.findById(id).orElseThrow();
            assertThat(registration.getStatus()).isEqualTo(ClubEventRegistrationStatus.DECLINED);
            assertThat(registration.getStatusChangedBy()).isNull();
            assertThat(registration.getStatusChangedAt()).isNotNull();
            assertThat(registration.getUpdatedAt()).isAfter(old);
        }
        ClubEventRegistration kept = repository.findById(confirmed).orElseThrow();
        assertThat(kept.getStatus()).isEqualTo(ClubEventRegistrationStatus.CONFIRMED);
        assertThat(kept.getUpdatedAt()).isEqualTo(old);
        assertThat(repository.findById(otherEvent).orElseThrow().getStatus())
                .isEqualTo(ClubEventRegistrationStatus.PENDING);
        List<Long> again =
                transactionTemplate.execute(
                        status -> port.declinePendingRegistrationsForEventEnd(EVENT_A));
        assertThat(again).isEmpty();
    }

    @Test
    @DisplayName("참가자 목록 쿼리 — 최신 신청순 페이지 · 전체 수, 확인 대기가 있는 행사 ID")
    void pageAndCandidates() {
        Long first = register(EVENT_A, EventChannel.ONLINE, ClubEventRegistrationStatus.CANCELLED);
        Long second = register(EVENT_A, EventChannel.ONLINE, ClubEventRegistrationStatus.PENDING);
        Long third = register(EVENT_A, EventChannel.OFFLINE, ClubEventRegistrationStatus.CONFIRMED);
        register(EVENT_B, EventChannel.ONLINE, ClubEventRegistrationStatus.CONFIRMED);

        assertThat(repository.findPageByClubEventId(EVENT_A, 0, 2))
                .extracting(ClubEventRegistration::getId)
                .containsExactly(third, second);
        assertThat(repository.findPageByClubEventId(EVENT_A, 1, 5))
                .extracting(ClubEventRegistration::getId)
                .containsExactly(second, first);
        assertThat(repository.countByClubEventId(EVENT_A)).isEqualTo(3);
        assertThat(repository.findDistinctClubEventIdsByStatus(ClubEventRegistrationStatus.PENDING))
                .contains(EVENT_A)
                .doesNotContain(EVENT_B);
    }

    @Test
    @DisplayName("질문 · 답 사본은 JSON 으로 저장돼 순서 · 선택지까지 그대로 읽힌다")
    void snapshotsRoundTrip() {
        List<RegistrationQuestion> questions =
                List.of(
                        new RegistrationQuestion(
                                "q-text", "참여 계기", EventQuestionType.TEXTAREA, true, List.of()),
                        new RegistrationQuestion(
                                "q-pick",
                                "관심 주제",
                                EventQuestionType.CHECKBOX,
                                false,
                                List.of("백엔드", "프론트엔드", "디자인")));
        Map<String, List<String>> answers =
                Map.of("q-text", List.of("첫 줄\n둘째 줄"), "q-pick", List.of("백엔드", "디자인"));
        Long id =
                repository
                        .save(
                                ClubEventRegistration.submit(
                                        EVENT_A,
                                        nextAccount++,
                                        EventChannel.OFFLINE,
                                        EventConfirmation.AUTO,
                                        null,
                                        questions,
                                        answers,
                                        UUID.randomUUID().toString()))
                        .getId();

        ClubEventRegistration saved = repository.findById(id).orElseThrow();

        assertThat(saved.getQuestionsSnapshot()).isEqualTo(questions);
        assertThat(saved.getAnswersSnapshot()).isEqualTo(answers);
        assertThat(saved.getApplicantTimeZone()).isNull();
        assertThat(saved.getCreatedAt()).isNotNull();
    }

    private Long register(long eventId, EventChannel channel, ClubEventRegistrationStatus status) {
        return register(eventId, nextAccount++, channel, status);
    }

    private Long registerFor(long eventId, long accountId, ClubEventRegistrationStatus status) {
        return register(eventId, accountId, EventChannel.ONLINE, status);
    }

    private void insertAccount(long id) {
        Timestamp at = Timestamp.from(Instant.now());
        jdbcTemplate.update(
                "INSERT INTO ACCOUNT (ID, EMAIL, NICKNAME, SYSTEM_ROLE, TIME_ZONE,"
                        + " ONBOARDING_COMPLETED_AT, CREATED_AT, UPDATED_AT)"
                        + " VALUES (?, ?, ?, 'MEMBER', 'Asia/Seoul', ?, ?, ?)",
                id,
                "adapter-" + id + "@example.com",
                "adapter_" + id,
                at,
                at,
                at);
    }

    private Long register(
            long eventId,
            long accountId,
            EventChannel channel,
            ClubEventRegistrationStatus status) {
        Long id =
                repository
                        .save(
                                ClubEventRegistration.submit(
                                        eventId,
                                        accountId,
                                        channel,
                                        EventConfirmation.REVIEW,
                                        "Asia/Seoul",
                                        List.of(),
                                        Map.of(),
                                        UUID.randomUUID().toString()))
                        .getId();
        if (status != ClubEventRegistrationStatus.PENDING) {
            jdbcTemplate.update(
                    "UPDATE CLUB_EVENT_REGISTRATION SET STATUS = ? WHERE ID = ?",
                    status.name(),
                    id);
        }
        return id;
    }
}
