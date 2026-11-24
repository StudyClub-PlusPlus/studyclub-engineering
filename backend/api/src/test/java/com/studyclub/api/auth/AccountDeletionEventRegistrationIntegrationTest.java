package com.studyclub.api.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountIdentity;
import com.studyclub.domain.account.AccountIdentityRepository;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.Issuer;
import com.studyclub.domain.account.SystemRole;
import com.studyclub.domain.event.ClubEventRegistrationPort;
import com.studyclub.domain.event.ClubEventRepository;
import com.studyclub.domain.event.EventChannel;
import com.studyclub.domain.event.EventConfirmation;
import com.studyclub.domain.event.EventSeatCounts;
import com.studyclub.domain.event.registration.ClubEventRegistration;
import com.studyclub.domain.event.registration.ClubEventRegistrationCancelReason;
import com.studyclub.domain.event.registration.ClubEventRegistrationRepository;
import com.studyclub.domain.event.registration.ClubEventRegistrationStatus;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.TestRestTemplate;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureTestRestTemplate;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

/**
 * 회원 탈퇴의 행사 신청 단계 (specs/event-registration/spec.md 「탈퇴할 때」 · user-leave 처리 순서). 종료 전 행사의 확인 대기 ·
 * 참가 확정 신청만 {@code ACCOUNT_DELETED} 로 취소하고, 잠금은 계정 → 행사(ID 오름차순) 순서다.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class AccountDeletionEventRegistrationIntegrationTest {

    private static final long OPEN_EVENT = 8301L;
    private static final long SECOND_OPEN_EVENT = 8302L;
    private static final long ENDED_EVENT = 8303L;
    private static final long CANCELLED_EVENT = 8304L;
    private static final long DECLINED_EVENT = 8305L;
    private static final List<Long> EVENTS =
            List.of(OPEN_EVENT, SECOND_OPEN_EVENT, ENDED_EVENT, CANCELLED_EVENT, DECLINED_EVENT);

    @Autowired TestRestTemplate rest;
    @Autowired JwtService jwt;
    @Autowired ClubEventRegistrationRepository registrationRepository;
    @Autowired ClubEventRegistrationPort registrationPort;
    @Autowired JdbcTemplate jdbcTemplate;
    @Autowired AccountIdentityRepository accountIdentityRepository;

    /** 애플 연결 해제는 외부 호출이라 목으로 — 순서만 본다. */
    @MockitoBean AppleOAuthClient appleOAuthClient;

    @MockitoSpyBean AccountRepository accountRepository;
    @MockitoSpyBean ClubEventRepository clubEventRepository;

    private final List<Long> otherAccounts = new ArrayList<>();

    @BeforeEach
    void setUp() {
        rest.getRestTemplate().setRequestFactory(new JdkClientHttpRequestFactory());
        Instant now = Instant.now();
        Duration day = Duration.ofDays(1);
        insertEvent(OPEN_EVENT, now.plus(day.multipliedBy(3)), "PUBLISHED");
        insertEvent(SECOND_OPEN_EVENT, now.plus(day.multipliedBy(4)), "CLOSED");
        insertEvent(ENDED_EVENT, now.minus(day.multipliedBy(2)), "PUBLISHED");
        insertEvent(CANCELLED_EVENT, now.plus(day.multipliedBy(5)), "CANCELLED");
        insertEvent(DECLINED_EVENT, now.plus(day.multipliedBy(6)), "PUBLISHED");
    }

    @AfterEach
    void cleanUp() {
        for (Long eventId : EVENTS) {
            jdbcTemplate.update(
                    "DELETE FROM CLUB_EVENT_REGISTRATION WHERE CLUB_EVENT_ID = ?", eventId);
            jdbcTemplate.update("DELETE FROM CLUB_EVENT WHERE ID = ?", eventId);
        }
        otherAccounts.forEach(accountRepository::deleteById);
        otherAccounts.clear();
    }

    @Test
    @DisplayName(
            "종료 전 행사의 확인 대기 · 참가 확정만 ACCOUNT_DELETED 로 취소해 자리를 돌려준다. 종료 · 취소 행사와 끝난 이력 · 다른 사람 신청은 그대로")
    void cancelsOnlyOpenActiveRegistrations() {
        Account leaver = seedAccount();
        Account other = seedAccount();
        otherAccounts.add(other.getId());
        Long selfCancelledBefore =
                register(
                        OPEN_EVENT,
                        leaver,
                        ClubEventRegistrationStatus.CANCELLED,
                        ClubEventRegistrationCancelReason.SELF_CANCELLED);
        Long confirmed = register(OPEN_EVENT, leaver, ClubEventRegistrationStatus.CONFIRMED, null);
        Long pending =
                register(SECOND_OPEN_EVENT, leaver, ClubEventRegistrationStatus.PENDING, null);
        Long othersPending =
                register(SECOND_OPEN_EVENT, other, ClubEventRegistrationStatus.PENDING, null);
        Long ended = register(ENDED_EVENT, leaver, ClubEventRegistrationStatus.CONFIRMED, null);
        Long onCancelledEvent =
                register(CANCELLED_EVENT, leaver, ClubEventRegistrationStatus.PENDING, null);
        Long declined =
                register(DECLINED_EVENT, leaver, ClubEventRegistrationStatus.DECLINED, null);

        assertThat(delete(leaver).getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);

        for (Long id : List.of(confirmed, pending)) {
            ClubEventRegistration registration = registrationRepository.findById(id).orElseThrow();
            assertThat(registration.getStatus()).isEqualTo(ClubEventRegistrationStatus.CANCELLED);
            assertThat(registration.getCancelReason())
                    .isEqualTo(ClubEventRegistrationCancelReason.ACCOUNT_DELETED);
            assertThat(registration.getStatusChangedBy()).isNull();
            assertThat(registration.getStatusChangedAt()).isNotNull();
            // 계정 행이 지워져도 신청 행의 ID 참조는 남는다 — 운영진 목록이 「탈퇴한 회원」으로 그린다
            assertThat(registration.getAccountId()).isEqualTo(leaver.getId());
        }
        assertThat(
                        registrationRepository
                                .findById(selfCancelledBefore)
                                .orElseThrow()
                                .getCancelReason())
                .isEqualTo(ClubEventRegistrationCancelReason.SELF_CANCELLED);
        assertStatus(othersPending, ClubEventRegistrationStatus.PENDING);
        assertStatus(ended, ClubEventRegistrationStatus.CONFIRMED);
        assertStatus(onCancelledEvent, ClubEventRegistrationStatus.PENDING);
        assertStatus(declined, ClubEventRegistrationStatus.DECLINED);
        assertThat(registrationPort.countActiveSeats(SECOND_OPEN_EVENT))
                .isEqualTo(new EventSeatCounts(1, 0, 0, 0));
        assertThat(registrationPort.countActiveSeats(OPEN_EVENT)).isEqualTo(EventSeatCounts.none());
    }

    @Test
    @DisplayName(
            "잠금 순서 — 계정을 먼저 잠그고, 애플 연결 해제(외부 호출)가 끝난 뒤 그 계정 신청이 걸린 행사를 취소 · 종료된 것까지 ID 오름차순으로 잠근다")
    void locksAccountThenEventsInIdOrder() {
        Account leaver = seedAccount();
        accountIdentityRepository.save(
                new AccountIdentity(
                        leaver.getId(),
                        Issuer.APPLE,
                        "apple-" + UUID.randomUUID(),
                        leaver.getEmail(),
                        Instant.now(),
                        "apple-refresh-token"));
        // 일부러 ID 역순으로 신청을 만든다
        register(DECLINED_EVENT, leaver, ClubEventRegistrationStatus.DECLINED, null);
        register(CANCELLED_EVENT, leaver, ClubEventRegistrationStatus.PENDING, null);
        register(ENDED_EVENT, leaver, ClubEventRegistrationStatus.CONFIRMED, null);
        register(OPEN_EVENT, leaver, ClubEventRegistrationStatus.PENDING, null);
        register(
                OPEN_EVENT,
                leaver,
                ClubEventRegistrationStatus.CANCELLED,
                ClubEventRegistrationCancelReason.SELF_CANCELLED);

        assertThat(delete(leaver).getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);

        InOrder order = inOrder(accountRepository, appleOAuthClient, clubEventRepository);
        order.verify(accountRepository).findByIdForUpdate(leaver.getId());
        // 외부 호출 동안 행사 행 잠금을 잡지 않는다 (PR #516 리뷰)
        order.verify(appleOAuthClient).revoke("apple-refresh-token");
        order.verify(clubEventRepository).findByIdForUpdate(OPEN_EVENT);
        order.verify(clubEventRepository).findByIdForUpdate(ENDED_EVENT);
        order.verify(clubEventRepository).findByIdForUpdate(CANCELLED_EVENT);
        order.verify(clubEventRepository).findByIdForUpdate(DECLINED_EVENT);
        verify(clubEventRepository, never()).findByIdForUpdate(SECOND_OPEN_EVENT);
    }

    @Test
    @DisplayName("행사 신청이 없는 회원의 탈퇴는 행사 행을 잠그지 않는다")
    void noRegistrationsNoEventLock() {
        Account leaver = seedAccount();

        assertThat(delete(leaver).getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);

        verify(clubEventRepository, never()).findByIdForUpdate(anyLong());
    }

    private void assertStatus(Long registrationId, ClubEventRegistrationStatus expected) {
        assertThat(registrationRepository.findById(registrationId).orElseThrow().getStatus())
                .isEqualTo(expected);
    }

    private Account seedAccount() {
        String email = "event-leave-" + UUID.randomUUID() + "@example.com";
        String nickname = "e" + UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        Account account =
                accountRepository.save(new Account(email, nickname, null, SystemRole.MEMBER));
        account.completeOnboarding(nickname, "Asia/Seoul", Instant.now());
        return accountRepository.save(account);
    }

    private org.springframework.http.ResponseEntity<Void> delete(Account account) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(jwt.issueAccess(String.valueOf(account.getId()), account.getEmail()));
        return rest.exchange(
                "/api/me",
                HttpMethod.DELETE,
                new HttpEntity<>(Map.of("reason", "NO_DESIRED_STUDY"), headers),
                Void.class);
    }

    private Long register(
            long eventId,
            Account account,
            ClubEventRegistrationStatus status,
            ClubEventRegistrationCancelReason reason) {
        Long id =
                registrationRepository
                        .save(
                                ClubEventRegistration.submit(
                                        eventId,
                                        account.getId(),
                                        EventChannel.ONLINE,
                                        EventConfirmation.REVIEW,
                                        account.getTimeZone(),
                                        List.of(),
                                        Map.of(),
                                        UUID.randomUUID().toString()))
                        .getId();
        if (status != ClubEventRegistrationStatus.PENDING) {
            jdbcTemplate.update(
                    "UPDATE CLUB_EVENT_REGISTRATION SET STATUS = ?, CANCEL_REASON = ? WHERE ID = ?",
                    status.name(),
                    reason == null ? null : reason.name(),
                    id);
        }
        return id;
    }

    /** 시작 뒤 3시간에 끝나는 행사. 마감은 시작 1시간 전. */
    private void insertEvent(long id, Instant startsAt, String status) {
        Timestamp at = Timestamp.from(Instant.now());
        jdbcTemplate.update(
                "INSERT INTO CLUB_EVENT (ID, TITLE, SUMMARY, DESCRIPTION, TIME_ZONE, STARTS_AT,"
                        + " ENDS_AT, DEADLINE_AT, CONFIRMATION, STATUS, PUBLISHED_AT, VERSION,"
                        + " CREATED_BY, CREATE_IDEMPOTENCY_KEY, CREATED_AT, UPDATED_AT)"
                        + " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                id,
                "행사 " + id,
                "요약",
                "설명",
                "Asia/Seoul",
                Timestamp.from(startsAt),
                Timestamp.from(startsAt.plus(Duration.ofHours(3))),
                Timestamp.from(startsAt.minus(Duration.ofHours(1))),
                "REVIEW",
                status,
                at,
                0L,
                1L,
                UUID.randomUUID().toString(),
                at,
                at);
    }
}
