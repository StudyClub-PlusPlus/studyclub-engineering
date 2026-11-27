package com.studyclub.api.event;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyIterable;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.verify;

import com.studyclub.api.auth.JwtService;
import com.studyclub.api.ops.OpsAlertNotifier;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.SystemRole;
import com.studyclub.domain.event.EventChannel;
import com.studyclub.domain.event.EventConfirmation;
import com.studyclub.domain.event.mail.ClubEventMailTemplateMissing;
import com.studyclub.domain.event.registration.ClubEventRegistration;
import com.studyclub.domain.event.registration.ClubEventRegistrationRepository;
import com.studyclub.notification.NotificationChannel;
import com.studyclub.notification.NotificationEventType;
import com.studyclub.notification.NotificationRepository;
import com.studyclub.notification.NotificationTemplate;
import com.studyclub.notification.NotificationTemplateRepository;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
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
 * 신청 상태 자동 메일 (specs/event-mail 「자동 메일: 신청 상태 알림」). 실제 API 로 신청 · 처리하고, 처리 트랜잭션에 메일 행이 함께 생기는지 본다.
 * 테스트 DB 는 Flyway 를 끄므로 템플릿을 저장소로 넣는다.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
@Import(ClubEventRegistrationEmailIntegrationTest.RecorderConfig.class)
class ClubEventRegistrationEmailIntegrationTest {

    private static final String ADMIN_PATH = "/api/admin/events";
    private static final long ADMIN_ID = 7501L;
    private static final long CREW = 7511L;
    private static final long OTHER_CREW = 7512L;
    private static final List<Long> ACCOUNTS = List.of(ADMIN_ID, CREW, OTHER_CREW);

    @Autowired TestRestTemplate rest;
    @Autowired JwtService jwtService;
    @Autowired AccountRepository accountRepository;
    @Autowired ClubEventRegistrationRepository registrationRepository;
    @Autowired NotificationTemplateRepository templateRepository;
    @Autowired ClubEventEndSettlementService settlementService;
    @Autowired JdbcTemplate jdbcTemplate;
    @Autowired MissingRecorder recorder;

    @MockitoSpyBean NotificationRepository notificationRepository;
    @MockitoSpyBean OpsAlertNotifier opsAlertNotifier;

    private Instant now;

    @TestConfiguration
    static class RecorderConfig {
        @Bean
        MissingRecorder missingRecorder() {
            return new MissingRecorder();
        }
    }

    static class MissingRecorder {
        final List<ClubEventMailTemplateMissing> events = new CopyOnWriteArrayList<>();

        @EventListener
        void on(ClubEventMailTemplateMissing event) {
            events.add(event);
        }
    }

    @BeforeEach
    void setUp() {
        rest.getRestTemplate().setRequestFactory(new JdkClientHttpRequestFactory());
        cleanUp();
        insertAccount(ADMIN_ID, SystemRole.ADMIN);
        insertAccount(CREW, SystemRole.MEMBER);
        insertAccount(OTHER_CREW, SystemRole.MEMBER);
        recorder.events.clear();
        now = Instant.now().truncatedTo(ChronoUnit.MINUTES);
    }

    @AfterEach
    void cleanUp() {
        jdbcTemplate.update("DELETE FROM NOTIFICATION WHERE EVENT_TYPE LIKE 'EVENT_%'");
        jdbcTemplate.update("DELETE FROM NOTIFICATION_TEMPLATE WHERE EVENT_TYPE LIKE 'EVENT_%'");
        jdbcTemplate.update("DELETE FROM ADMIN_AUDIT_LOG WHERE ACTOR_ACCOUNT_ID = ?", ADMIN_ID);
        jdbcTemplate.update("DELETE FROM CLUB_EVENT_REGISTRATION");
        jdbcTemplate.update("DELETE FROM CLUB_EVENT_QUESTION");
        jdbcTemplate.update("DELETE FROM CLUB_EVENT_CHANNEL");
        jdbcTemplate.update("DELETE FROM CLUB_EVENT");
        for (long id : ACCOUNTS) {
            jdbcTemplate.update("DELETE FROM ACCOUNT WHERE ID = ?", id);
        }
    }

