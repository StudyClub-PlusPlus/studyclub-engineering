package com.studyclub.api.event;

import static org.assertj.core.api.Assertions.assertThat;

import com.studyclub.api.auth.JwtService;
import com.studyclub.domain.account.AccountActivatedEvent;
import com.studyclub.domain.account.ActivationAction;
import com.studyclub.domain.account.SystemRole;
import com.studyclub.domain.event.ClubEventRegistrationSubmittedEvent;
import com.studyclub.domain.event.ClubEventRegistrationsCancelledEvent;
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

/**
 * 사이트 행사 — 목록 · 상세 · 신청 · 내 신청서 · 본인 취소 · 내 행사 (specs/event-registration/spec.md). 행사는 백오피스 API 로
 * 만들고, 지난 시각 · 상태 · 정원만 JDBC 로 옮긴다.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class ClubEventSiteIntegrationTest {

    private static final long ADMIN = 8501L;
    private static final long CREW = 8502L;
    private static final long OTHER_CREW = 8503L;
    private static final long NOT_ONBOARDED = 8504L;
    private static final long WITHDRAWN = 8599L;
    private static final List<Long> ACCOUNTS = List.of(ADMIN, CREW, OTHER_CREW, NOT_ONBOARDED);

    @Autowired TestRestTemplate rest;
    @Autowired JwtService jwtService;
    @Autowired JdbcTemplate jdbcTemplate;
    @Autowired Recorder recorder;

    private Instant now;

    /** 신청 · 취소 · 활성화 이벤트를 받아 둔다 — 메일 구독자가 아직 없어 테스트가 직접 듣는다. */
    @TestConfiguration
    static class RecorderConfig {
        @Bean
        Recorder siteEventRecorder() {
            return new Recorder();
        }
    }

    static class Recorder {
        final List<Object> events = new CopyOnWriteArrayList<>();

        @EventListener
        void on(AccountActivatedEvent event) {
            events.add(event);
        }

        @EventListener
        void on(ClubEventRegistrationSubmittedEvent event) {
            events.add(event);
        }

        @EventListener
        void on(ClubEventRegistrationsCancelledEvent event) {
            events.add(event);
        }

        <T> List<T> of(Class<T> type) {
            return events.stream().filter(type::isInstance).map(type::cast).toList();
        }
    }

    @BeforeEach
    void setUp() {
        rest.getRestTemplate().setRequestFactory(new JdkClientHttpRequestFactory());
        cleanUp();
        now = Instant.now().truncatedTo(ChronoUnit.MINUTES);
        insertAccount(ADMIN, SystemRole.ADMIN, true);
        insertAccount(CREW, SystemRole.MEMBER, true);
        insertAccount(OTHER_CREW, SystemRole.MEMBER, true);
        insertAccount(NOT_ONBOARDED, SystemRole.MEMBER, false);
        recorder.events.clear();
    }

    @AfterEach
    void cleanUp() {
        jdbcTemplate.update("DELETE FROM CLUB_EVENT_REGISTRATION");
        jdbcTemplate.update("DELETE FROM CLUB_EVENT_QUESTION");
        jdbcTemplate.update("DELETE FROM CLUB_EVENT_CHANNEL");
        jdbcTemplate.update("DELETE FROM CLUB_EVENT");
        for (Long id : ACCOUNTS) {
            jdbcTemplate.update("DELETE FROM ACCOUNT WHERE ID = ?", id);
        }
    }

    // ── 목록 · 상세 ────────────────────────────────────────────────────────

    @Test
    @DisplayName("목록 — 비로그인도 읽는다. 예정된 행사는 시작이 가까운 순, 그다음 지난 행사(종료 · 취소)는 최근 순")
    void listOrdersUpcomingThenPast() {
        long later = create(now.plus(Duration.ofDays(5)), "REVIEW");
        long sooner = create(now.plus(Duration.ofDays(2)), "REVIEW");
        long ended = create(now.plus(Duration.ofDays(3)), "REVIEW");
        moveTimes(ended, now.minus(Duration.ofDays(3)));
        long cancelled = create(now.plus(Duration.ofDays(10)), "REVIEW");
        jdbcTemplate.update("UPDATE CLUB_EVENT SET STATUS = 'CANCELLED' WHERE ID = ?", cancelled);

        List<Map<String, Object>> list = list(get("/api/events", null));

        assertThat(list)
                .extracting(e -> longOf(e, "eventId"))
                .containsExactly(sooner, later, cancelled, ended);
        assertThat(list)
                .extracting(e -> e.get("listGroup"))
                .containsExactly("UPCOMING", "UPCOMING", "PAST", "PAST");
        assertThat(list)
                .extracting(e -> e.get("displayStatus"))
                .containsExactly("RECRUITING", "RECRUITING", "CANCELLED", "ENDED");
        assertThat(list.get(0))
                .containsEntry("format", "HYBRID")
                .containsEntry("myRegistration", null);
    }

    @Test
    @DisplayName("상세 — 비로그인은 LOGIN_REQUIRED. 온라인은 빈 객체로만 알리고 링크는 어디에도 없다. 잔여석은 ONLINE · OFFLINE 순")
    void anonymousDetailHidesLink() {
        long eventId = create(now.plus(Duration.ofDays(5)), "REVIEW");

        ResponseEntity<Map> response = get("/api/events/" + eventId, null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        Map<String, Object> detail = response.getBody();
        assertThat(detail)
                .containsEntry("canApply", false)
                .containsEntry("applyBlockedReason", "LOGIN_REQUIRED")
                .containsEntry("myRegistration", null)
                .containsEntry("online", Map.of())
                .containsEntry("confirmation", "REVIEW");
        assertThat(detail.get("offline")).isEqualTo(Map.of("location", "서울 강남구 ○○빌딩 5층"));
        assertThat(seats(detail))
                .containsExactly(
                        Map.of("channel", "ONLINE", "capacity", 100, "remaining", 100),
                        Map.of("channel", "OFFLINE", "capacity", 40, "remaining", 40));
        assertThat((String) detail.get("questionVersion")).matches("[0-9a-f]{64}");
        assertThat(String.valueOf(detail)).doesNotContain("meet.example.com");
        assertError(get("/api/events/987654321", null), HttpStatus.NOT_FOUND, "NOT_FOUND");
    }

    @Test
    @DisplayName(
            "상세 — 토큰만 믿지 않는다: 온보딩 전 계정은 ONBOARDING_REQUIRED, 계정 행이 없는(탈퇴) 토큰 · 깨진 토큰은 비로그인과 같다")
    void detailChecksAccountRow() {
        long eventId = create(now.plus(Duration.ofDays(5)), "REVIEW");
        String path = "/api/events/" + eventId;

        assertThat(get(path, NOT_ONBOARDED).getBody())
                .containsEntry("applyBlockedReason", "ONBOARDING_REQUIRED");
        assertThat(get(path, WITHDRAWN).getBody())
                .containsEntry("applyBlockedReason", "LOGIN_REQUIRED");
        HttpHeaders broken = new HttpHeaders();
        broken.setBearerAuth("not-a-jwt");
        assertThat(
                        rest.exchange(
                                        URI.create(path),
                                        HttpMethod.GET,
                                        new HttpEntity<>(broken),
                                        Map.class)
                                .getBody())
                .containsEntry("applyBlockedReason", "LOGIN_REQUIRED");
        assertThat(get(path, CREW).getBody())
                .containsEntry("canApply", true)
                .containsEntry("applyBlockedReason", null);
    }

    // ── 신청 ───────────────────────────────────────────────────────────────

    @Test
    @DisplayName(
            "신청 — 자동 확정 행사는 CONFIRMED 로 201 + Location. 온라인 확정자는 상세에서 참여 링크를 본다. 첫 신청이 활성화를 기록한다")
    void autoConfirmSubmit() {
        long eventId = create(now.plus(Duration.ofDays(5)), "AUTO");
        Map<String, Object> detail = get("/api/events/" + eventId, CREW).getBody();

        ResponseEntity<Map> response =
                submit(eventId, CREW, newKey(), "ONLINE", detail, answersFor(detail));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getHeaders().getLocation())
                .hasToString("/api/events/" + eventId + "/registrations/me");
        Map<String, Object> form = response.getBody();
        assertThat(form)
                .containsEntry("status", "CONFIRMED")
                .containsEntry("channel", "ONLINE")
                .containsEntry("canCancel", true);
        assertThat(questions(form).get(0)).containsEntry("answer", List.of("한 해 회고를 나누고 싶어요"));
        assertThat(questions(form).get(1)).containsEntry("answer", List.of("AI", "커리어"));

        Map<String, Object> after = get("/api/events/" + eventId, CREW).getBody();
        assertThat(after).containsEntry("applyBlockedReason", "ALREADY_REGISTERED");
        assertThat(myRegistration(after))
                .containsEntry("onlineLinkVisible", true)
                .containsEntry("onlineUrl", "https://meet.example.com/abc")
                .containsEntry("canCancel", true);
        assertThat(seats(after).get(0)).containsEntry("remaining", 99);
        // 같은 행사를 다른 사람이 볼 때는 링크가 없다
        assertThat(String.valueOf(get("/api/events/" + eventId, OTHER_CREW).getBody()))
                .doesNotContain("meet.example.com");

        assertThat(recorder.of(ClubEventRegistrationSubmittedEvent.class))
                .singleElement()
                .satisfies(e -> assertThat(e.status().name()).isEqualTo("CONFIRMED"));
        assertThat(recorder.of(AccountActivatedEvent.class))
                .singleElement()
                .satisfies(
                        e -> {
                            assertThat(e.action()).isEqualTo(ActivationAction.EVENT_APPLIED);
                            assertThat(e.clubEventId()).isEqualTo(eventId);
                        });
        assertThat(activationActionOf(CREW)).isEqualTo("EVENT_APPLIED");

        // 두 번째 행사 신청은 활성화를 다시 만들지 않는다
        long second = create(now.plus(Duration.ofDays(6)), "REVIEW");
        Map<String, Object> secondDetail = get("/api/events/" + second, CREW).getBody();
        assertThat(
                        submit(
                                        second,
                                        CREW,
                                        newKey(),
                                        "OFFLINE",
                                        secondDetail,
                                        answersFor(secondDetail))
                                .getBody())
                .containsEntry("status", "PENDING");
        assertThat(recorder.of(AccountActivatedEvent.class)).hasSize(1);
    }

    @Test
    @DisplayName("신청 — 이미 스터디로 활성화된 계정은 행사 신청으로 다시 활성화되지 않는다")
    void alreadyActivatedAccount() {
        jdbcTemplate.update(
                "UPDATE ACCOUNT SET ACTIVATED_AT = ?, ACTIVATION_ACTION = 'STUDY_APPLIED' WHERE ID = ?",
                Timestamp.from(now.minus(Duration.ofDays(30))),
                CREW);
        long eventId = create(now.plus(Duration.ofDays(5)), "REVIEW");
        Map<String, Object> detail = get("/api/events/" + eventId, CREW).getBody();

        assertThat(
                        submit(eventId, CREW, newKey(), "OFFLINE", detail, answersFor(detail))
                                .getStatusCode())
                .isEqualTo(HttpStatus.CREATED);

        assertThat(recorder.of(AccountActivatedEvent.class)).isEmpty();
        assertThat(activationActionOf(CREW)).isEqualTo("STUDY_APPLIED");
    }

    @Test
    @DisplayName("신청 재시도 — 같은 키는 새 신청 없이 처음 신청을 201 로, 다른 행사에 같은 키는 400, 키가 없으면 400")
    void idempotencyKey() {
        long eventId = create(now.plus(Duration.ofDays(5)), "REVIEW");
        long other = create(now.plus(Duration.ofDays(6)), "REVIEW");
        Map<String, Object> detail = get("/api/events/" + eventId, CREW).getBody();
        String key = newKey();

        ResponseEntity<Map> first =
                submit(eventId, CREW, key, "OFFLINE", detail, answersFor(detail));
        ResponseEntity<Map> retry =
                submit(eventId, CREW, key, "OFFLINE", detail, answersFor(detail));

        assertThat(retry.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(longOf(retry.getBody(), "registrationId"))
                .isEqualTo(longOf(first.getBody(), "registrationId"));
        assertThat(registrationCount(eventId)).isEqualTo(1);
        assertThat(recorder.of(ClubEventRegistrationSubmittedEvent.class)).hasSize(1);

        Map<String, Object> otherDetail = get("/api/events/" + other, CREW).getBody();
        ResponseEntity<Map> wrongEvent =
                submit(other, CREW, key, "OFFLINE", otherDetail, answersFor(otherDetail));
        assertError(wrongEvent, HttpStatus.BAD_REQUEST, "INVALID_INPUT");
        assertThat(message(wrongEvent)).startsWith("Idempotency-Key");
        assertError(
                submit(other, CREW, null, "OFFLINE", otherDetail, answersFor(otherDetail)),
                HttpStatus.BAD_REQUEST,
                "INVALID_INPUT");
    }

    @Test
    @DisplayName("신청 거절 — 인가, 질문 변경 409, 답 검증 400, 없는 방식 400, 고른 방식 정원 409, 중복 409, 모집 마감 409")
    void submitRejections() {
        long eventId = create(now.plus(Duration.ofDays(5)), "REVIEW");
        Map<String, Object> detail = get("/api/events/" + eventId, CREW).getBody();
        String path = "/api/events/" + eventId + "/registrations";
        List<Map<String, Object>> questions = questions(detail);
        String motive = (String) questions.get(0).get("questionId");
        String topics = (String) questions.get(1).get("questionId");

        assertError(anonymousPost(path), HttpStatus.UNAUTHORIZED, "UNAUTHORIZED");
        assertError(
                submit(eventId, NOT_ONBOARDED, newKey(), "OFFLINE", detail, answersFor(detail)),
                HttpStatus.FORBIDDEN,
                "ONBOARDING_REQUIRED");

        Map<String, Object> stale = new LinkedHashMap<>(detail);
        stale.put("questionVersion", "0".repeat(64));
        assertError(
                submit(eventId, CREW, newKey(), "OFFLINE", stale, answersFor(detail)),
                HttpStatus.CONFLICT,
                "EVENT_QUESTIONS_CHANGED");

        expectInvalid(eventId, detail, Map.of(motive, List.of("   ")), "answers." + motive);
        expectInvalid(
                eventId,
                detail,
                Map.of(motive, List.of("x"), topics, List.of("요리")),
                "answers." + topics);
        expectInvalid(
                eventId,
                detail,
                Map.of(motive, List.of("x"), topics, List.of("AI", "AI")),
                "answers." + topics);
        expectInvalid(
                eventId, detail, Map.of(motive, List.of("x".repeat(2001))), "answers." + motive);
        expectInvalid(
                eventId,
                detail,
                Map.of(motive, List.of("x"), "q-unknown", List.of("y")),
                "answers.q-unknown");
        ResponseEntity<Map> badChannel =
                submit(eventId, CREW, newKey(), "PHONE", detail, answersFor(detail));
        assertError(badChannel, HttpStatus.BAD_REQUEST, "INVALID_INPUT");
        assertThat(message(badChannel)).startsWith("channel");

        jdbcTemplate.update(
                "UPDATE CLUB_EVENT_CHANNEL SET CAPACITY = 1 WHERE CLUB_EVENT_ID = ? AND CHANNEL = 'OFFLINE'",
                eventId);
        assertThat(
                        submit(eventId, OTHER_CREW, newKey(), "OFFLINE", detail, answersFor(detail))
                                .getStatusCode())
                .isEqualTo(HttpStatus.CREATED);
        assertError(
                submit(eventId, CREW, newKey(), "OFFLINE", detail, answersFor(detail)),
                HttpStatus.CONFLICT,
                "EVENT_CHANNEL_FULL");
        assertThat(get("/api/events/" + eventId, CREW).getBody()).containsEntry("canApply", true);

        assertThat(
                        submit(eventId, CREW, newKey(), "ONLINE", detail, answersFor(detail))
                                .getStatusCode())
                .isEqualTo(HttpStatus.CREATED);
        assertError(
                submit(eventId, CREW, newKey(), "ONLINE", detail, answersFor(detail)),
                HttpStatus.CONFLICT,
                "EVENT_ALREADY_REGISTERED");

        long closed = create(now.plus(Duration.ofDays(7)), "REVIEW");
        jdbcTemplate.update("UPDATE CLUB_EVENT SET STATUS = 'CLOSED' WHERE ID = ?", closed);
        Map<String, Object> closedDetail = get("/api/events/" + closed, CREW).getBody();
        assertThat(closedDetail).containsEntry("applyBlockedReason", "RECRUITMENT_CLOSED");
        assertError(
                submit(closed, CREW, newKey(), "ONLINE", closedDetail, answersFor(closedDetail)),
                HttpStatus.CONFLICT,
                "EVENT_REGISTRATION_CLOSED");
    }

    @Test
    @DisplayName("참가 불가 이력 — 상세는 DECLINED_BEFORE, 다시 신청하면 409")
    void declinedCannotReapply() {
        long eventId = create(now.plus(Duration.ofDays(5)), "REVIEW");
        Map<String, Object> detail = get("/api/events/" + eventId, CREW).getBody();
        long registrationId =
                longOf(
                        submit(eventId, CREW, newKey(), "OFFLINE", detail, answersFor(detail))
                                .getBody(),
                        "registrationId");
        jdbcTemplate.update(
                "UPDATE CLUB_EVENT_REGISTRATION SET STATUS = 'DECLINED' WHERE ID = ?",
                registrationId);

        Map<String, Object> after = get("/api/events/" + eventId, CREW).getBody();
        assertThat(after).containsEntry("applyBlockedReason", "DECLINED_BEFORE");
        assertThat(myRegistration(after))
                .containsEntry("status", "DECLINED")
                .containsEntry("cancelBlockedReason", "NOT_ACTIVE");
        assertError(
                submit(eventId, CREW, newKey(), "OFFLINE", detail, answersFor(detail)),
                HttpStatus.CONFLICT,
                "EVENT_REGISTRATION_DECLINED");
    }

    // ── 본인 취소 · 내 신청서 ─────────────────────────────────────────────

    @Test
    @DisplayName("본인 취소 — 보던 신청만 CANCELLED 로 남기고, 다시 신청하면 새 행. 예전 번호로 또 취소하면 409, 남의 신청은 404")
    void selfCancelThenReapply() {
        long eventId = create(now.plus(Duration.ofDays(5)), "REVIEW");
        Map<String, Object> detail = get("/api/events/" + eventId, CREW).getBody();
        long first =
                longOf(
                        submit(eventId, CREW, newKey(), "OFFLINE", detail, answersFor(detail))
                                .getBody(),
                        "registrationId");

        assertError(cancel(eventId, OTHER_CREW, first), HttpStatus.NOT_FOUND, "NOT_FOUND");
        assertError(cancel(eventId, CREW, null), HttpStatus.BAD_REQUEST, "INVALID_INPUT");

        ResponseEntity<Map> cancelled = cancel(eventId, CREW, first);
        assertThat(cancelled.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(cancelled.getBody())
                .containsEntry("status", "CANCELLED")
                .containsEntry("canCancel", false)
                .containsEntry("cancelBlockedReason", "NOT_ACTIVE");
        assertThat(
                        jdbcTemplate.queryForObject(
                                "SELECT CANCEL_REASON FROM CLUB_EVENT_REGISTRATION WHERE ID = ?",
                                String.class,
                                first))
                .isEqualTo("SELF_CANCELLED");
        assertThat(recorder.of(ClubEventRegistrationsCancelledEvent.class))
                .singleElement()
                .satisfies(
                        e -> {
                            assertThat(e.cause())
                                    .isEqualTo(ClubEventRegistrationsCancelledEvent.Cause.SELF);
                            assertThat(e.registrationIds()).containsExactly(first);
                        });
        assertThat(get("/api/events/" + eventId, CREW).getBody()).containsEntry("canApply", true);

        long second =
                longOf(
                        submit(eventId, CREW, newKey(), "ONLINE", detail, answersFor(detail))
                                .getBody(),
                        "registrationId");
        assertThat(second).isNotEqualTo(first);
        assertError(
                cancel(eventId, CREW, first),
                HttpStatus.CONFLICT,
                "EVENT_REGISTRATION_STATUS_NOT_ALLOWED");
        assertThat(get("/api/events/" + eventId + "/registrations/me", CREW).getBody())
                .containsEntry("registrationId", (int) second)
                .containsEntry("status", "PENDING");
    }

    @Test
    @DisplayName("본인 취소 — 모집을 수동으로 닫아도 신청 마감 전이면 된다. 신청 마감이 지나면 409, 취소된 행사는 409")
    void selfCancelDeadline() {
        long eventId = create(now.plus(Duration.ofDays(5)), "REVIEW");
        Map<String, Object> detail = get("/api/events/" + eventId, CREW).getBody();
        long mine =
                longOf(
                        submit(eventId, CREW, newKey(), "OFFLINE", detail, answersFor(detail))
                                .getBody(),
                        "registrationId");
        long others =
                longOf(
                        submit(eventId, OTHER_CREW, newKey(), "OFFLINE", detail, answersFor(detail))
                                .getBody(),
                        "registrationId");

        jdbcTemplate.update(
                "UPDATE CLUB_EVENT SET DEADLINE_AT = ? WHERE ID = ?",
                Timestamp.from(now.minus(Duration.ofHours(1))),
                eventId);
        assertThat(myRegistration(get("/api/events/" + eventId, CREW).getBody()))
                .containsEntry("canCancel", false)
                .containsEntry("cancelBlockedReason", "DEADLINE_PASSED");
        assertError(cancel(eventId, CREW, mine), HttpStatus.CONFLICT, "EVENT_SELF_CANCEL_CLOSED");

        jdbcTemplate.update(
                "UPDATE CLUB_EVENT SET DEADLINE_AT = ?, STATUS = 'CLOSED' WHERE ID = ?",
                Timestamp.from(now.plus(Duration.ofDays(1))),
                eventId);
        assertThat(cancel(eventId, CREW, mine).getStatusCode()).isEqualTo(HttpStatus.OK);

        jdbcTemplate.update("UPDATE CLUB_EVENT SET STATUS = 'CANCELLED' WHERE ID = ?", eventId);
        assertError(cancel(eventId, OTHER_CREW, others), HttpStatus.CONFLICT, "EVENT_CANCELLED");
    }

    @Test
    @DisplayName("내 신청서 · 내 행사 — 신청이 없으면 404 · 빈 목록. 내 행사는 행사별 최신 신청 한 건, 최근 신청 순")
    void myFormAndMyEvents() {
        long a = create(now.plus(Duration.ofDays(5)), "REVIEW");
        long b = create(now.plus(Duration.ofDays(6)), "AUTO");
        assertError(
                get("/api/events/" + a + "/registrations/me", CREW),
                HttpStatus.NOT_FOUND,
                "NOT_FOUND");
        assertThat(list(get("/api/me/events", CREW))).isEmpty();
        assertError(get("/api/me/events", null), HttpStatus.UNAUTHORIZED, "UNAUTHORIZED");

        Map<String, Object> aDetail = get("/api/events/" + a, CREW).getBody();
        Map<String, Object> bDetail = get("/api/events/" + b, CREW).getBody();
        long aFirst =
                longOf(
                        submit(a, CREW, newKey(), "OFFLINE", aDetail, answersFor(aDetail))
                                .getBody(),
                        "registrationId");
        submit(b, CREW, newKey(), "ONLINE", bDetail, answersFor(bDetail));
        cancel(a, CREW, aFirst);
        long aSecond =
                longOf(
                        submit(a, CREW, newKey(), "ONLINE", aDetail, answersFor(aDetail)).getBody(),
                        "registrationId");

        List<Map<String, Object>> mine = list(get("/api/me/events", CREW));
        assertThat(mine).extracting(e -> longOf(e, "eventId")).containsExactly(a, b);
        assertThat(registration(mine.get(0)))
                .containsEntry("registrationId", (int) aSecond)
                .containsEntry("status", "PENDING");
        assertThat(registration(mine.get(1))).containsEntry("status", "CONFIRMED");

        List<Map<String, Object>> events = list(get("/api/events", CREW));
        assertThat(events.get(0).get("myRegistration"))
                .isEqualTo(Map.of("status", "PENDING", "channel", "ONLINE"));
    }

    // ── 도우미 ─────────────────────────────────────────────────────────────

    private long create(Instant startsAt, String confirmation) {
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
        body.put("confirmation", confirmation);
        Map<String, Object> motive = new LinkedHashMap<>();
        motive.put("questionId", null);
        motive.put("label", "참여 동기");
        motive.put("type", "TEXTAREA");
        motive.put("required", true);
        motive.put("options", List.of());
        Map<String, Object> topics = new LinkedHashMap<>();
        topics.put("questionId", null);
        topics.put("label", "관심 주제");
        topics.put("type", "CHECKBOX");
        topics.put("required", false);
        topics.put("options", List.of("AI", "커리어", "네트워킹"));
        body.put("questions", List.of(motive, topics));
        ResponseEntity<Map> response =
                exchange(HttpMethod.POST, "/api/admin/events", ADMIN, body, newKey());
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        return longOf(response.getBody(), "eventId");
    }

    /** 시작 · 종료 · 마감을 지난 시각으로 옮긴다 — 등록 API 는 지난 마감을 받지 않는다. */
    private void moveTimes(long eventId, Instant startsAt) {
        jdbcTemplate.update(
                "UPDATE CLUB_EVENT SET STARTS_AT = ?, ENDS_AT = ?, DEADLINE_AT = ? WHERE ID = ?",
                Timestamp.from(startsAt),
                Timestamp.from(startsAt.plus(Duration.ofHours(3))),
                Timestamp.from(startsAt.minus(Duration.ofDays(1))),
                eventId);
    }

    /** 상세의 질문에 맞는 답 — 필수 장문 한 줄 + 선택 체크박스 둘. */
    private static Map<String, Object> answersFor(Map<String, Object> detail) {
        List<Map<String, Object>> questions = questions(detail);
        Map<String, Object> answers = new LinkedHashMap<>();
        answers.put((String) questions.get(0).get("questionId"), List.of("  한 해 회고를 나누고 싶어요  "));
        answers.put((String) questions.get(1).get("questionId"), List.of("AI", "커리어"));
        return answers;
    }

    private void expectInvalid(
            long eventId, Map<String, Object> detail, Map<String, Object> answers, String field) {
        ResponseEntity<Map> response = submit(eventId, CREW, newKey(), "OFFLINE", detail, answers);
        assertError(response, HttpStatus.BAD_REQUEST, "INVALID_INPUT");
        assertThat(message(response)).startsWith(field);
    }

    private ResponseEntity<Map> submit(
            long eventId,
            long accountId,
            String key,
            String channel,
            Map<String, Object> detail,
            Map<String, Object> answers) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("channel", channel);
        body.put("questionVersion", detail.get("questionVersion"));
        body.put("answers", answers);
        return exchange(
                HttpMethod.POST, "/api/events/" + eventId + "/registrations", accountId, body, key);
    }

    private ResponseEntity<Map> cancel(long eventId, long accountId, Long registrationId) {
        String path = "/api/events/" + eventId + "/registrations/me";
        if (registrationId != null) {
            path += "?registrationId=" + registrationId;
        }
        return exchange(HttpMethod.DELETE, path, accountId, null, null);
    }

    private ResponseEntity<Map> get(String path, Long accountId) {
        return exchange(HttpMethod.GET, path, accountId, null, null);
    }

    @SuppressWarnings({"rawtypes", "unchecked"})
    private ResponseEntity<Map> exchange(
            HttpMethod method, String path, Long accountId, Map<String, Object> body, String key) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        if (accountId != null) {
            headers.setBearerAuth(
                    jwtService.issueAccess(
                            String.valueOf(accountId), "event-" + accountId + "@example.com"));
        }
        if (key != null) {
            headers.set("Idempotency-Key", key);
        }
        ResponseEntity<Object> response =
                rest.exchange(
                        URI.create(path), method, new HttpEntity<>(body, headers), Object.class);
        Object payload = response.getBody();
        Map<String, Object> map =
                payload instanceof List<?> items
                        ? Map.of("items", items)
                        : (Map<String, Object>) payload;
        return new ResponseEntity<>(map, response.getHeaders(), response.getStatusCode());
    }

    private ResponseEntity<Map> anonymousPost(String path) {
        return exchange(HttpMethod.POST, path, null, Map.of(), newKey());
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> list(ResponseEntity<Map> response) {
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        return (List<Map<String, Object>>) response.getBody().get("items");
    }

    private void insertAccount(long id, SystemRole role, boolean onboarded) {
        Timestamp at = Timestamp.from(Instant.now());
        jdbcTemplate.update(
                "INSERT INTO ACCOUNT (ID, EMAIL, NICKNAME, SYSTEM_ROLE, TIME_ZONE,"
                        + " ONBOARDING_COMPLETED_AT, CREATED_AT, UPDATED_AT)"
                        + " VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                id,
                "event-" + id + "@example.com",
                "site_" + id,
                role.name(),
                "Asia/Seoul",
                onboarded ? at : null,
                at,
                at);
    }

    private int registrationCount(long eventId) {
        return jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM CLUB_EVENT_REGISTRATION WHERE CLUB_EVENT_ID = ?",
                Integer.class,
                eventId);
    }

    private String activationActionOf(long accountId) {
        return jdbcTemplate.queryForObject(
                "SELECT ACTIVATION_ACTION FROM ACCOUNT WHERE ID = ?", String.class, accountId);
    }

    @SuppressWarnings("rawtypes")
    private static void assertError(ResponseEntity<Map> response, HttpStatus status, String code) {
        assertThat(response.getStatusCode()).isEqualTo(status);
        assertThat(response.getBody()).containsEntry("errorCode", code);
    }

    @SuppressWarnings("rawtypes")
    private static String message(ResponseEntity<Map> response) {
        return String.valueOf(response.getBody().get("errorMessage"));
    }

    private static String newKey() {
        return UUID.randomUUID().toString();
    }

    private static long longOf(Map<?, ?> map, String key) {
        return ((Number) map.get(key)).longValue();
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> seats(Map<String, Object> detail) {
        return (List<Map<String, Object>>) detail.get("seats");
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> questions(Map<String, Object> body) {
        return (List<Map<String, Object>>) body.get("questions");
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> myRegistration(Map<String, Object> detail) {
        return (Map<String, Object>) detail.get("myRegistration");
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> registration(Map<String, Object> item) {
        return (Map<String, Object>) item.get("registration");
    }
}
