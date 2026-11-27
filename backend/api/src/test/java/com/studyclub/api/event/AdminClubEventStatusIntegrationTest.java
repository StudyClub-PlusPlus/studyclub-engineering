package com.studyclub.api.event;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;

import com.studyclub.api.auth.JwtService;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.SystemRole;
import com.studyclub.domain.audit.AdminAuditLogRepository;
import com.studyclub.domain.event.ClubEventCancelledEvent;
import com.studyclub.domain.event.ClubEventRegistrationsCancelledEvent;
import com.studyclub.domain.event.EventChannel;
import com.studyclub.domain.event.EventConfirmation;
import com.studyclub.domain.event.registration.ClubEventRegistration;
import com.studyclub.domain.event.registration.ClubEventRegistrationRepository;
import com.studyclub.domain.event.registration.ClubEventRegistrationStatus;
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
 * 백오피스 행사 상태 전환 (specs/event-status/spec.md). 실제 신청 테이블로 일괄 취소 · 안내 대상 수를 본다. 행사는 API 로 만들고, 신청 마감
 * · 시작 · 종료가 지난 상태는 JDBC 로 시각만 옮긴다.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class AdminClubEventStatusIntegrationTest {

    private static final String PATH = "/api/admin/events";
    private static final long ADMIN_ID = 6901L;
    private static final long OTHER_ADMIN_ID = 6902L;
    private static final long MEMBER_ID = 6903L;
    private static final long CREW_A = 6911L;
    private static final long CREW_B = 6912L;
    private static final long CREW_C = 6913L;
    private static final long CREW_D = 6914L;
    private static final long CREW_E = 6915L;
    private static final List<Long> ACCOUNTS =
            List.of(ADMIN_ID, OTHER_ADMIN_ID, MEMBER_ID, CREW_A, CREW_B, CREW_C, CREW_D, CREW_E);
    private static final long MISSING_EVENT_ID = 987_654_321L;
    private static final List<String> JUDGMENT_FIELDS =
            List.of(
                    "canClose",
                    "canReopen",
                    "reopenBlockedReason",
                    "canCancel",
                    "hasCancellationRecipients",
                    "cancellationRecipientCount");

    @Autowired TestRestTemplate rest;
    @Autowired JwtService jwtService;
    @Autowired AccountRepository accountRepository;
    @Autowired ClubEventRegistrationRepository registrationRepository;
    @Autowired JdbcTemplate jdbcTemplate;
    @Autowired CancelEventRecorder recorder;

    @MockitoSpyBean AdminAuditLogRepository auditLogRepository;

    private Instant now;

    @TestConfiguration
    static class RecorderConfig {
        @Bean
        CancelEventRecorder cancelEventRecorder() {
            return new CancelEventRecorder();
        }
    }

    static class CancelEventRecorder {
        final List<ClubEventCancelledEvent> eventCancelled = new CopyOnWriteArrayList<>();
        final List<ClubEventRegistrationsCancelledEvent> registrationsCancelled =
                new CopyOnWriteArrayList<>();

        @EventListener
        void on(ClubEventCancelledEvent event) {
            eventCancelled.add(event);
        }

        @EventListener
        void on(ClubEventRegistrationsCancelledEvent event) {
            registrationsCancelled.add(event);
        }
    }

    @BeforeEach
    void setUp() {
        rest.getRestTemplate().setRequestFactory(new JdkClientHttpRequestFactory());
        cleanUp();
        insertAccount(ADMIN_ID, SystemRole.ADMIN);
        insertAccount(OTHER_ADMIN_ID, SystemRole.ADMIN);
        insertAccount(MEMBER_ID, SystemRole.MEMBER);
        for (long crew : List.of(CREW_A, CREW_B, CREW_C, CREW_D, CREW_E)) {
            insertAccount(crew, SystemRole.MEMBER);
        }
        recorder.eventCancelled.clear();
        recorder.registrationsCancelled.clear();
        now = Instant.now().truncatedTo(ChronoUnit.MINUTES);
    }

    @AfterEach
    void cleanUp() {
        jdbcTemplate.update("DELETE FROM ADMIN_AUDIT_LOG WHERE ACTION = 'EVENT_CANCEL'");
        jdbcTemplate.update("DELETE FROM CLUB_EVENT_REGISTRATION");
        jdbcTemplate.update("DELETE FROM CLUB_EVENT_QUESTION");
        jdbcTemplate.update("DELETE FROM CLUB_EVENT_CHANNEL");
        jdbcTemplate.update("DELETE FROM CLUB_EVENT");
        for (long id : ACCOUNTS) {
            jdbcTemplate.update("DELETE FROM ACCOUNT WHERE ID = ?", id);
        }
    }

    // ── 인가 · 입력 ─────────────────────────────────────────────────────────

    @Test
    @DisplayName("인가 — 토큰 없음 401, 크루 403. 없는 행사 ID 라도 403 이 먼저, 캡틴이면 404")
    void authorization() {
        String missing = statusPath(MISSING_EVENT_ID);
        Map<String, Object> body = status("CLOSED", 0);

        assertError(anonymous(missing, body), HttpStatus.UNAUTHORIZED, "UNAUTHORIZED");
        assertError(patch(missing, MEMBER_ID, body), HttpStatus.FORBIDDEN, "FORBIDDEN");
        assertError(patch(missing, ADMIN_ID, body), HttpStatus.NOT_FOUND, "NOT_FOUND");
    }

    @Test
    @DisplayName("400 — status 누락 · 허용 밖 값(PENDING 포함), version 누락 · 음수. 메시지에 필드 이름이 있다")
    void invalidInput() {
        long eventId = create();
        String path = statusPath(eventId);

        Map<String, Object> noStatus = new LinkedHashMap<>();
        noStatus.put("version", 0);
        assertInvalid(patch(path, ADMIN_ID, noStatus), "status");
        assertInvalid(patch(path, ADMIN_ID, status("PENDING", 0)), "status");
        assertInvalid(patch(path, ADMIN_ID, status("closed", 0)), "status");
        Map<String, Object> noVersion = new LinkedHashMap<>();
        noVersion.put("status", "CLOSED");
        assertInvalid(patch(path, ADMIN_ID, noVersion), "version");
        assertInvalid(patch(path, ADMIN_ID, status("CLOSED", -1)), "version");

        assertThat(statusOf(eventId)).isEqualTo("PUBLISHED");
        assertThat(versionOf(eventId)).isZero();
    }

    // ── 모집 마감 · 재모집 ──────────────────────────────────────────────────

    @Test
    @DisplayName("모집 마감 — 200 · 버전 + 1 · RECRUITMENT_CLOSED. 판정 필드가 마감 상태로 바뀐다. 감사 기록 · 취소 이벤트 없음")
    void close() {
        long eventId = create();

        ResponseEntity<Map> response = patch(statusPath(eventId), ADMIN_ID, status("CLOSED", 0));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody())
                .containsKeys(JUDGMENT_FIELDS.toArray(String[]::new))
                .containsEntry("status", "CLOSED")
                .containsEntry("displayStatus", "RECRUITMENT_CLOSED")
                .containsEntry("version", 1)
                .containsEntry("canClose", false)
                .containsEntry("canReopen", true)
                .containsEntry("reopenBlockedReason", null)
                .containsEntry("canCancel", true);
        assertThat(versionOf(eventId)).isEqualTo(1L);
        assertThat(auditRows()).isZero();
        assertThat(recorder.eventCancelled).isEmpty();
    }

    @Test
    @DisplayName("신청 마감이 지났어도 종료 전이면 모집 마감할 수 있다 (S3)")
    void closeAfterDeadline() {
        long eventId = create();
        moveDeadline(eventId, now.minus(Duration.ofMinutes(1)));
        assertThat(detail(eventId)).containsEntry("canClose", true);

        ResponseEntity<Map> response = patch(statusPath(eventId), ADMIN_ID, status("CLOSED", 0));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody())
                .containsEntry("status", "CLOSED")
                .containsEntry("canReopen", false)
                .containsEntry("reopenBlockedReason", "DEADLINE_PASSED");
    }

    @Test
    @DisplayName("같은 상태 요청은 버전이 낡았어도 200 · 버전 그대로 · 감사 기록 없음 (S1)")
    void sameStatusIsNoOp() {
        long eventId = create();
        patch(statusPath(eventId), ADMIN_ID, status("CLOSED", 0));

        ResponseEntity<Map> again = patch(statusPath(eventId), OTHER_ADMIN_ID, status("CLOSED", 0));
        ResponseEntity<Map> published =
                patch(statusPath(create()), ADMIN_ID, status("PUBLISHED", 99));

        assertThat(again.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(again.getBody()).containsEntry("status", "CLOSED").containsEntry("version", 1);
        assertThat(published.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(published.getBody()).containsEntry("version", 0);
        assertThat(versionOf(eventId)).isEqualTo(1L);
        assertThat(auditRows()).isZero();
    }

    @Test
    @DisplayName(
            "재모집 — 신청 마감 전이면 200, 마감 뒤면 409 EVENT_REOPEN_DEADLINE_PASSED, 시작 뒤면 409 EVENT_ALREADY_STARTED")
    void reopen() {
        long eventId = create();
        patch(statusPath(eventId), ADMIN_ID, status("CLOSED", 0));

        ResponseEntity<Map> reopened = patch(statusPath(eventId), ADMIN_ID, status("PUBLISHED", 1));
        assertThat(reopened.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(reopened.getBody())
                .containsEntry("status", "PUBLISHED")
                .containsEntry("displayStatus", "RECRUITING")
                .containsEntry("version", 2);

        patch(statusPath(eventId), ADMIN_ID, status("CLOSED", 2));
        moveDeadline(eventId, now.minus(Duration.ofMinutes(1)));
        assertError(
                patch(statusPath(eventId), ADMIN_ID, status("PUBLISHED", 3)),
                HttpStatus.CONFLICT,
                "EVENT_REOPEN_DEADLINE_PASSED");

        moveStart(eventId, now.minus(Duration.ofMinutes(1)));
        assertThat(detail(eventId)).containsEntry("reopenBlockedReason", "STARTED");
        assertError(
                patch(statusPath(eventId), ADMIN_ID, status("PUBLISHED", 3)),
                HttpStatus.CONFLICT,
                "EVENT_ALREADY_STARTED");
        assertThat(statusOf(eventId)).isEqualTo("CLOSED");
        assertThat(versionOf(eventId)).isEqualTo(3L);
    }

    // ── 행사 취소 ───────────────────────────────────────────────────────────

    @Test
    @DisplayName(
            "행사 취소 — 확인 대기 · 참가 확정만 EVENT_CANCELLED 로, 참가 불가 · 기존 취소는 그대로. 감사 기록 한 행 · 행사 취소 이벤트 한 개 · 메일 없음")
    void cancel() {
        long eventId = create();
        Long pending = register(eventId, CREW_A, ClubEventRegistrationStatus.PENDING, null);
        Long confirmed = register(eventId, CREW_B, ClubEventRegistrationStatus.CONFIRMED, null);
        Long declined = register(eventId, CREW_C, ClubEventRegistrationStatus.DECLINED, null);
        Long selfCancelled =
                register(eventId, CREW_D, ClubEventRegistrationStatus.CANCELLED, "SELF_CANCELLED");
        int notificationsBefore = notificationRows();
        assertThat(detail(eventId))
                .containsEntry("hasCancellationRecipients", true)
                .containsEntry("cancellationRecipientCount", 2);

        ResponseEntity<Map> response = patch(statusPath(eventId), ADMIN_ID, status("CANCELLED", 0));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody())
                .containsEntry("status", "CANCELLED")
                .containsEntry("displayStatus", "CANCELLED")
                .containsEntry("version", 1)
                .containsEntry("canEdit", false)
                .containsEntry("canClose", false)
                .containsEntry("canReopen", false)
                .containsEntry("reopenBlockedReason", null)
                .containsEntry("canCancel", false)
                .containsEntry("hasCancellationRecipients", true)
                .containsEntry("cancellationRecipientCount", 2);
        for (Long id : List.of(pending, confirmed)) {
            ClubEventRegistration registration = registrationRepository.findById(id).orElseThrow();
            assertThat(registration.getStatus()).isEqualTo(ClubEventRegistrationStatus.CANCELLED);
            assertThat(registration.getCancelReason().name()).isEqualTo("EVENT_CANCELLED");
            assertThat(registration.getStatusChangedBy()).isEqualTo(ADMIN_ID);
        }
        assertThat(registrationRepository.findById(declined).orElseThrow().getStatus())
                .isEqualTo(ClubEventRegistrationStatus.DECLINED);
        assertThat(
                        registrationRepository
                                .findById(selfCancelled)
                                .orElseThrow()
                                .getCancelReason()
                                .name())
                .isEqualTo("SELF_CANCELLED");

        Map<String, Object> audit =
                jdbcTemplate.queryForMap(
                        "SELECT * FROM ADMIN_AUDIT_LOG WHERE ACTION = 'EVENT_CANCEL'");
        assertThat(audit)
                .containsEntry("ACTOR_ACCOUNT_ID", ADMIN_ID)
                .containsEntry("TARGET_ACCOUNT_ID", null)
                .containsEntry("CLUB_EVENT_ID", eventId)
                .containsEntry("BEFORE_VALUE", "PUBLISHED")
                .containsEntry("AFTER_VALUE", "2")
                .containsEntry("RETENTION_POLICY", "AUDIT_EVENT_CANCEL_V1");
        assertThat(recorder.eventCancelled)
                .singleElement()
                .satisfies(
                        event -> {
                            assertThat(event.clubEventId()).isEqualTo(eventId);
                            assertThat(event.cancelledRegistrationIds())
                                    .containsExactly(pending, confirmed);
                            assertThat(event.meta().actorId()).isEqualTo(String.valueOf(ADMIN_ID));
                        });
        assertThat(recorder.registrationsCancelled).isEmpty();
        assertThat(notificationRows()).isEqualTo(notificationsBefore);
    }

    @Test
    @DisplayName("신청이 없어도 취소 감사 기록을 남기고 안내 대상은 0명이다. 모집 마감 상태에서 취소하면 BEFORE 는 CLOSED")
    void cancelWithoutRegistrations() {
        long eventId = create();
        patch(statusPath(eventId), ADMIN_ID, status("CLOSED", 0));

        ResponseEntity<Map> response = patch(statusPath(eventId), ADMIN_ID, status("CANCELLED", 1));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody())
                .containsEntry("hasCancellationRecipients", false)
                .containsEntry("cancellationRecipientCount", 0);
        assertThat(
                        jdbcTemplate.queryForMap(
                                "SELECT BEFORE_VALUE, AFTER_VALUE FROM ADMIN_AUDIT_LOG"
                                        + " WHERE ACTION = 'EVENT_CANCEL'"))
                .containsEntry("BEFORE_VALUE", "CLOSED")
                .containsEntry("AFTER_VALUE", "0");
        assertThat(recorder.eventCancelled)
                .singleElement()
                .satisfies(event -> assertThat(event.cancelledRegistrationIds()).isEmpty());
    }

    @Test
    @DisplayName("취소된 행사는 세 전환 모두 409 EVENT_CANCELLED (같은 취소 재시도 포함). 감사 기록은 한 행 그대로")
    void cancelledIsFinal() {
        long eventId = create();
        patch(statusPath(eventId), ADMIN_ID, status("CANCELLED", 0));

        for (String target : List.of("CLOSED", "PUBLISHED", "CANCELLED")) {
            ResponseEntity<Map> response = patch(statusPath(eventId), ADMIN_ID, status(target, 1));
            assertError(response, HttpStatus.CONFLICT, "EVENT_CANCELLED");
            assertThat(message(response)).isEqualTo("취소된 행사는 모집 상태를 변경할 수 없습니다.");
        }
        assertThat(auditRows()).isEqualTo(1);
        assertThat(recorder.eventCancelled).hasSize(1);
    }

    @Test
    @DisplayName("종료된 행사는 세 전환 모두 409 EVENT_ENDED")
    void endedIsFinal() {
        long eventId = create();
        jdbcTemplate.update(
                "UPDATE CLUB_EVENT SET DEADLINE_AT = ?, STARTS_AT = ?, ENDS_AT = ? WHERE ID = ?",
                Timestamp.from(now.minus(Duration.ofHours(4))),
                Timestamp.from(now.minus(Duration.ofHours(3))),
                Timestamp.from(now.minus(Duration.ofMinutes(1))),
                eventId);

        for (String target : List.of("CLOSED", "PUBLISHED", "CANCELLED")) {
            assertError(
                    patch(statusPath(eventId), ADMIN_ID, status(target, 0)),
                    HttpStatus.CONFLICT,
                    "EVENT_ENDED");
        }
        assertThat(statusOf(eventId)).isEqualTo("PUBLISHED");
    }

    @Test
    @DisplayName("다른 캡틴이 행사를 수정해 버전이 올랐으면 실제 상태 변경은 409 EVENT_VERSION_CONFLICT")
    void versionConflict() {
        long eventId = create();
        register(eventId, CREW_A, ClubEventRegistrationStatus.PENDING, null);
        jdbcTemplate.update("UPDATE CLUB_EVENT SET VERSION = VERSION + 1 WHERE ID = ?", eventId);

        for (String target : List.of("CLOSED", "CANCELLED")) {
            assertError(
                    patch(statusPath(eventId), ADMIN_ID, status(target, 0)),
                    HttpStatus.CONFLICT,
                    "EVENT_VERSION_CONFLICT");
        }
        assertThat(statusOf(eventId)).isEqualTo("PUBLISHED");
        assertThat(registrationRepository.findAll())
                .extracting(ClubEventRegistration::getStatus)
                .containsExactly(ClubEventRegistrationStatus.PENDING);
        assertThat(auditRows()).isZero();
    }

    @Test
    @DisplayName("감사 기록 저장이 실패하면 500 이고 행사 · 신청 취소가 모두 롤백된다 (S4)")
    void auditFailureRollsBack() {
        long eventId = create();
        Long pending = register(eventId, CREW_A, ClubEventRegistrationStatus.PENDING, null);
        doThrow(new IllegalStateException("boom")).when(auditLogRepository).save(any());

        ResponseEntity<Map> response = patch(statusPath(eventId), ADMIN_ID, status("CANCELLED", 0));

        assertError(response, HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR");
        assertThat(statusOf(eventId)).isEqualTo("PUBLISHED");
        assertThat(versionOf(eventId)).isZero();
        ClubEventRegistration registration = registrationRepository.findById(pending).orElseThrow();
        assertThat(registration.getStatus()).isEqualTo(ClubEventRegistrationStatus.PENDING);
        assertThat(registration.getCancelReason()).isNull();
        assertThat(recorder.eventCancelled).isEmpty();
    }

    // ── 판정 필드 ───────────────────────────────────────────────────────────

    @Test
    @DisplayName("안내 대상 수는 계정이 남은 사람만 — 취소 전 · 직후 같고, 그 뒤 탈퇴하면 줄며 0명이면 false (S5)")
    void recipientsExcludeDeletedAccounts() {
        long eventId = create();
        register(eventId, CREW_A, ClubEventRegistrationStatus.PENDING, null);
        register(eventId, CREW_B, ClubEventRegistrationStatus.CONFIRMED, null);
        register(eventId, CREW_C, ClubEventRegistrationStatus.DECLINED, null);
        jdbcTemplate.update("DELETE FROM ACCOUNT WHERE ID = ?", CREW_C);
        assertThat(detail(eventId)).containsEntry("cancellationRecipientCount", 2);

        patch(statusPath(eventId), ADMIN_ID, status("CANCELLED", 0));
        assertThat(detail(eventId))
                .containsEntry("cancellationRecipientCount", 2)
                .containsEntry("hasCancellationRecipients", true);

        jdbcTemplate.update("DELETE FROM ACCOUNT WHERE ID = ?", CREW_A);
        assertThat(detail(eventId))
                .containsEntry("cancellationRecipientCount", 1)
                .containsEntry("hasCancellationRecipients", true);

        jdbcTemplate.update("DELETE FROM ACCOUNT WHERE ID = ?", CREW_B);
        assertThat(detail(eventId))
                .containsEntry("cancellationRecipientCount", 0)
                .containsEntry("hasCancellationRecipients", false);
    }

    @Test
    @DisplayName("등록 · 상세 · 수정 응답도 판정 필드 여섯 개를 싣는다 — 목록에는 없다")
    void judgmentFieldsOnEveryDetail() {
        ResponseEntity<Map> created = send(HttpMethod.POST, PATH, ADMIN_ID, body(), newKey());
        Map<String, Object> detail = created.getBody();
        long eventId = ((Number) detail.get("eventId")).longValue();
        Map<String, Object> edit = new LinkedHashMap<>(body());
        edit.put("version", 0);
        edit.put("questions", List.of());

        ResponseEntity<Map> updated =
                send(HttpMethod.PUT, PATH + "/" + eventId, ADMIN_ID, edit, null);

        for (Map<String, Object> response : List.of(detail, detail(eventId), updated.getBody())) {
            assertThat(response)
                    .containsKeys(JUDGMENT_FIELDS.toArray(String[]::new))
                    .containsEntry("canClose", true)
                    .containsEntry("canReopen", false)
                    .containsEntry("reopenBlockedReason", null)
                    .containsEntry("canCancel", true)
                    .containsEntry("hasCancellationRecipients", false)
                    .containsEntry("cancellationRecipientCount", 0);
        }
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> items =
                (List<Map<String, Object>>)
                        send(HttpMethod.GET, PATH, ADMIN_ID, null, null).getBody().get("items");
        assertThat(items.get(0)).doesNotContainKeys(JUDGMENT_FIELDS.toArray(String[]::new));
    }

    // ── 도우미 ─────────────────────────────────────────────────────────────

    private long create() {
        ResponseEntity<Map> response = send(HttpMethod.POST, PATH, ADMIN_ID, body(), newKey());
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        return ((Number) response.getBody().get("eventId")).longValue();
    }

    private Map<String, Object> body() {
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
        return body;
    }

    private static Map<String, Object> status(String status, long version) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("status", status);
        body.put("version", version);
        return body;
    }

    private Long register(
            long eventId, long accountId, ClubEventRegistrationStatus status, String cancelReason) {
        Long id =
                registrationRepository
                        .save(
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
        if (status != ClubEventRegistrationStatus.PENDING) {
            jdbcTemplate.update(
                    "UPDATE CLUB_EVENT_REGISTRATION SET STATUS = ?, CANCEL_REASON = ? WHERE ID = ?",
                    status.name(),
                    cancelReason,
                    id);
        }
        return id;
    }

    private void moveDeadline(long eventId, Instant deadlineAt) {
        jdbcTemplate.update(
                "UPDATE CLUB_EVENT SET DEADLINE_AT = ? WHERE ID = ?",
                Timestamp.from(deadlineAt),
                eventId);
    }

    private void moveStart(long eventId, Instant startsAt) {
        jdbcTemplate.update(
                "UPDATE CLUB_EVENT SET STARTS_AT = ? WHERE ID = ?",
                Timestamp.from(startsAt),
                eventId);
    }

    private static String statusPath(long eventId) {
        return PATH + "/" + eventId + "/status";
    }

    private Map<String, Object> detail(long eventId) {
        ResponseEntity<Map> response =
                send(HttpMethod.GET, PATH + "/" + eventId, ADMIN_ID, null, null);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        return response.getBody();
    }

    @SuppressWarnings("rawtypes")
    private ResponseEntity<Map> patch(String url, long accountId, Map<String, Object> body) {
        return send(HttpMethod.PATCH, url, accountId, body, null);
    }

    @SuppressWarnings({"rawtypes", "unchecked"})
    private ResponseEntity<Map> send(
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
    private ResponseEntity<Map> anonymous(String url, Map<String, Object> body) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        return rest.exchange(
                URI.create(url), HttpMethod.PATCH, new HttpEntity<>(body, headers), Map.class);
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
        assertThat(message(response)).startsWith(field + ":");
    }

    @SuppressWarnings("rawtypes")
    private static String message(ResponseEntity<Map> response) {
        return String.valueOf(response.getBody().get("errorMessage"));
    }

    private static String newKey() {
        return UUID.randomUUID().toString();
    }

    private String statusOf(long eventId) {
        return jdbcTemplate.queryForObject(
                "SELECT STATUS FROM CLUB_EVENT WHERE ID = ?", String.class, eventId);
    }

    private long versionOf(long eventId) {
        return jdbcTemplate.queryForObject(
                "SELECT VERSION FROM CLUB_EVENT WHERE ID = ?", Long.class, eventId);
    }

    private int auditRows() {
        return jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM ADMIN_AUDIT_LOG WHERE ACTION = 'EVENT_CANCEL'",
                Integer.class);
    }

    private int notificationRows() {
        return jdbcTemplate.queryForObject("SELECT COUNT(*) FROM NOTIFICATION", Integer.class);
    }

    private void insertAccount(long id, SystemRole role) {
        Timestamp at = Timestamp.from(Instant.now());
        jdbcTemplate.update(
                "INSERT INTO ACCOUNT (ID, EMAIL, NICKNAME, SYSTEM_ROLE, TIME_ZONE,"
                        + " ONBOARDING_COMPLETED_AT, CREATED_AT, UPDATED_AT)"
                        + " VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                id,
                "event-status-" + id + "@example.com",
                "evstatus_" + id,
                role.name(),
                "Asia/Seoul",
                at,
                at,
                at);
    }
}