    @Test
    @DisplayName("신청 접수 — 운영진 확인 행사는 확인 대기 메일, 자동 확정 행사는 참가 확정 메일(참여 링크 포함). 각각 한 행 · 원문 스냅샷")
    void submitted() {
        givenAllTemplates();
        long review = createEvent("REVIEW");
        long auto = createEvent("AUTO");

        long pendingId = submit(review, CREW);
        long confirmedId = submit(auto, OTHER_CREW);

        assertThat(rows("EVENT_REGISTRATION_PENDING"))
                .singleElement()
                .satisfies(
                        row -> {
                            assertThat(row)
                                    .containsEntry("REFERENCE_ID", pendingId)
                                    .containsEntry("RECIPIENT_USER_ID", CREW)
                                    .containsEntry("SENDER_ACCOUNT_ID", null)
                                    .containsEntry("BODY_TEMPLATE", body("PENDING"));
                            assertThat(payload(row)).contains("\"participation\":\"\"");
                        });
        assertThat(rows("EVENT_REGISTRATION_CONFIRMED"))
                .singleElement()
                .satisfies(
                        row -> {
                            assertThat(row).containsEntry("REFERENCE_ID", confirmedId);
                            assertThat(payload(row)).contains("https://meet.example.com/abc");
                        });
    }

