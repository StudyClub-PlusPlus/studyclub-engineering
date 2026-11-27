package com.studyclub.api.event;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.verify;

import com.studyclub.api.analytics.AmplitudeClient;
import com.studyclub.api.analytics.AnalyticsPrivacyService;
import com.studyclub.api.auth.JwtService;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.SystemRole;
import com.studyclub.domain.audit.AdminAuditLogRepository;
import com.studyclub.domain.event.ClubEventRegistrationsCancelledEvent;
import com.studyclub.domain.event.ClubEventRegistrationsConfirmedEvent;
import com.studyclub.domain.event.ClubEventRegistrationsDeclinedEvent;
import com.studyclub.domain.event.EventChannel;
import com.studyclub.domain.event.EventConfirmation;
import com.studyclub.domain.event.EventQuestionType;
import com.studyclub.domain.event.registration.ClubEventRegistration;
import com.studyclub.domain.event.registration.ClubEventRegistrationRepository;
import com.studyclub.domain.event.registration.RegistrationQuestion;
import java.net.URI;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.function.Consumer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.TestRestTemplate;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureTestRestTemplate;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.event.EventListener;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

/**
 * 백오피스 행사 참가자 (specs/event-participant/spec.md). 행사는 API 로 만들고, 신청은 저장소로 넣는다. 종료 · 취소 상태는 JDBC 로 시각
 * · 상태만 옮긴다.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
@Import(AdminClubEventRegistrationIntegrationTest.RecorderConfig.class)
class AdminClubEventRegistrationIntegrationTest {

    private static final String PATH = "/api/admin/events";
    private static final long ADMIN_ID = 7101L;
    private static final long MEMBER_ID = 7102L;
    private static final long CREW_A = 7111L;
    private static final long CREW_B = 7112L;
    private static final long WITHDRAWN = 7199L;
    private static final List<Long> ACCOUNTS = List.of(ADMIN_ID, MEMBER_ID, CREW_A, CREW_B);
    private static final long MISSING_ID = 987_654_321L;

    @Autowired TestRestTemplate rest;
    @Autowired JwtService jwtService;
    @Autowired AccountRepository accountRepository;
    @Autowired ClubEventRegistrationRepository registrationRepository;
    @Autowired JdbcTemplate jdbcTemplate;
    @Autowired DecisionRecorder recorder;

    @MockitoSpyBean AdminAuditLogRepository auditLogRepository;
    @MockitoSpyBean AmplitudeClient amplitude;
    @MockitoSpyBean AnalyticsPrivacyService analyticsPrivacy;

    private Instant now;

    @TestConfiguration
    static class RecorderConfig {
        @Bean
        DecisionRecorder decisionRecorder() {
            return new DecisionRecorder();
        }
    }

    static class DecisionRecorder {
        final List<Object> events = new CopyOnWriteArrayList<>();

        @EventListener
        void on(ClubEventRegistrationsConfirmedEvent event) {
            events.add(event);
        }

        @EventListener
        void on(ClubEventRegistrationsDeclinedEvent event) {
            events.add(event);
        }

        @EventListener
        void on(ClubEventRegistrationsCancelledEvent event) {
            events.add(event);
        }
    }

    @BeforeEach
    void setUp() {
        rest.getRestTemplate().setRequestFactory(new JdkClientHttpRequestFactory());
        cleanUp();
        insertAccount(ADMIN_ID, SystemRole.ADMIN);
        insertAccount(MEMBER_ID, SystemRole.MEMBER);
        insertAccount(CREW_A, SystemRole.MEMBER);
        insertAccount(CREW_B, SystemRole.MEMBER);
        recorder.events.clear();
        now = Instant.now().truncatedTo(ChronoUnit.MINUTES);
    }

    @AfterEach
    void cleanUp() {
        jdbcTemplate.update(
                "DELETE FROM ADMIN_AUDIT_LOG WHERE ACTION = 'EMAIL_REVEAL' AND ACTOR_ACCOUNT_ID = ?",
                ADMIN_ID);
        jdbcTemplate.update("DELETE FROM NOTIFICATION WHERE EVENT_TYPE LIKE 'EVENT_%'");
        jdbcTemplate.update("DELETE FROM CLUB_EVENT_REGISTRATION");
        jdbcTemplate.update("DELETE FROM CLUB_EVENT_QUESTION");
        jdbcTemplate.update("DELETE FROM CLUB_EVENT_CHANNEL");
        jdbcTemplate.update("DELETE FROM CLUB_EVENT");
        for (long id : ACCOUNTS) {
            jdbcTemplate.update("DELETE FROM ACCOUNT WHERE ID = ?", id);
        }
    }

    // ── 인가 · 404 ─────────────────────────────────────────────────────────

    @Test
    @DisplayName("인가 — 네 경로 모두 토큰 없음 401, 크루 403(없는 ID 라도), 캡틴이면 없는 행사 404")
    void authorization() {
        String list = PATH + "/" + MISSING_ID + "/registrations";
        String one = list + "/" + MISSING_ID;
        Map<String, Object> confirm = decision("CONFIRMED");

        for (Object[] call :
                new Object[][] {
                    {HttpMethod.GET, list, null},
                    {HttpMethod.GET, one, null},
                    {HttpMethod.POST, one + "/email-reveals", null},
                    {HttpMethod.PATCH, one, confirm}
                }) {
            HttpMethod method = (HttpMethod) call[0];
            String url = (String) call[1];
            @SuppressWarnings("unchecked")
            Map<String, Object> body = (Map<String, Object>) call[2];
            assertError(anonymous(method, url, body), HttpStatus.UNAUTHORIZED, "UNAUTHORIZED");
            assertError(send(method, url, MEMBER_ID, body), HttpStatus.FORBIDDEN, "FORBIDDEN");
            assertError(send(method, url, ADMIN_ID, body), HttpStatus.NOT_FOUND, "NOT_FOUND");
        }
        assertThat(revealRows()).isZero();
    }

    @Test
    @DisplayName("404 — 없는 신청 · 다른 행사의 신청은 신청서 · 이메일 보기 · 참가 처리 모두 404, 감사 기록 없음")
    void registrationOfOtherEvent() {
        long eventId = create();
        long otherEventId = create();
        long foreign = register(otherEventId, CREW_A, EventChannel.ONLINE);

        for (long registrationId : List.of(foreign, MISSING_ID)) {
            String one = registrationPath(eventId, registrationId);
            assertError(get(one), HttpStatus.NOT_FOUND, "NOT_FOUND");
            assertError(revealEmail(eventId, registrationId), HttpStatus.NOT_FOUND, "NOT_FOUND");
            assertError(
                    patch(eventId, registrationId, "CONFIRMED"), HttpStatus.NOT_FOUND, "NOT_FOUND");
        }
        assertThat(revealRows()).isZero();
        assertThat(statusOf(foreign)).isEqualTo("PENDING");
    }

    // ── 목록 ───────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("참가자 목록")
    class ListRegistrations {

        @Test
        @DisplayName("최신 신청순 · 취소 뒤 재신청은 두 행 · 마스킹 이메일 · 탈퇴 계정 행 · 행별 판정 · 확인 대기 수")
        void list() {
            long eventId = create();
            long withdrawn = register(eventId, WITHDRAWN, EventChannel.OFFLINE);
            setStatus(withdrawn, "CANCELLED", "ACCOUNT_DELETED");
            long first = register(eventId, CREW_A, EventChannel.OFFLINE);
            setStatus(first, "CANCELLED", "SELF_CANCELLED");
            long confirmed = register(eventId, CREW_B, EventChannel.OFFLINE);
            setStatus(confirmed, "CONFIRMED", null);
            long latest = register(eventId, CREW_A, EventChannel.ONLINE);

            Map<String, Object> body = ok(get(listPath(eventId)));

            assertThat(body)
                    .containsEntry("canManageRegistrations", true)
                    .containsEntry("pendingCount", 1)
                    .containsEntry("total", 4)
                    .containsEntry("offset", 0)
                    .containsEntry("limit", 20);
            List<Map<String, Object>> items = items(body);
            assertThat(items)
                    .extracting(item -> ((Number) item.get("registrationId")).longValue())
                    .containsExactly(latest, confirmed, first, withdrawn);
            assertThat(items.get(0))
                    .containsEntry("accountId", (int) CREW_A)
                    .containsEntry("nickname", "participant_" + CREW_A)
                    .containsEntry("accountDeleted", false)
                    .containsEntry("maskedEmail", "p***@example.com")
                    .containsEntry("channel", "ONLINE")
                    .containsEntry("status", "PENDING")
                    .containsEntry("canConfirm", true)
                    .containsEntry("canDecline", true)
                    .containsEntry("canCancel", true)
                    .containsKey("createdAt");
            assertThat(items.get(1))
                    .containsEntry("status", "CONFIRMED")
                    .containsEntry("canConfirm", false)
                    .containsEntry("canDecline", false)
                    .containsEntry("canCancel", true);
            assertThat(items.get(2))
                    .containsEntry("accountId", (int) CREW_A)
                    .containsEntry("status", "CANCELLED")
                    .containsEntry("canCancel", false);
            assertThat(items.get(3))
                    .containsEntry("accountDeleted", true)
                    .containsEntry("nickname", null)
                    .containsEntry("maskedEmail", null);
            assertThat(String.valueOf(body)).doesNotContain("participant-" + CREW_A + "@");
        }

        @Test
        @DisplayName(
                "페이지 — 기본 20건, offset 이 limit 배수가 아니어도 된다, offset ≥ total 이면 빈 items 와 실제 total")
        void paging() {
            long eventId = create();
            List<Long> ids = new java.util.ArrayList<>();
            for (int i = 0; i < 23; i++) {
                ids.add(register(eventId, CREW_A, EventChannel.ONLINE));
            }
            List<Long> newestFirst = ids.reversed();

            Map<String, Object> first = ok(get(listPath(eventId)));
            assertThat(items(first)).hasSize(20);
            assertThat(first).containsEntry("total", 23);

            Map<String, Object> shifted = ok(get(listPath(eventId) + "?offset=5&limit=3"));
            assertThat(items(shifted))
                    .extracting(item -> ((Number) item.get("registrationId")).longValue())
                    .containsExactlyElementsOf(newestFirst.subList(5, 8));

            Map<String, Object> beyond = ok(get(listPath(eventId) + "?offset=23"));
            assertThat(items(beyond)).isEmpty();
            assertThat(beyond).containsEntry("total", 23).containsEntry("offset", 23);
        }

        @Test
        @DisplayName("400 — offset 음수 · limit 0 · 101")
        void invalidPaging() {
            long eventId = create();

            assertInvalid(get(listPath(eventId) + "?offset=-1"), "offset");
            assertInvalid(get(listPath(eventId) + "?limit=0"), "limit");
            assertInvalid(get(listPath(eventId) + "?limit=101"), "limit");
        }

        @Test
        @DisplayName("종료된 행사 · 취소된 행사도 조회되고 모든 can* 가 false")
        void endedAndCancelledAreReadOnly() {
            long ended = create();
            register(ended, CREW_A, EventChannel.ONLINE);
            endEvent(ended);
            long cancelled = create();
            long confirmed = register(cancelled, CREW_B, EventChannel.ONLINE);
            setStatus(confirmed, "CONFIRMED", null);
            cancelEvent(cancelled);

            for (long eventId : List.of(ended, cancelled)) {
                Map<String, Object> body = ok(get(listPath(eventId)));
                assertThat(body).containsEntry("canManageRegistrations", false);
                assertThat(items(body))
                        .singleElement()
                        .satisfies(
                                item ->
                                        assertThat(item)
                                                .containsEntry("canConfirm", false)
                                                .containsEntry("canDecline", false)
                                                .containsEntry("canCancel", false));
            }
        }
    }

    // ── 신청서 ─────────────────────────────────────────────────────────────

    @Test
    @DisplayName("신청서 — 신청 당시 질문 순서 그대로, 답은 언제나 배열 · 답 없는 선택 질문은 [], 행사 질문을 고쳐도 사본 그대로")
    void application() {
        long eventId = create();
        List<RegistrationQuestion> questions =
                List.of(
                        new RegistrationQuestion(
                                "q-motive", "참여 동기", EventQuestionType.TEXTAREA, true, List.of()),
                        new RegistrationQuestion(
                                "q-topic",
                                "관심 주제",
                                EventQuestionType.CHECKBOX,
                                false,
                                List.of("AI", "커리어", "네트워킹")),
                        new RegistrationQuestion(
                                "q-note", "남길 말", EventQuestionType.TEXT, false, List.of()));
        Map<String, List<String>> answers = new LinkedHashMap<>();
        answers.put("q-motive", List.of("크루를 만나고 싶어요."));
        answers.put("q-topic", List.of("AI", "네트워킹"));
        long registrationId = register(eventId, CREW_A, EventChannel.OFFLINE, questions, answers);
        jdbcTemplate.update(
                "UPDATE CLUB_EVENT_QUESTION SET LABEL = '바뀐 질문' WHERE CLUB_EVENT_ID = ?", eventId);

        Map<String, Object> body = ok(get(registrationPath(eventId, registrationId)));

        assertThat(body)
                .containsEntry("registrationId", (int) registrationId)
                .containsEntry("nickname", "participant_" + CREW_A)
                .containsEntry("accountDeleted", false)
                .containsEntry("channel", "OFFLINE")
                .containsEntry("status", "PENDING")
                .doesNotContainKey("email")
                .doesNotContainKey("maskedEmail");
        List<Map<String, Object>> rows = list(body, "questions");
        assertThat(rows)
                .extracting(row -> row.get("questionId"))
                .containsExactly("q-motive", "q-topic", "q-note");
        assertThat(rows.get(0))
                .containsEntry("label", "참여 동기")
                .containsEntry("type", "TEXTAREA")
                .containsEntry("required", true)
                .containsEntry("options", List.of())
                .containsEntry("answer", List.of("크루를 만나고 싶어요."));
        assertThat(rows.get(1))
                .containsEntry("options", List.of("AI", "커리어", "네트워킹"))
                .containsEntry("answer", List.of("AI", "네트워킹"));
        assertThat(rows.get(2)).containsEntry("answer", List.of());
    }

    @Test
    @DisplayName("신청서 — 질문 없는 행사였으면 questions = [], 탈퇴 계정이면 nickname null · accountDeleted")
    void applicationWithoutQuestionsOfWithdrawn() {
        long eventId = create();
        long registrationId = register(eventId, WITHDRAWN, EventChannel.ONLINE);

        Map<String, Object> body = ok(get(registrationPath(eventId, registrationId)));

        assertThat(body)
                .containsEntry("nickname", null)
                .containsEntry("accountDeleted", true)
                .containsEntry("questions", List.of());
    }

    // ── 이메일 보기 ─────────────────────────────────────────────────────────

    @Nested
    @DisplayName("이메일 보기")
    class RevealEmail {

        @Test
        @DisplayName("원본 · Cache-Control no-store · EMAIL_REVEAL 한 행(대상 = 신청자). 취소된 행사여도 볼 수 있다")
        void revealsOriginal() {
            long eventId = create();
            long registrationId = register(eventId, CREW_A, EventChannel.ONLINE);
            cancelEvent(eventId);

            ResponseEntity<Map> response = revealEmail(eventId, registrationId);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(response.getHeaders().get(HttpHeaders.CACHE_CONTROL))
                    .containsExactly("no-store");
            assertThat(response.getBody())
                    .containsEntry("registrationId", (int) registrationId)
                    .containsEntry("accountId", (int) CREW_A)
                    .containsEntry("email", "participant-" + CREW_A + "@example.com");
            List<Map<String, Object>> rows =
                    jdbcTemplate.queryForList(
                            "SELECT * FROM ADMIN_AUDIT_LOG WHERE ACTION = 'EMAIL_REVEAL'"
                                    + " AND ACTOR_ACCOUNT_ID = ?",
                            ADMIN_ID);
            assertThat(rows).hasSize(1);
            assertThat(rows.get(0))
                    .containsEntry("TARGET_ACCOUNT_ID", CREW_A)
                    .containsEntry("BEFORE_VALUE", null)
                    .containsEntry("AFTER_VALUE", null);
            assertThat(rows.get(0).get("ACTOR_IP")).isNotNull();
            assertThat(rows.get(0).get("RETENTION_POLICY")).isNotNull();
        }

        @Test
        @DisplayName("탈퇴한 신청자는 404 · 감사 기록 없음")
        void withdrawn() {
            long eventId = create();
            long registrationId = register(eventId, WITHDRAWN, EventChannel.ONLINE);

            assertError(revealEmail(eventId, registrationId), HttpStatus.NOT_FOUND, "NOT_FOUND");
            assertThat(revealRows()).isZero();
        }

        @Test
        @DisplayName("감사 기록이 실패하면 500 이고 원본이 나가지 않는다")
        void auditFailure() {
            long eventId = create();
            long registrationId = register(eventId, CREW_A, EventChannel.ONLINE);
            doThrow(new IllegalStateException("boom")).when(auditLogRepository).save(any());

            ResponseEntity<Map> response = revealEmail(eventId, registrationId);

            assertError(response, HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR");
            assertThat(String.valueOf(response.getBody()))
                    .doesNotContain("participant-" + CREW_A + "@");
            assertThat(revealRows()).isZero();
        }
    }

    // ── 참가 처리 ─────────────────────────────────────────────────────────

    @Nested
    @DisplayName("참가 처리")
    class Decide {

        @Test
        @DisplayName(
                "참가 확정 — 200 · 다시 계산한 can* · STATUS_CHANGED_BY = 캡틴 · ConfirmedEvent · 행사 VERSION 그대로")
        void confirm() {
            long eventId = create();
            long registrationId = register(eventId, CREW_A, EventChannel.ONLINE);

            ResponseEntity<Map> response = patch(eventId, registrationId, "CONFIRMED");

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(response.getBody())
                    .containsEntry("registrationId", (int) registrationId)
                    .containsEntry("status", "CONFIRMED")
                    .containsEntry("maskedEmail", "p***@example.com")
                    .containsEntry("canConfirm", false)
                    .containsEntry("canDecline", false)
                    .containsEntry("canCancel", true);
            assertThat(statusOf(registrationId)).isEqualTo("CONFIRMED");
            assertThat(changedBy(registrationId)).isEqualTo(ADMIN_ID);
            assertThat(versionOf(eventId)).isZero();
            assertThat(recorder.events)
                    .singleElement()
                    .isInstanceOfSatisfying(
                            ClubEventRegistrationsConfirmedEvent.class,
                            event -> {
                                assertThat(event.clubEventId()).isEqualTo(eventId);
                                assertThat(event.registrationIds()).containsExactly(registrationId);
                                assertThat(event.meta().actorId())
                                        .isEqualTo(String.valueOf(ADMIN_ID));
                            });
        }

        @Test
        @DisplayName("참가 불가 — DECLINED · 모든 can* false · DeclinedEvent(ADMIN)")
        void decline() {
            long eventId = create();
            long registrationId = register(eventId, CREW_A, EventChannel.OFFLINE);

            ResponseEntity<Map> response = patch(eventId, registrationId, "DECLINED");

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(response.getBody())
                    .containsEntry("status", "DECLINED")
                    .containsEntry("canCancel", false);
            assertThat(changedBy(registrationId)).isEqualTo(ADMIN_ID);
            assertThat(recorder.events)
                    .singleElement()
                    .isInstanceOfSatisfying(
                            ClubEventRegistrationsDeclinedEvent.class,
                            event -> {
                                assertThat(event.cause())
                                        .isEqualTo(ClubEventRegistrationsDeclinedEvent.Cause.ADMIN);
                                assertThat(event.registrationIds()).containsExactly(registrationId);
                            });
        }

        @Test
        @DisplayName(
                "개별 취소 — 확정된 신청도 취소 · ADMIN_CANCELLED · CancelledEvent(ADMIN) · 분석 cancel_type = admin")
        void cancel() {
            stubAnalytics();
            long eventId = create();
            long registrationId = register(eventId, CREW_A, EventChannel.ONLINE);
            setStatus(registrationId, "CONFIRMED", null);

            ResponseEntity<Map> response = patch(eventId, registrationId, "CANCELLED");

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(response.getBody())
                    .containsEntry("status", "CANCELLED")
                    .containsEntry("canCancel", false);
            assertThat(cancelReasonOf(registrationId)).isEqualTo("ADMIN_CANCELLED");
            assertThat(changedBy(registrationId)).isEqualTo(ADMIN_ID);
            assertThat(recorder.events)
                    .singleElement()
                    .isInstanceOfSatisfying(
                            ClubEventRegistrationsCancelledEvent.class,
                            event ->
                                    assertThat(event.cause())
                                            .isEqualTo(
                                                    ClubEventRegistrationsCancelledEvent.Cause
                                                            .ADMIN));
            verify(amplitude, timeout(5_000))
                    .send(
                            eq("Event Registration Cancelled"),
                            anyString(),
                            eq("event_registration_cancelled_" + registrationId),
                            any(),
                            argThat(
                                    properties ->
                                            "admin".equals(properties.get("cancel_type"))
                                                    && "online".equals(properties.get("channel"))
                                                    && String.valueOf(registrationId)
                                                            .equals(
                                                                    properties.get(
                                                                            "registration_id"))));
        }

        @Test
        @DisplayName("400 — status 누락 · PENDING · 소문자. 아무것도 바뀌지 않는다")
        void invalidStatus() {
            long eventId = create();
            long registrationId = register(eventId, CREW_A, EventChannel.ONLINE);

            assertInvalid(
                    send(
                            HttpMethod.PATCH,
                            registrationPath(eventId, registrationId),
                            ADMIN_ID,
                            new LinkedHashMap<>()),
                    "status");
            assertInvalid(patch(eventId, registrationId, "PENDING"), "status");
            assertInvalid(patch(eventId, registrationId, "confirmed"), "status");
            assertThat(statusOf(registrationId)).isEqualTo("PENDING");
            assertThat(recorder.events).isEmpty();
        }

        @Test
        @DisplayName("409 EVENT_REGISTRATION_STATUS_NOT_ALLOWED — 확정된 신청에 다시 확정 · 참가 불가, 끝난 신청에 취소")
        void statusNotAllowed() {
            long eventId = create();
            long confirmed = register(eventId, CREW_A, EventChannel.ONLINE);
            setStatus(confirmed, "CONFIRMED", null);
            long declined = register(eventId, CREW_B, EventChannel.ONLINE);
            setStatus(declined, "DECLINED", null);

            for (Object[] call :
                    new Object[][] {
                        {confirmed, "CONFIRMED"}, {confirmed, "DECLINED"}, {declined, "CANCELLED"}
                    }) {
                assertError(
                        patch(eventId, (Long) call[0], (String) call[1]),
                        HttpStatus.CONFLICT,
                        "EVENT_REGISTRATION_STATUS_NOT_ALLOWED");
            }
            assertThat(statusOf(confirmed)).isEqualTo("CONFIRMED");
            assertThat(statusOf(declined)).isEqualTo("DECLINED");
            assertThat(recorder.events).isEmpty();
        }

        @Test
        @DisplayName("409 — 취소된 행사 EVENT_CANCELLED, 종료된 행사 EVENT_ENDED. 신청 404 보다 먼저 본다")
        void closedEvents() {
            long cancelled = create();
            long inCancelled = register(cancelled, CREW_A, EventChannel.ONLINE);
            cancelEvent(cancelled);
            long ended = create();
            long inEnded = register(ended, CREW_B, EventChannel.ONLINE);
            endEvent(ended);

            assertError(
                    patch(cancelled, inCancelled, "CONFIRMED"),
                    HttpStatus.CONFLICT,
                    "EVENT_CANCELLED");
            assertError(
                    patch(cancelled, MISSING_ID, "CONFIRMED"),
                    HttpStatus.CONFLICT,
                    "EVENT_CANCELLED");
            assertError(patch(ended, inEnded, "DECLINED"), HttpStatus.CONFLICT, "EVENT_ENDED");
            assertError(patch(ended, MISSING_ID, "DECLINED"), HttpStatus.CONFLICT, "EVENT_ENDED");
            assertThat(statusOf(inEnded)).isEqualTo("PENDING");
            assertThat(recorder.events).isEmpty();
        }

        @Test
        @DisplayName("행사 시작 뒤 · 신청 마감 뒤라도 종료 전이면 처리한다")
        void afterStartBeforeEnd() {
            long eventId = create();
            long registrationId = register(eventId, CREW_A, EventChannel.ONLINE);
            jdbcTemplate.update(
                    "UPDATE CLUB_EVENT SET DEADLINE_AT = ?, STARTS_AT = ?, ENDS_AT = ? WHERE ID = ?",
                    Timestamp.from(now.minus(Duration.ofHours(3))),
                    Timestamp.from(now.minus(Duration.ofHours(1))),
                    Timestamp.from(now.plus(Duration.ofHours(2))),
                    eventId);

            ResponseEntity<Map> response = patch(eventId, registrationId, "CONFIRMED");

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(statusOf(registrationId)).isEqualTo("CONFIRMED");
        }
    }

    // ── 도우미 ─────────────────────────────────────────────────────────────

    private void stubAnalytics() {
        doReturn(true).when(amplitude).enabled();
        doNothing().when(amplitude).send(anyString(), anyString(), anyString(), any(), any());
        doAnswer(
                        invocation -> {
                            Consumer<String> send = invocation.getArgument(2);
                            send.accept("analytics-" + invocation.getArgument(0));
                            return null;
                        })
                .when(analyticsPrivacy)
                .whenAllowed(any(), any(), any());
    }

    private long create() {
        ResponseEntity<Map> response =
                sendWithKey(
                        HttpMethod.POST, PATH, ADMIN_ID, eventBody(), UUID.randomUUID().toString());
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        return ((Number) response.getBody().get("eventId")).longValue();
    }

    private Map<String, Object> eventBody() {
        Instant startsAt = now.plus(Duration.ofDays(5));
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("title", "연말 네트워킹 밋업");
        body.put("summary", "한 해를 마무리하며 크루끼리 만나요");
        body.put("description", "행사 소개");
        body.put("timeZone", "Asia/Seoul");
        body.put("startsAt", startsAt.toString());
        body.put("endsAt", startsAt.plus(Duration.ofHours(3)).toString());
        body.put("deadlineAt", startsAt.minus(Duration.ofDays(1)).toString());
        body.put("format", "HYBRID");
        body.put("offline", Map.of("capacity", 40, "location", "서울 강남구 ○○빌딩 5층"));
        body.put("online", Map.of("capacity", 100, "url", "https://meet.example.com/abc"));
        body.put("confirmation", "REVIEW");
        body.put(
                "questions",
                List.of(
                        Map.of(
                                "label",
                                "참여 동기",
                                "type",
                                "TEXT",
                                "required",
                                false,
                                "options",
                                List.of())));
        return body;
    }

    private long register(long eventId, long accountId, EventChannel channel) {
        return register(eventId, accountId, channel, List.of(), Map.of());
    }

    private long register(
            long eventId,
            long accountId,
            EventChannel channel,
            List<RegistrationQuestion> questions,
            Map<String, List<String>> answers) {
        return registrationRepository
                .saveAndFlush(
                        ClubEventRegistration.submit(
                                eventId,
                                accountId,
                                channel,
                                EventConfirmation.REVIEW,
                                "Asia/Seoul",
                                questions,
                                answers,
                                UUID.randomUUID().toString()))
                .getId();
    }

    private void setStatus(long registrationId, String status, String cancelReason) {
        jdbcTemplate.update(
                "UPDATE CLUB_EVENT_REGISTRATION SET STATUS = ?, CANCEL_REASON = ? WHERE ID = ?",
                status,
                cancelReason,
                registrationId);
    }

    private void endEvent(long eventId) {
        jdbcTemplate.update(
                "UPDATE CLUB_EVENT SET DEADLINE_AT = ?, STARTS_AT = ?, ENDS_AT = ? WHERE ID = ?",
                Timestamp.from(now.minus(Duration.ofDays(2))),
                Timestamp.from(now.minus(Duration.ofDays(1))),
                Timestamp.from(now.minus(Duration.ofHours(20))),
                eventId);
    }

    private void cancelEvent(long eventId) {
        jdbcTemplate.update("UPDATE CLUB_EVENT SET STATUS = 'CANCELLED' WHERE ID = ?", eventId);
    }

    private static Map<String, Object> decision(String status) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("status", status);
        return body;
    }

    private static String listPath(long eventId) {
        return PATH + "/" + eventId + "/registrations";
    }

    private static String registrationPath(long eventId, long registrationId) {
        return listPath(eventId) + "/" + registrationId;
    }

    @SuppressWarnings("rawtypes")
    private ResponseEntity<Map> get(String url) {
        return send(HttpMethod.GET, url, ADMIN_ID, null);
    }

    @SuppressWarnings("rawtypes")
    private ResponseEntity<Map> revealEmail(long eventId, long registrationId) {
        return send(
                HttpMethod.POST,
                registrationPath(eventId, registrationId) + "/email-reveals",
                ADMIN_ID,
                null);
    }

    @SuppressWarnings("rawtypes")
    private ResponseEntity<Map> patch(long eventId, long registrationId, String status) {
        return send(
                HttpMethod.PATCH,
                registrationPath(eventId, registrationId),
                ADMIN_ID,
                decision(status));
    }

    @SuppressWarnings("rawtypes")
    private ResponseEntity<Map> send(
            HttpMethod method, String url, long accountId, Map<String, Object> body) {
        return sendWithKey(method, url, accountId, body, null);
    }

    @SuppressWarnings({"rawtypes", "unchecked"})
    private ResponseEntity<Map> sendWithKey(
            HttpMethod method,
            String url,
            long accountId,
            Map<String, Object> body,
            String idempotencyKey) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        String email = accountRepository.findById(accountId).orElseThrow().getEmail();
        headers.setBearerAuth(jwtService.issueAccess(String.valueOf(accountId), email));
        if (idempotencyKey != null) {
            headers.set("Idempotency-Key", idempotencyKey);
        }
        HttpEntity<Map<String, Object>> entity =
                new HttpEntity<>(method == HttpMethod.GET ? null : body, headers);
        return rest.exchange(URI.create(url), method, entity, Map.class);
    }

    @SuppressWarnings("rawtypes")
    private ResponseEntity<Map> anonymous(HttpMethod method, String url, Map<String, Object> body) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        return rest.exchange(URI.create(url), method, new HttpEntity<>(body, headers), Map.class);
    }

    @SuppressWarnings({"rawtypes", "unchecked"})
    private static Map<String, Object> ok(ResponseEntity<Map> response) {
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        return response.getBody();
    }

    private static List<Map<String, Object>> items(Map<String, Object> body) {
        return list(body, "items");
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> list(Map<String, Object> body, String key) {
        return (List<Map<String, Object>>) body.get(key);
    }

    @SuppressWarnings("rawtypes")
    private static void assertError(
            ResponseEntity<Map> response, HttpStatus status, String errorCode) {
        assertThat(response.getStatusCode()).isEqualTo(status);
        assertThat(response.getBody()).containsEntry("errorCode", errorCode);
    }

    @SuppressWarnings("rawtypes")
    private static void assertInvalid(ResponseEntity<Map> response, String field) {
        assertError(response, HttpStatus.BAD_REQUEST, "INVALID_INPUT");
        assertThat(String.valueOf(response.getBody().get("errorMessage"))).startsWith(field + ":");
    }

    private String statusOf(long registrationId) {
        return jdbcTemplate.queryForObject(
                "SELECT STATUS FROM CLUB_EVENT_REGISTRATION WHERE ID = ?",
                String.class,
                registrationId);
    }

    private String cancelReasonOf(long registrationId) {
        return jdbcTemplate.queryForObject(
                "SELECT CANCEL_REASON FROM CLUB_EVENT_REGISTRATION WHERE ID = ?",
                String.class,
                registrationId);
    }

    private Long changedBy(long registrationId) {
        return jdbcTemplate.queryForObject(
                "SELECT STATUS_CHANGED_BY FROM CLUB_EVENT_REGISTRATION WHERE ID = ?",
                Long.class,
                registrationId);
    }

    private long versionOf(long eventId) {
        return jdbcTemplate.queryForObject(
                "SELECT VERSION FROM CLUB_EVENT WHERE ID = ?", Long.class, eventId);
    }

    private int revealRows() {
        return jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM ADMIN_AUDIT_LOG WHERE ACTION = 'EMAIL_REVEAL'"
                        + " AND ACTOR_ACCOUNT_ID = ?",
                Integer.class,
                ADMIN_ID);
    }

    private void insertAccount(long id, SystemRole role) {
        Timestamp at = Timestamp.from(Instant.now());
        jdbcTemplate.update(
                "INSERT INTO ACCOUNT (ID, EMAIL, NICKNAME, SYSTEM_ROLE, TIME_ZONE,"
                        + " ONBOARDING_COMPLETED_AT, CREATED_AT, UPDATED_AT)"
                        + " VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                id,
                "participant-" + id + "@example.com",
                "participant_" + id,
                role.name(),
                "Asia/Seoul",
                at,
                at,
                at);
    }
}
