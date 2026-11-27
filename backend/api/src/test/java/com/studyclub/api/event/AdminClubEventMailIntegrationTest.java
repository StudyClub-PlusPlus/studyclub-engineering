package com.studyclub.api.event;

import static org.assertj.core.api.Assertions.assertThat;

import com.studyclub.api.auth.JwtService;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.SystemRole;
import com.studyclub.domain.event.EventChannel;
import com.studyclub.domain.event.EventConfirmation;
import com.studyclub.domain.event.registration.ClubEventRegistration;
import com.studyclub.domain.event.registration.ClubEventRegistrationRepository;
import com.studyclub.notification.NotificationChannel;
import com.studyclub.notification.NotificationEventType;
import com.studyclub.notification.NotificationTemplate;
import com.studyclub.notification.NotificationTemplateRepository;
import java.net.URI;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.TestRestTemplate;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureTestRestTemplate;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * 백오피스 행사 메일 (specs/event-mail/spec.md). 테스트 DB 는 Flyway 를 끄므로 행사 템플릿을 저장소로 넣는다. 행사는 API 로 만들고, 신청
 * · 상태 · 시각은 저장소 · JDBC 로 옮긴다.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class AdminClubEventMailIntegrationTest {

    private static final String PATH = "/api/admin/events";
    private static final long ADMIN_ID = 7401L;
    private static final long MEMBER_ID = 7402L;
    private static final long CREW_ONLINE = 7411L;
    private static final long CREW_OFFLINE = 7412L;
    private static final long CREW_PENDING = 7413L;
    private static final long WITHDRAWN = 7499L;
    private static final List<Long> ACCOUNTS =
            List.of(ADMIN_ID, MEMBER_ID, CREW_ONLINE, CREW_OFFLINE, CREW_PENDING);
    private static final long MISSING_ID = 987_654_321L;
    private static final String ANNOUNCEMENT_BODY =
            "<p>{{nickname}}님, {{eventTitle}} ({{channel}})</p><p>{{eventSchedule}}</p>"
                    + "<p>{{participation}}</p><p>{{notice}}</p>";
    private static final String CANCELLATION_BODY =
            "<p>{{nickname}}님, {{eventTitle}} 행사가 취소되었습니다.</p><p>{{notice}}</p>";

    @Autowired TestRestTemplate rest;
    @Autowired JwtService jwtService;
    @Autowired AccountRepository accountRepository;
    @Autowired ClubEventRegistrationRepository registrationRepository;
    @Autowired NotificationTemplateRepository templateRepository;
    @Autowired JdbcTemplate jdbcTemplate;

    private Instant now;

    @BeforeEach
    void setUp() {
        rest.getRestTemplate().setRequestFactory(new JdkClientHttpRequestFactory());
        cleanUp();
        insertAccount(ADMIN_ID, SystemRole.ADMIN, "Asia/Seoul");
        insertAccount(MEMBER_ID, SystemRole.MEMBER, "Asia/Seoul");
        insertAccount(CREW_ONLINE, SystemRole.MEMBER, "America/Toronto");
        insertAccount(CREW_OFFLINE, SystemRole.MEMBER, "Asia/Seoul");
        insertAccount(CREW_PENDING, SystemRole.MEMBER, "Asia/Seoul");
        now = Instant.now().truncatedTo(ChronoUnit.MINUTES);
    }

    @AfterEach
    void cleanUp() {
        jdbcTemplate.update("DELETE FROM NOTIFICATION WHERE EVENT_TYPE LIKE 'EVENT_%'");
        jdbcTemplate.update("DELETE FROM NOTIFICATION_TEMPLATE WHERE EVENT_TYPE LIKE 'EVENT_%'");
        jdbcTemplate.update("DELETE FROM EVENT_MAIL_RECIPIENT");
        jdbcTemplate.update("DELETE FROM EVENT_MAIL");
        jdbcTemplate.update("DELETE FROM CLUB_EVENT_REGISTRATION");
        jdbcTemplate.update("DELETE FROM CLUB_EVENT_QUESTION");
        jdbcTemplate.update("DELETE FROM CLUB_EVENT_CHANNEL");
        jdbcTemplate.update("DELETE FROM CLUB_EVENT");
        for (long id : ACCOUNTS) {
            jdbcTemplate.update("DELETE FROM ACCOUNT WHERE ID = ?", id);
        }
    }

    // ── 인가 · 400 ─────────────────────────────────────────────────────────

    @Test
    @DisplayName("인가 — 네 경로 모두 토큰 없음 401, 크루 403(없는 ID 라도), 캡틴이면 없는 행사 404")
    void authorization() {
        String mails = PATH + "/" + MISSING_ID + "/mails";
        Map<String, Object> body = announcement("ALL", "안내");
        for (Object[] call :
                new Object[][] {
                    {HttpMethod.POST, mails + "/preview"},
                    {HttpMethod.POST, mails},
                    {HttpMethod.GET, mails},
                    {HttpMethod.GET, mails + "/" + MISSING_ID}
                }) {
            HttpMethod method = (HttpMethod) call[0];
            String url = (String) call[1];
            assertError(anonymous(method, url, body), HttpStatus.UNAUTHORIZED, "UNAUTHORIZED");
            assertError(
                    send(method, url, MEMBER_ID, body, key()), HttpStatus.FORBIDDEN, "FORBIDDEN");
            assertError(
                    send(method, url, ADMIN_ID, body, key()), HttpStatus.NOT_FOUND, "NOT_FOUND");
        }
    }

    @Test
    @DisplayName(
            "400 — Idempotency-Key 누락 · 형식, type · audience 누락 · 조합, 없는 방식, notice 공백 · 5,001자, 시간대. 아무것도 저장하지 않는다")
    void invalidInput() {
        long eventId = createEvent("ONLINE");
        givenTemplates();
        String mails = mailsPath(eventId);

        assertInvalid(
                send(HttpMethod.POST, mails, ADMIN_ID, announcement("ALL", "안내"), null),
                "Idempotency-Key");
        assertInvalid(
                send(HttpMethod.POST, mails, ADMIN_ID, announcement("ALL", "안내"), "abc"),
                "Idempotency-Key");
        Map<String, Object> noType = announcement("ALL", "안내");
        noType.remove("type");
        assertInvalid(post(mails, noType), "type");
        assertInvalid(post(mails, announcement("CANCELLED_ACTIVE", "안내")), "audience");
        Map<String, Object> cancellationAll = announcement("ALL", "안내");
        cancellationAll.put("type", "CANCELLATION");
        assertInvalid(post(mails, cancellationAll), "audience");
        assertInvalid(post(mails, announcement("OFFLINE", "안내")), "audience");
        assertInvalid(post(mails + "/preview", announcement("OFFLINE", "")), "audience");
        assertInvalid(post(mails, announcement("ALL", "  \n ")), "notice");
        assertInvalid(post(mails, announcement("ALL", "가".repeat(5_001))), "notice");
        Map<String, Object> badZone = announcement("ALL", "안내");
        badZone.put("displayTimeZone", "Europe/London");
        assertInvalid(post(mails, badZone), "displayTimeZone");
        assertInvalid(post(mails + "/preview", badZone), "displayTimeZone");

        assertThat(count("EVENT_MAIL")).isZero();
    }

    // ── 미리보기 ───────────────────────────────────────────────────────────

    @Nested
    @DisplayName("미리보기")
    class Preview {

        @Test
        @DisplayName(
                "ALL + 혼합 행사 — 닉네임만 원문, 참여 안내 온라인 먼저 두 줄(<br>), 받는 사람은 계정이 남은 참가 확정자, 안내 내용이 비면 NOTICE_REQUIRED")
        void hybridAll() {
            long eventId = createEvent("HYBRID");
            Long templateId = givenTemplates();
            givenRecipients(eventId);

            Map<String, Object> body =
                    ok(post(mailsPath(eventId) + "/preview", announcement("ALL", "")));

            assertThat(body)
                    .containsEntry("type", "ANNOUNCEMENT")
                    .containsEntry("audience", "ALL")
                    .containsEntry("templateId", templateId.intValue())
                    .containsEntry("templateExists", true)
                    .containsEntry("subject", "[StudyClub] 연말 네트워킹 밋업 안내")
                    .containsEntry("format", "HTML")
                    .containsEntry("displayTimeZone", "Asia/Seoul")
                    .containsEntry("recipientCount", 2)
                    .containsEntry("canSend", false)
                    .containsEntry("blockedReason", "NOTICE_REQUIRED");
            assertThat((String) body.get("body"))
                    .contains("{{nickname}}님, 연말 네트워킹 밋업 (온라인·오프라인)")
                    .contains("온라인: https://meet.example.com/abc<br>오프라인: 서울 강남구 ○○빌딩 5층")
                    .contains(" KST</p>");

            Map<String, Object> ready =
                    ok(
                            post(
                                    mailsPath(eventId) + "/preview",
                                    announcement("OFFLINE", "계단을 이용해\n주세요")));
            assertThat(ready).containsEntry("recipientCount", 1).containsEntry("canSend", true);
            assertThat((String) ready.get("body"))
                    .contains("(오프라인)")
                    .contains("<p>서울 강남구 ○○빌딩 5층</p>")
                    .contains("계단을 이용해<br>주세요")
                    .doesNotContain("meet.example.com");
        }

        @Test
        @DisplayName("템플릿 없음 TEMPLATE_MISSING(제목 · 본문 null), 받는 사람 0 NO_RECIPIENTS — 그래도 200")
        void blocked() {
            long eventId = createEvent("HYBRID");

            assertThat(ok(post(mailsPath(eventId) + "/preview", announcement("ALL", "안내"))))
                    .containsEntry("templateExists", false)
                    .containsEntry("templateId", null)
                    .containsEntry("subject", null)
                    .containsEntry("body", null)
                    .containsEntry("blockedReason", "TEMPLATE_MISSING");

            givenTemplates();
            assertThat(ok(post(mailsPath(eventId) + "/preview", announcement("ALL", "안내"))))
                    .containsEntry("recipientCount", 0)
                    .containsEntry("blockedReason", "NO_RECIPIENTS")
                    .containsEntry("canSend", false);
        }

        @Test
        @DisplayName("종료된 행사도 막지 않는다 (M4) · 취소 안내 미리보기에는 일정 · 장소 · 링크가 없다")
        void endedAndCancellation() {
            long ended = createEvent("HYBRID");
            givenTemplates();
            givenRecipients(ended);
            endEvent(ended);
            assertThat(ok(post(mailsPath(ended) + "/preview", announcement("ALL", "후기 부탁해요"))))
                    .containsEntry("canSend", true)
                    .containsEntry("blockedReason", null);

            long cancelled = createEvent("HYBRID");
            long registration = register(cancelled, CREW_ONLINE, EventChannel.ONLINE);
            setStatus(registration, "CANCELLED", "EVENT_CANCELLED");
            cancelEvent(cancelled);
            Map<String, Object> body =
                    ok(post(mailsPath(cancelled) + "/preview", cancellation("취소되었습니다")));
            assertThat(body)
                    .containsEntry("recipientCount", 1)
                    .containsEntry("canSend", true)
                    .containsEntry("subject", "[StudyClub] 연말 네트워킹 밋업 행사 취소 안내");
            assertThat((String) body.get("body"))
                    .doesNotContain("meet.example.com")
                    .doesNotContain("○○빌딩")
                    .contains("취소되었습니다");
        }
    }

    // ── 보내기 ─────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("보내기")
    class Send {

        @Test
        @DisplayName(
                "201 · EVENT_MAIL 1행 · 받는 사람 스냅샷 · 받는 사람마다 NOTIFICATION 1행(템플릿 둘이어도) · 그 사람 방식 · 시간대, 탈퇴 계정 제외")
        void sends() {
            long eventId = createEvent("HYBRID");
            Long templateId = givenTemplates();
            saveTemplate(
                    NotificationEventType.EVENT_ANNOUNCEMENT,
                    "[StudyClub] 두 번째",
                    ANNOUNCEMENT_BODY);
            givenRecipients(eventId);
            Map<String, Object> request = announcement("ALL", "계단을 이용해 주세요");
            request.put("templateId", templateId);

            ResponseEntity<Map> response =
                    send(HttpMethod.POST, mailsPath(eventId), ADMIN_ID, request, key());

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
            long mailId = ((Number) response.getBody().get("mailId")).longValue();
            assertThat(response.getHeaders().getLocation())
                    .hasToString(mailsPath(eventId) + "/" + mailId);
            assertThat(response.getBody())
                    .containsEntry("type", "ANNOUNCEMENT")
                    .containsEntry("audience", "ALL")
                    .containsEntry("recipientCount", 2)
                    .containsEntry("format", "HTML")
                    .containsEntry(
                            "maskedRecipients", List.of("m***@example.com", "m***@example.com"));
            assertThat((String) response.getBody().get("body")).contains("{{nickname}}님");
            assertThat(count("EVENT_MAIL")).isEqualTo(1);
            assertThat(
                            jdbcTemplate.queryForList(
                                    "SELECT ACCOUNT_ID FROM EVENT_MAIL_RECIPIENT ORDER BY ACCOUNT_ID",
                                    Long.class))
                    .containsExactly(CREW_ONLINE, CREW_OFFLINE);

            List<Map<String, Object>> rows = notificationRows("EVENT_ANNOUNCEMENT");
            assertThat(rows).hasSize(2);
            assertThat(rows)
                    .allSatisfy(
                            row ->
                                    assertThat(row)
                                            .containsEntry("TEMPLATE_ID", templateId)
                                            .containsEntry("REFERENCE_ID", mailId)
                                            .containsEntry("SENDER_ACCOUNT_ID", ADMIN_ID)
                                            .containsEntry("BODY_TEMPLATE", ANNOUNCEMENT_BODY)
                                            .containsEntry("STATUS", "PENDING"));
            String online = String.valueOf(rows.get(0).get("PAYLOAD"));
            assertThat(online)
                    .contains("mailtest_" + CREW_ONLINE)
                    .contains("https://meet.example.com/abc")
                    .doesNotContain("○○빌딩")
                    .contains(" EST");
            String offline = String.valueOf(rows.get(1).get("PAYLOAD"));
            assertThat(offline)
                    .contains("○○빌딩")
                    .doesNotContain("meet.example.com")
                    .contains(" KST");
        }

        @Test
        @DisplayName("같은 키 재시도는 같은 201 응답 · 행이 늘지 않는다. 그 사이 행사가 취소돼도 첫 결과를 준다")
        void idempotent() {
            long eventId = createEvent("HYBRID");
            givenTemplates();
            givenRecipients(eventId);
            String key = key();

            ResponseEntity<Map> first =
                    send(
                            HttpMethod.POST,
                            mailsPath(eventId),
                            ADMIN_ID,
                            announcement("ALL", "안내"),
                            key);
            cancelEvent(eventId);
            ResponseEntity<Map> retry =
                    send(
                            HttpMethod.POST,
                            mailsPath(eventId),
                            ADMIN_ID,
                            announcement("ALL", "안내"),
                            key.toUpperCase());

            assertThat(retry.getStatusCode()).isEqualTo(HttpStatus.CREATED);
            assertThat(retry.getBody()).isEqualTo(first.getBody());
            assertThat(count("EVENT_MAIL")).isEqualTo(1);
            assertThat(notificationRows("EVENT_ANNOUNCEMENT")).hasSize(2);
        }

        @Test
        @DisplayName(
                "409 — EVENT_CANCELLED · EVENT_NOT_CANCELLED · TEMPLATE_MISSING · TEMPLATE_CHANGED · NO_RECIPIENTS, 아무것도 저장하지 않는다")
        void conflicts() {
            long eventId = createEvent("HYBRID");
            String mails = mailsPath(eventId);

            assertError(
                    post(mails, announcement("ALL", "안내")),
                    HttpStatus.CONFLICT,
                    "EVENT_MAIL_TEMPLATE_MISSING");
            Long templateId = givenTemplates();
            assertError(
                    post(mails, announcement("ALL", "안내")),
                    HttpStatus.CONFLICT,
                    "EVENT_MAIL_NO_RECIPIENTS");
            givenRecipients(eventId);
            Map<String, Object> stale = announcement("ALL", "안내");
            stale.put("templateId", templateId + 100);
            assertError(post(mails, stale), HttpStatus.CONFLICT, "EVENT_MAIL_TEMPLATE_CHANGED");
            assertError(
                    post(mails, cancellation("취소")), HttpStatus.CONFLICT, "EVENT_NOT_CANCELLED");
            cancelEvent(eventId);
            assertError(
                    post(mails, announcement("ALL", "안내")), HttpStatus.CONFLICT, "EVENT_CANCELLED");

            assertThat(count("EVENT_MAIL")).isZero();
            assertThat(notificationRows("EVENT_ANNOUNCEMENT")).isEmpty();
        }

        @Test
        @DisplayName("보낸 뒤 템플릿을 고치거나 지워도 이력 · 예약한 메일 행의 원문은 그대로")
        void snapshotSurvivesTemplateChange() {
            long eventId = createEvent("HYBRID");
            Long templateId = givenTemplates();
            givenRecipients(eventId);
            long mailId =
                    ((Number)
                                    ok201(post(mailsPath(eventId), announcement("ALL", "안내")))
                                            .get("mailId"))
                            .longValue();

            NotificationTemplate template = templateRepository.findById(templateId).orElseThrow();
            template.edit(
                    NotificationEventType.EVENT_ANNOUNCEMENT,
                    "바뀐 제목 {{notice}}",
                    "<p>{{notice}}</p>",
                    ADMIN_ID);
            templateRepository.saveAndFlush(template);
            templateRepository.deleteById(templateId);

            Map<String, Object> detail =
                    ok(
                            send(
                                    HttpMethod.GET,
                                    mailsPath(eventId) + "/" + mailId,
                                    ADMIN_ID,
                                    null,
                                    null));
            assertThat(detail).containsEntry("subject", "[StudyClub] 연말 네트워킹 밋업 안내");
            assertThat(notificationRows("EVENT_ANNOUNCEMENT"))
                    .allSatisfy(
                            row ->
                                    assertThat(row)
                                            .containsEntry(
                                                    "SUBJECT_TEMPLATE",
                                                    "[StudyClub] {{eventTitle}} 안내")
                                            .containsEntry("BODY_TEMPLATE", ANNOUNCEMENT_BODY));
        }

        @Test
        @DisplayName("취소 안내 — 행사 취소로 취소된 신청만(본인 취소 제외), PAYLOAD 는 행사명 · 안내 · 닉네임뿐")
        void cancellationMail() {
            long eventId = createEvent("HYBRID");
            givenTemplates();
            long byEvent = register(eventId, CREW_ONLINE, EventChannel.ONLINE);
            setStatus(byEvent, "CANCELLED", "EVENT_CANCELLED");
            long bySelf = register(eventId, CREW_OFFLINE, EventChannel.OFFLINE);
            setStatus(bySelf, "CANCELLED", "SELF_CANCELLED");
            cancelEvent(eventId);

            Map<String, Object> body = ok201(post(mailsPath(eventId), cancellation("취소되었습니다")));

            assertThat(body)
                    .containsEntry("type", "CANCELLATION")
                    .containsEntry("audience", "CANCELLED_ACTIVE")
                    .containsEntry("recipientCount", 1);
            List<Map<String, Object>> rows = notificationRows("EVENT_CANCELLATION");
            assertThat(rows)
                    .singleElement()
                    .satisfies(
                            row -> {
                                String payload = String.valueOf(row.get("PAYLOAD"));
                                assertThat(payload)
                                        .contains("취소되었습니다")
                                        .doesNotContain("meet.example.com")
                                        .doesNotContain("eventSchedule");
                            });
        }
    }

    // ── 이력 ───────────────────────────────────────────────────────────────

    @Test
    @DisplayName("이력 — 운영자 발송만 최신순 · 페이지 · 400, 상세는 가린 주소, 다른 행사의 mailId 는 404")
    void history() {
        long eventId = createEvent("HYBRID");
        long otherEventId = createEvent("HYBRID");
        givenTemplates();
        givenRecipients(eventId);
        long first =
                ((Number)
                                ok201(post(mailsPath(eventId), announcement("ALL", "첫 안내")))
                                        .get("mailId"))
                        .longValue();
        long second =
                ((Number)
                                ok201(post(mailsPath(eventId), announcement("OFFLINE", "둘째 안내")))
                                        .get("mailId"))
                        .longValue();

        Map<String, Object> page =
                ok(send(HttpMethod.GET, mailsPath(eventId), ADMIN_ID, null, null));
        assertThat(page).containsEntry("total", 2).containsEntry("limit", 20);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> items = (List<Map<String, Object>>) page.get("items");
        assertThat(items)
                .extracting(i -> ((Number) i.get("mailId")).longValue())
                .containsExactly(second, first);
        assertThat(items.get(0))
                .containsEntry("audience", "OFFLINE")
                .containsEntry("recipientCount", 1)
                .containsKeys("subject", "createdAt");
        assertInvalid(
                send(HttpMethod.GET, mailsPath(eventId) + "?limit=51", ADMIN_ID, null, null),
                "limit");
        assertInvalid(
                send(HttpMethod.GET, mailsPath(eventId) + "?offset=-1", ADMIN_ID, null, null),
                "offset");

        Map<String, Object> detail =
                ok(send(HttpMethod.GET, mailsPath(eventId) + "/" + second, ADMIN_ID, null, null));
        assertThat(detail).containsEntry("maskedRecipients", List.of("m***@example.com"));
        assertThat(String.valueOf(detail)).doesNotContain("mailtest-");
        assertError(
                send(HttpMethod.GET, mailsPath(otherEventId) + "/" + second, ADMIN_ID, null, null),
                HttpStatus.NOT_FOUND,
                "NOT_FOUND");
        assertThat(ok(send(HttpMethod.GET, mailsPath(otherEventId), ADMIN_ID, null, null)))
                .containsEntry("total", 0);
    }

    // ── 도우미 ─────────────────────────────────────────────────────────────

    private Long givenTemplates() {
        Long id =
                saveTemplate(
                        NotificationEventType.EVENT_ANNOUNCEMENT,
                        "[StudyClub] {{eventTitle}} 안내",
                        ANNOUNCEMENT_BODY);
        saveTemplate(
                NotificationEventType.EVENT_CANCELLATION,
                "[StudyClub] {{eventTitle}} 행사 취소 안내",
                CANCELLATION_BODY);
        return id;
    }

    private Long saveTemplate(NotificationEventType type, String subject, String body) {
        return templateRepository
                .saveAndFlush(
                        new NotificationTemplate(type, NotificationChannel.EMAIL, subject, body))
                .getId();
    }

    /** 온라인 확정 · 오프라인 확정 · 확인 대기 · 탈퇴 계정의 확정. 안내 ALL 의 받는 사람은 앞의 둘. */
    private void givenRecipients(long eventId) {
        setStatus(register(eventId, CREW_ONLINE, EventChannel.ONLINE), "CONFIRMED", null);
        setStatus(register(eventId, CREW_OFFLINE, EventChannel.OFFLINE), "CONFIRMED", null);
        register(eventId, CREW_PENDING, EventChannel.ONLINE);
        setStatus(register(eventId, WITHDRAWN, EventChannel.ONLINE), "CONFIRMED", null);
    }

    private long createEvent(String format) {
        Instant startsAt = now.plus(Duration.ofDays(5));
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("title", "연말 네트워킹 밋업");
        body.put("summary", "한 해를 마무리하며 크루끼리 만나요");
        body.put("description", "행사 소개");
        body.put("timeZone", "Asia/Seoul");
        body.put("startsAt", startsAt.toString());
        body.put("endsAt", startsAt.plus(Duration.ofHours(3)).toString());
        body.put("deadlineAt", startsAt.minus(Duration.ofDays(1)).toString());
        body.put("format", format);
        if (!format.equals("ONLINE")) {
            body.put("offline", Map.of("capacity", 40, "location", "서울 강남구 ○○빌딩 5층"));
        }
        if (!format.equals("OFFLINE")) {
            body.put("online", Map.of("capacity", 100, "url", "https://meet.example.com/abc"));
        }
        body.put("confirmation", "REVIEW");
        ResponseEntity<Map> response = send(HttpMethod.POST, PATH, ADMIN_ID, body, key());
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        return ((Number) response.getBody().get("eventId")).longValue();
    }

    private long register(long eventId, long accountId, EventChannel channel) {
        return registrationRepository
                .saveAndFlush(
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

    private static Map<String, Object> announcement(String audience, String notice) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("type", "ANNOUNCEMENT");
        body.put("audience", audience);
        body.put("notice", notice);
        return body;
    }

    private static Map<String, Object> cancellation(String notice) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("type", "CANCELLATION");
        body.put("audience", "CANCELLED_ACTIVE");
        body.put("notice", notice);
        return body;
    }

    private static String mailsPath(long eventId) {
        return PATH + "/" + eventId + "/mails";
    }

    private static String key() {
        return UUID.randomUUID().toString();
    }

    @SuppressWarnings("rawtypes")
    private ResponseEntity<Map> post(String url, Map<String, Object> body) {
        return send(HttpMethod.POST, url, ADMIN_ID, body, key());
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
    private ResponseEntity<Map> anonymous(HttpMethod method, String url, Map<String, Object> body) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        return rest.exchange(
                URI.create(url),
                method,
                new HttpEntity<>(method == HttpMethod.GET ? null : body, headers),
                Map.class);
    }

    @SuppressWarnings({"rawtypes", "unchecked"})
    private static Map<String, Object> ok(ResponseEntity<Map> response) {
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        return response.getBody();
    }

    @SuppressWarnings({"rawtypes", "unchecked"})
    private static Map<String, Object> ok201(ResponseEntity<Map> response) {
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        return response.getBody();
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

    private int count(String table) {
        return jdbcTemplate.queryForObject("SELECT COUNT(*) FROM " + table, Integer.class);
    }

    private List<Map<String, Object>> notificationRows(String eventType) {
        List<Map<String, Object>> rows =
                jdbcTemplate.queryForList(
                        "SELECT * FROM NOTIFICATION WHERE EVENT_TYPE = ? ORDER BY RECIPIENT_USER_ID",
                        eventType);
        for (Map<String, Object> row : rows) {
            if (row.get("PAYLOAD") instanceof byte[] json) {
                row.put("PAYLOAD", new String(json, java.nio.charset.StandardCharsets.UTF_8));
            }
        }
        return rows;
    }

    private void insertAccount(long id, SystemRole role, String timeZone) {
        Timestamp at = Timestamp.from(Instant.now());
        jdbcTemplate.update(
                "INSERT INTO ACCOUNT (ID, EMAIL, NICKNAME, SYSTEM_ROLE, TIME_ZONE,"
                        + " ONBOARDING_COMPLETED_AT, CREATED_AT, UPDATED_AT)"
                        + " VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                id,
                "mailtest-" + id + "@example.com",
                "mailtest_" + id,
                role.name(),
                timeZone,
                at,
                at,
                at);
    }
}