    @Test
    @DisplayName("운영진 확정 · 참가 불가 · 개별 취소와 본인 취소가 각각 메일 한 행")
    void adminDecisionsAndSelfCancel() {
        givenAllTemplates();
        long eventId = createEvent("REVIEW");
        long toConfirm = register(eventId, CREW);
        long toDecline = register(eventId, OTHER_CREW);

        assertThat(decide(eventId, toConfirm, "CONFIRMED")).isEqualTo(HttpStatus.OK);
        assertThat(decide(eventId, toDecline, "DECLINED")).isEqualTo(HttpStatus.OK);
        assertThat(decide(eventId, toConfirm, "CANCELLED")).isEqualTo(HttpStatus.OK);

        assertThat(references("EVENT_REGISTRATION_CONFIRMED")).containsExactly(toConfirm);
        assertThat(references("EVENT_REGISTRATION_DECLINED")).containsExactly(toDecline);
        assertThat(references("EVENT_REGISTRATION_CANCELLED")).containsExactly(toConfirm);

        long selfCancelled = submit(eventId, CREW);
        ResponseEntity<Map> cancelled =
                exchange(
                        HttpMethod.DELETE,
                        "/api/events/"
                                + eventId
                                + "/registrations/me?registrationId="
                                + selfCancelled,
                        CREW,
                        null,
                        null);
        assertThat(cancelled.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(references("EVENT_REGISTRATION_CANCELLED"))
                .containsExactlyInAnyOrder(toConfirm, selfCancelled);
    }

    @Test
    @DisplayName("확정 방식 REVIEW → AUTO 전환은 일괄 확정된 신청마다 확정 메일 (event T020)")
    void switchToAuto() {
        givenAllTemplates();
        long eventId = createEvent("REVIEW");
        long first = register(eventId, CREW);
        long second = register(eventId, OTHER_CREW);
        Map<String, Object> body = editable(detail(eventId));
        body.put("confirmation", "AUTO");

        ResponseEntity<Map> response =
                exchange(HttpMethod.PUT, ADMIN_PATH + "/" + eventId, ADMIN_ID, body, null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(references("EVENT_REGISTRATION_CONFIRMED"))
                .containsExactlyInAnyOrder(first, second);
    }

    @Test
    @DisplayName("행사 종료 자동 전환은 바뀐 신청마다 참가 불가 메일")
    void endSettlement() {
        givenAllTemplates();
        long eventId = createEvent("REVIEW");
        long pending = register(eventId, CREW);
        jdbcTemplate.update(
                "UPDATE CLUB_EVENT SET DEADLINE_AT = ?, STARTS_AT = ?, ENDS_AT = ? WHERE ID = ?",
                Timestamp.from(now.minus(Duration.ofDays(2))),
                Timestamp.from(now.minus(Duration.ofDays(1))),
                Timestamp.from(now.minus(Duration.ofMinutes(5))),
                eventId);

        assertThat(settlementService.settle(eventId, Instant.now())).isEqualTo(1);

        assertThat(references("EVENT_REGISTRATION_DECLINED")).containsExactly(pending);
    }

    @Test
    @DisplayName("행사 전체 취소 · 회원 탈퇴는 자동 메일을 만들지 않는다")
    void eventCancellationAndDeletionMakeNoMail() {
        givenAllTemplates();
        long eventId = createEvent("REVIEW");
        register(eventId, CREW);
        long otherEvent = createEvent("REVIEW");
        register(otherEvent, OTHER_CREW);

        Map<String, Object> status = new LinkedHashMap<>();
        status.put("status", "CANCELLED");
        status.put("version", 0);
        assertThat(
                        exchange(
                                        HttpMethod.PATCH,
                                        ADMIN_PATH + "/" + eventId + "/status",
                                        ADMIN_ID,
                                        status,
                                        null)
                                .getStatusCode())
                .isEqualTo(HttpStatus.OK);
        assertThat(
                        exchange(
                                        HttpMethod.DELETE,
                                        "/api/me",
                                        OTHER_CREW,
                                        Map.of("reason", "NO_DESIRED_STUDY"),
                                        null)
                                .getStatusCode()
                                .is2xxSuccessful())
                .isTrue();

        assertThat(
                        jdbcTemplate.queryForObject(
                                "SELECT COUNT(*) FROM NOTIFICATION WHERE EVENT_TYPE LIKE 'EVENT_REGISTRATION_%'",
                                Integer.class))
                .isZero();
    }

    @Test
    @DisplayName("템플릿이 없으면 처리는 커밋하고 메일만 건너뛰며 신청마다 누락 사실을 남긴다 (M2)")
    void templateMissingCommits() {
        long eventId = createEvent("REVIEW");
        long registrationId = register(eventId, CREW);

        assertThat(decide(eventId, registrationId, "DECLINED")).isEqualTo(HttpStatus.OK);

        assertThat(statusOf(registrationId)).isEqualTo("DECLINED");
        assertThat(rows("EVENT_REGISTRATION_DECLINED")).isEmpty();
        assertThat(recorder.events)
                .singleElement()
                .satisfies(
                        event -> {
                            assertThat(event.eventType()).isEqualTo("EVENT_REGISTRATION_DECLINED");
                            assertThat(event.clubEventId()).isEqualTo(eventId);
                            assertThat(event.registrationId()).isEqualTo(registrationId);
                        });
        verify(opsAlertNotifier, timeout(5_000))
                .send(
                        eq(OpsAlertNotifier.Level.WARN),
                        eq("행사 자동 메일 템플릿 없음"),
                        argThat(
                                fields ->
                                        "EVENT_REGISTRATION_DECLINED".equals(fields.get("알림 조건"))
                                                && String.valueOf(eventId)
                                                        .equals(fields.get("행사 ID"))));
    }

    @Test
    @DisplayName("템플릿은 있는데 메일 행 저장이 실패하면 처리 전체가 롤백된다")
    void rowFailureRollsBack() {
        givenAllTemplates();
        long eventId = createEvent("REVIEW");
        long registrationId = register(eventId, CREW);
        doThrow(new IllegalStateException("boom"))
                .when(notificationRepository)
                .saveAll(anyIterable());

        assertThat(decide(eventId, registrationId, "CONFIRMED"))
                .isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);

        assertThat(statusOf(registrationId)).isEqualTo("PENDING");
        assertThat(rows("EVENT_REGISTRATION_CONFIRMED")).isEmpty();
    }

    // ── 도우미 ─────────────────────────────────────────────────────────────

    private void givenAllTemplates() {
        for (String suffix : List.of("PENDING", "CONFIRMED", "DECLINED", "CANCELLED")) {
            templateRepository.saveAndFlush(
                    new NotificationTemplate(
                            NotificationEventType.valueOf("EVENT_REGISTRATION_" + suffix),
                            NotificationChannel.EMAIL,
                            "[StudyClub] {{eventTitle}} " + suffix,
                            body(suffix)));
        }
    }

    private static String body(String suffix) {
        return "<p>{{nickname}} "
                + suffix
                + " {{eventSchedule}} {{channel}}</p>"
                + (suffix.equals("CONFIRMED") ? "<p>{{participation}}</p>" : "");
    }

    private long createEvent(String confirmation) {
        Instant startsAt = now.plus(Duration.ofDays(5));
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("title", "연말 네트워킹 밋업");
        body.put("summary", "한 해를 마무리하며 크루끼리 만나요");
        body.put("description", "행사 소개");
        body.put("timeZone", "Asia/Seoul");
        body.put("startsAt", startsAt.toString());
        body.put("endsAt", startsAt.plus(Duration.ofHours(3)).toString());
        body.put("deadlineAt", startsAt.minus(Duration.ofDays(1)).toString());
        body.put("format", "ONLINE");
        body.put("online", Map.of("capacity", 100, "url", "https://meet.example.com/abc"));
        body.put("confirmation", confirmation);
        ResponseEntity<Map> response =
                exchange(HttpMethod.POST, ADMIN_PATH, ADMIN_ID, body, UUID.randomUUID().toString());
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        return ((Number) response.getBody().get("eventId")).longValue();
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> detail(long eventId) {
        return exchange(HttpMethod.GET, ADMIN_PATH + "/" + eventId, ADMIN_ID, null, null).getBody();
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> editable(Map<String, Object> detail) {
        Map<String, Object> body = new LinkedHashMap<>();
        for (String field :
                List.of(
                        "version",
                        "title",
                        "summary",
                        "description",
                        "timeZone",
                        "startsAt",
                        "endsAt",
                        "deadlineAt",
                        "format",
                        "confirmation",
                        "online")) {
            body.put(field, detail.get(field));
        }
        List<Map<String, Object>> questions = new ArrayList<>();
        for (Map<String, Object> question : (List<Map<String, Object>>) detail.get("questions")) {
            questions.add(new LinkedHashMap<>(question));
        }
        body.put("questions", questions);
        return body;
    }

    /** 사이트 API 로 신청한다 — 접수 이벤트 · 자동 메일이 실제 경로로 난다. */
    private long submit(long eventId, long accountId) {
        Map<String, Object> eventDetail =
                exchange(HttpMethod.GET, "/api/events/" + eventId, accountId, null, null).getBody();
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("channel", "ONLINE");
        body.put("questionVersion", eventDetail.get("questionVersion"));
        body.put("answers", Map.of());
        ResponseEntity<Map> response =
                exchange(
                        HttpMethod.POST,
                        "/api/events/" + eventId + "/registrations",
                        accountId,
                        body,
                        UUID.randomUUID().toString());
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        return ((Number) response.getBody().get("registrationId")).longValue();
    }

    /** 이벤트 없이 신청 행만 넣는다 — 처리 단계의 메일만 보려고. */
    private long register(long eventId, long accountId) {
        return registrationRepository
                .saveAndFlush(
                        ClubEventRegistration.submit(
                                eventId,
                                accountId,
                                EventChannel.ONLINE,
                                EventConfirmation.REVIEW,
                                "Asia/Seoul",
                                List.of(),
                                Map.of(),
                                UUID.randomUUID().toString()))
                .getId();
    }

    private HttpStatus decide(long eventId, long registrationId, String status) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("status", status);
        return HttpStatus.valueOf(
                exchange(
                                HttpMethod.PATCH,
                                ADMIN_PATH + "/" + eventId + "/registrations/" + registrationId,
                                ADMIN_ID,
                                body,
                                null)
                        .getStatusCode()
                        .value());
    }

    @SuppressWarnings({"rawtypes", "unchecked"})
    private ResponseEntity<Map> exchange(
            HttpMethod method, String url, long accountId, Map<String, Object> body, String key) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        String email = accountRepository.findById(accountId).orElseThrow().getEmail();
        headers.setBearerAuth(jwtService.issueAccess(String.valueOf(accountId), email));
        if (key != null) {
            headers.set("Idempotency-Key", key);
        }
        return rest.exchange(
                URI.create(url),
                method,
                new HttpEntity<>(method == HttpMethod.GET ? null : body, headers),
                Map.class);
    }

    private List<Map<String, Object>> rows(String eventType) {
        return jdbcTemplate.queryForList(
                "SELECT * FROM NOTIFICATION WHERE EVENT_TYPE = ? ORDER BY ID", eventType);
    }

    private List<Long> references(String eventType) {
        return jdbcTemplate.queryForList(
                "SELECT REFERENCE_ID FROM NOTIFICATION WHERE EVENT_TYPE = ? ORDER BY ID",
                Long.class,
                eventType);
    }

    private static String payload(Map<String, Object> row) {
        Object value = row.get("PAYLOAD");
        return value instanceof byte[] json
                ? new String(json, StandardCharsets.UTF_8)
                : String.valueOf(value);
    }

    private String statusOf(long registrationId) {
        return jdbcTemplate.queryForObject(
                "SELECT STATUS FROM CLUB_EVENT_REGISTRATION WHERE ID = ?",
                String.class,
                registrationId);
    }

    private void insertAccount(long id, SystemRole role) {
        Timestamp at = Timestamp.from(Instant.now());
        jdbcTemplate.update(
                "INSERT INTO ACCOUNT (ID, EMAIL, NICKNAME, SYSTEM_ROLE, TIME_ZONE,"
                        + " ONBOARDING_COMPLETED_AT, CREATED_AT, UPDATED_AT)"
                        + " VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                id,
                "automail-" + id + "@example.com",
                "automail_" + id,
                role.name(),
                "Asia/Seoul",
                at,
                at,
                at);
    }
}
