package com.studyclub.api.event;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.studyclub.api.auth.JwtService;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.SystemRole;
import com.studyclub.domain.event.ClubEventRegistrationPort;
import com.studyclub.domain.event.ClubEventRegistrationsConfirmedEvent;
import com.studyclub.domain.event.ClubEventRepository;
import com.studyclub.domain.event.EventSeatCounts;
import java.net.URI;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.function.Consumer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;
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
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

/**
 * 백오피스 행사 — 목록 · 등록 · 상세 · 수정 (specs/event/spec.md). 신청 수는 이 테스트의 관심이 아니라 {@link
 * ClubEventRegistrationPort} 를 목으로 바꿔 끼우고 방식·상태별 수를 정해 준다. 행사는 API 로 만들고, 시작·종료·취소 같은 지난 상태는 JDBC 로
 * 시각·상태만 옮긴다.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class AdminClubEventIntegrationTest {

    private static final String PATH = "/api/admin/events";
    private static final long ADMIN_ID = 5901L;
    private static final long OTHER_ADMIN_ID = 5902L;
    private static final long MEMBER_ID = 5903L;
    private static final long MISSING_EVENT_ID = 987_654_321L;

    @Autowired TestRestTemplate rest;
    @Autowired JwtService jwtService;
    @Autowired AccountRepository accountRepository;
    @Autowired JdbcTemplate jdbcTemplate;
    @Autowired ConfirmedEventRecorder recorder;

    @MockitoBean ClubEventRegistrationPort registrationPort;
    @MockitoSpyBean ClubEventRepository clubEventRepository;

    private Instant now;

    /** 일괄 확정 이벤트를 받아 둔다 — 구독자가 아직 없어 테스트가 직접 듣는다. */
    @TestConfiguration
    static class RecorderConfig {
        @Bean
        ConfirmedEventRecorder confirmedEventRecorder() {
            return new ConfirmedEventRecorder();
        }
    }

    static class ConfirmedEventRecorder {
        final List<ClubEventRegistrationsConfirmedEvent> events = new CopyOnWriteArrayList<>();

        @EventListener
        void on(ClubEventRegistrationsConfirmedEvent event) {
            events.add(event);
        }
    }

    @BeforeEach
    void setUp() {
        rest.getRestTemplate().setRequestFactory(new JdkClientHttpRequestFactory());
        cleanUp();
        insertAccount(ADMIN_ID, SystemRole.ADMIN);
        insertAccount(OTHER_ADMIN_ID, SystemRole.ADMIN);
        insertAccount(MEMBER_ID, SystemRole.MEMBER);
        recorder.events.clear();
        now = Instant.now().truncatedTo(ChronoUnit.MINUTES);
        given(registrationPort.countActiveSeats(anyLong())).willReturn(EventSeatCounts.none());
        given(registrationPort.countActiveSeatsByEventIds(any())).willReturn(Map.of());
        given(registrationPort.confirmPendingRegistrations(anyLong(), anyLong()))
                .willReturn(List.of());
    }

    @AfterEach
    void cleanUp() {
        jdbcTemplate.update("DELETE FROM CLUB_EVENT_QUESTION");
        jdbcTemplate.update("DELETE FROM CLUB_EVENT_CHANNEL");
        jdbcTemplate.update("DELETE FROM CLUB_EVENT");
        jdbcTemplate.update(
                "DELETE FROM ACCOUNT WHERE ID IN (?, ?, ?)", ADMIN_ID, OTHER_ADMIN_ID, MEMBER_ID);
    }

    // ── 인가 ─────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("인가 — 토큰 없음 401, 크루 403. 없는 행사 ID 라도 403 이 먼저다 (인가가 존재 여부보다 먼저)")
    void authorization() {
        for (HttpMethod method : List.of(HttpMethod.GET, HttpMethod.POST)) {
            assertError(anonymous(method, PATH, body()), HttpStatus.UNAUTHORIZED, "UNAUTHORIZED");
            assertError(
                    send(method, PATH, MEMBER_ID, body(), newKey()),
                    HttpStatus.FORBIDDEN,
                    "FORBIDDEN");
        }
        String missing = PATH + "/" + MISSING_EVENT_ID;
        for (HttpMethod method : List.of(HttpMethod.GET, HttpMethod.PUT)) {
            assertError(
                    anonymous(method, missing, body()), HttpStatus.UNAUTHORIZED, "UNAUTHORIZED");
            assertError(
                    send(method, missing, MEMBER_ID, body(), null),
                    HttpStatus.FORBIDDEN,
                    "FORBIDDEN");
        }
        // 크루의 POST 는 키도 본문도 보지 않고 막힌다 — 아무것도 만들어지지 않는다
        assertThat(eventCount()).isZero();
    }

    // ── 등록 ─────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("등록 — 201 + Location + 상세 본문. 바로 공개 · 버전 0 · 질문 키 발급 · 공백 정리")
    void create() {
        Map<String, Object> body = body();
        body.put("title", "  연말 네트워킹 밋업  ");

        ResponseEntity<Map> response = send(HttpMethod.POST, PATH, ADMIN_ID, body, newKey());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        Map<String, Object> detail = response.getBody();
        long eventId = longOf(detail, "eventId");
        assertThat(response.getHeaders().getLocation()).hasToString(PATH + "/" + eventId);
        assertThat(detail)
                .containsEntry("version", 0)
                .containsEntry("title", "연말 네트워킹 밋업")
                .containsEntry("status", "PUBLISHED")
                .containsEntry("displayStatus", "RECRUITING")
                .containsEntry("format", "HYBRID")
                .containsEntry("confirmation", "REVIEW")
                .containsEntry("canEdit", true)
                .containsEntry("canChangeConfirmation", true)
                .containsEntry("canSetFutureStart", true)
                .containsEntry("removableChannels", List.of("ONLINE", "OFFLINE"))
                .containsEntry("startsAt", body.get("startsAt"))
                .containsEntry("effectiveEndsAt", body.get("endsAt"))
                .containsKeys("publishedAt", "createdAt", "updatedAt")
                .doesNotContainKey("success");
        assertThat(detail.get("offline"))
                .isEqualTo(Map.of("capacity", 40, "location", "서울 강남구 ○○빌딩 5층"));
        assertThat(detail.get("online"))
                .isEqualTo(Map.of("capacity", 100, "url", "https://meet.example.com/abc"));
        assertThat(seats(detail))
                .containsExactly(
                        Map.of(
                                "channel",
                                "ONLINE",
                                "capacity",
                                100,
                                "pending",
                                0,
                                "confirmed",
                                0,
                                "remaining",
                                100),
                        Map.of(
                                "channel",
                                "OFFLINE",
                                "capacity",
                                40,
                                "pending",
                                0,
                                "confirmed",
                                0,
                                "remaining",
                                40));
        List<Map<String, Object>> questions = questions(detail);
        assertThat(questions).extracting(q -> q.get("label")).containsExactly("참여 동기", "관심 주제");
        assertThat(questions).allSatisfy(q -> assertThat((String) q.get("questionId")).hasSize(36));
        assertThat(questions.get(1).get("options")).isEqualTo(List.of("AI", "커리어", "네트워킹"));
    }

    @Test
    @DisplayName("등록 — confirmation 생략은 AUTO, questions 생략은 빈 배열, 종료 생략은 시작일 다음 날 00:00 이 종료 판정 시각")
    void createDefaults() {
        Map<String, Object> body = body();
        body.remove("confirmation");
        body.remove("questions");
        body.put("endsAt", null);
        body.put("startsAt", "2099-11-28T01:00:00Z");
        body.put("deadlineAt", "2099-11-27T01:00:00Z");

        Map<String, Object> detail =
                send(HttpMethod.POST, PATH, ADMIN_ID, body, newKey()).getBody();

        assertThat(detail)
                .containsEntry("confirmation", "AUTO")
                .containsEntry("questions", List.of())
                .containsEntry("endsAt", null)
                .containsEntry("effectiveEndsAt", "2099-11-28T15:00:00Z");
    }

    @Test
    @DisplayName("등록 — Idempotency-Key 누락·형식 오류는 400, 키를 남기지 않아 같은 키로 고쳐 보내면 새로 만든다")
    void idempotencyKeyValidation() {
        for (String bad :
                new String[] {
                    null,
                    "",
                    "not-a-uuid",
                    "a5e3c2a0-1d2b-11ee-be56-0242ac120002", // v1
                    UUID.randomUUID() + "x"
                }) {
            ResponseEntity<Map> response = send(HttpMethod.POST, PATH, ADMIN_ID, body(), bad);
            assertError(response, HttpStatus.BAD_REQUEST, "INVALID_INPUT");
            assertThat(message(response)).startsWith("Idempotency-Key:");
        }
        assertThat(eventCount()).isZero();

        String key = newKey();
        Map<String, Object> invalid = body();
        invalid.put("title", "");
        assertError(
                send(HttpMethod.POST, PATH, ADMIN_ID, invalid, key),
                HttpStatus.BAD_REQUEST,
                "INVALID_INPUT");
        assertThat(eventCount()).isZero();

        assertThat(send(HttpMethod.POST, PATH, ADMIN_ID, body(), key).getStatusCode())
                .isEqualTo(HttpStatus.CREATED);
        assertThat(eventCount()).isEqualTo(1);
    }

    @Test
    @DisplayName("등록 — 같은 계정 · 같은 키 재시도는 처음 만든 행사를 201 로 다시 준다(대소문자 무시). 다른 계정의 같은 키는 별개 행사")
    void idempotentRetry() {
        String key = newKey();
        ResponseEntity<Map> first = send(HttpMethod.POST, PATH, ADMIN_ID, body(), key);
        ResponseEntity<Map> retry =
                send(HttpMethod.POST, PATH, ADMIN_ID, body(), key.toUpperCase());

        assertThat(retry.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(retry.getHeaders().getLocation()).isEqualTo(first.getHeaders().getLocation());
        assertThat(longOf(retry.getBody(), "eventId"))
                .isEqualTo(longOf(first.getBody(), "eventId"));
        assertThat(questions(retry.getBody())).isEqualTo(questions(first.getBody()));
        assertThat(eventCount()).isEqualTo(1);

        ResponseEntity<Map> other = send(HttpMethod.POST, PATH, OTHER_ADMIN_ID, body(), key);
        assertThat(other.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(longOf(other.getBody(), "eventId"))
                .isNotEqualTo(longOf(first.getBody(), "eventId"));
        assertThat(eventCount()).isEqualTo(2);
    }

    @Test
    @DisplayName("등록 — 같은 키 요청이 동시에 와도 행사는 하나, 모두 201 + 같은 Location (유일성 위반은 이긴 쪽을 다시 읽어 준다)")
    void concurrentSameKey() throws Exception {
        String key = newKey();
        int threads = 6;
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        CountDownLatch start = new CountDownLatch(1);
        List<Future<ResponseEntity<Map>>> futures = new ArrayList<>();
        try {
            for (int i = 0; i < threads; i++) {
                Callable<ResponseEntity<Map>> call =
                        () -> {
                            start.await();
                            return send(HttpMethod.POST, PATH, ADMIN_ID, body(), key);
                        };
                futures.add(pool.submit(call));
            }
            start.countDown();
            Set<URI> locations = new HashSet<>();
            for (Future<ResponseEntity<Map>> future : futures) {
                ResponseEntity<Map> response = future.get();
                assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
                locations.add(response.getHeaders().getLocation());
            }
            assertThat(locations).hasSize(1);
            assertThat(eventCount()).isEqualTo(1);
        } finally {
            pool.shutdownNow();
        }
    }

    @Test
    @DisplayName("등록 — 필드 검증 400 은 실패한 필드 이름을 errorMessage 앞에 담고 아무것도 만들지 않는다")
    void createValidation() {
        Map<String, Consumer<Map<String, Object>>> cases = new LinkedHashMap<>();
        cases.put("title", b -> b.put("title", "가".repeat(61)));
        cases.put("summary", b -> b.put("summary", "   "));
        cases.put("description", b -> b.put("description", "가".repeat(5_001)));
        cases.put("timeZone", b -> b.put("timeZone", "America/Vancouver"));
        cases.put("startsAt", b -> b.put("startsAt", "2026-12-05 10:00"));
        cases.put("endsAt", b -> b.put("endsAt", b.get("startsAt")));
        cases.put("deadlineAt", b -> b.put("deadlineAt", iso(now.minus(Duration.ofMinutes(1)))));
        cases.put("deadlineAt ", b -> b.put("deadlineAt", iso(now.plus(Duration.ofDays(11)))));
        cases.put("format", b -> b.put("format", "BOTH"));
        cases.put("offline", b -> b.put("format", "ONLINE"));
        cases.put("online", b -> b.remove("online"));
        cases.put(
                "online.url",
                b -> b.put("online", Map.of("capacity", 10, "url", "ftp://meet.example.com")));
        cases.put("online.capacity", b -> b.put("online", Map.of("capacity", 0)));
        cases.put(
                "offline.capacity",
                b -> b.put("offline", Map.of("capacity", 10_001, "location", "강남")));
        cases.put(
                "offline.location", b -> b.put("offline", Map.of("capacity", 10, "location", " ")));
        cases.put("confirmation", b -> b.put("confirmation", "MANUAL"));
        // MySQL DATETIME(6) 범위 밖 — 저장 때 500 이 아니라 입력에서 400
        cases.put("startsAt ", b -> b.put("startsAt", "+10000-01-01T00:00:00Z"));
        cases.put("deadlineAt  ", b -> b.put("deadlineAt", "0999-12-31T23:59:59Z"));
        cases.put("endsAt ", b -> b.put("endsAt", "9999-12-31T23:59:59.500Z"));
        // 소수 정원은 정수로 잘려 통과하지 않는다 — 40.0 도 소수다
        cases.put(
                "offline.capacity ",
                b -> b.put("offline", Map.of("capacity", 10_000.9, "location", "강남")));
        cases.put("online.capacity ", b -> b.put("online", Map.of("capacity", 40.0)));
        cases.put("online.capacity  ", b -> b.put("online", Map.of("capacity", 10_000_000_000L)));
        cases.put("questions", b -> b.put("questions", repeat(question("TEXT"), 21)));
        cases.put(
                "questions[0].type",
                b -> b.put("questions", List.of(question("SELECT", "A", "B"))));
        cases.put(
                "questions[0].options",
                b -> b.put("questions", List.of(question("RADIO", "A", " A "))));
        cases.put(
                "questions[0].options ",
                b -> b.put("questions", List.of(question("CHECKBOX", "A"))));
        cases.put(
                "questions[1].options",
                b -> b.put("questions", List.of(question("TEXT"), question("TEXT", "A"))));
        cases.put(
                "questions[0].label", b -> b.put("questions", List.of(labelled("가".repeat(201)))));
        cases.put(
                "questions[0].questionId",
                b -> {
                    Map<String, Object> q = question("TEXT");
                    q.put("questionId", "q_1");
                    b.put("questions", List.of(q));
                });

        cases.forEach(
                (field, mutate) -> {
                    Map<String, Object> body = body();
                    mutate.accept(body);
                    ResponseEntity<Map> response =
                            send(HttpMethod.POST, PATH, ADMIN_ID, body, newKey());
                    assertThat(response.getStatusCode())
                            .as(field)
                            .isEqualTo(HttpStatus.BAD_REQUEST);
                    assertThat(response.getBody())
                            .as(field)
                            .containsEntry("errorCode", "INVALID_INPUT");
                    assertThat(message(response)).as(field).startsWith(field.strip() + ":");
                });
        assertThat(eventCount()).isZero();
    }

    @Test
    @DisplayName("등록 — DATETIME(6) 범위의 끝 시각은 받는다 (9999-12-31T23:59:59Z 까지)")
    void acceptsLastStorableInstant() {
        Map<String, Object> body = body();
        body.put("startsAt", "9999-12-31T00:00:00Z");
        body.put("endsAt", "9999-12-31T23:59:59Z");
        body.put("deadlineAt", "9999-12-30T00:00:00Z");

        ResponseEntity<Map> response = send(HttpMethod.POST, PATH, ADMIN_ID, body, newKey());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        // 분 단위로 맞춰 저장한다
        assertThat(response.getBody()).containsEntry("endsAt", "9999-12-31T23:59:00Z");
    }

    @Test
    @DisplayName("등록 — 참여 링크는 오류 메시지에 담지 않는다 (확정자만 보는 값)")
    void urlNotEchoed() {
        Map<String, Object> body = body();
        body.put("online", Map.of("capacity", 10, "url", "javascript:secret-token"));

        ResponseEntity<Map> response = send(HttpMethod.POST, PATH, ADMIN_ID, body, newKey());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(message(response)).doesNotContain("secret-token");
    }

    // ── 목록 ─────────────────────────────────────────────────────────────────

    @Test
    @DisplayName(
            "목록 — STARTS_AT DESC, ID DESC 정렬 · offset·limit 페이지 · offset ≥ total 은 빈 items · 표시 상태는 포트의 수로")
    void list() {
        Instant later = now.plus(Duration.ofDays(20));
        long early = create(now.plus(Duration.ofDays(5)));
        long sameA = create(later);
        long sameB = create(later);
        given(registrationPort.countActiveSeatsByEventIds(any()))
                .willReturn(Map.of(early, new EventSeatCounts(100, 0, 0, 40)));

        Map<String, Object> page = send(HttpMethod.GET, PATH, ADMIN_ID, null, null).getBody();

        assertThat(page)
                .containsEntry("total", 3)
                .containsEntry("offset", 0)
                .containsEntry("limit", 20);
        List<Map<String, Object>> items = items(page);
        assertThat(items)
                .extracting(i -> longOf(i, "eventId"))
                .containsExactly(sameB, sameA, early);
        assertThat(items.get(2))
                .containsEntry("displayStatus", "FULL")
                .containsEntry("status", "PUBLISHED")
                .containsEntry("timeZone", "Asia/Seoul")
                .containsKeys("title", "startsAt", "endsAt", "effectiveEndsAt")
                .doesNotContainKeys("seats", "format", "confirmation");
        assertThat(items.get(0)).containsEntry("displayStatus", "RECRUITING");

        Map<String, Object> second =
                send(HttpMethod.GET, PATH + "?offset=1&limit=1", ADMIN_ID, null, null).getBody();
        assertThat(items(second)).extracting(i -> longOf(i, "eventId")).containsExactly(sameA);
        assertThat(second)
                .containsEntry("total", 3)
                .containsEntry("offset", 1)
                .containsEntry("limit", 1);

        Map<String, Object> past =
                send(HttpMethod.GET, PATH + "?offset=3", ADMIN_ID, null, null).getBody();
        assertThat(items(past)).isEmpty();
        assertThat(past).containsEntry("total", 3);

        for (String query : List.of("offset=-1", "limit=0", "limit=101", "limit=abc")) {
            assertError(
                    send(HttpMethod.GET, PATH + "?" + query, ADMIN_ID, null, null),
                    HttpStatus.BAD_REQUEST,
                    "INVALID_INPUT");
        }
        assertThat(send(HttpMethod.GET, PATH + "?limit=100", ADMIN_ID, null, null).getStatusCode())
                .isEqualTo(HttpStatus.OK);
    }

    // ── 상세 ─────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("상세 — 모집 현황은 포트의 수로, ONLINE·OFFLINE 순. 유효 신청이 남은 방식은 없앨 수 없다. 질문 키는 조회마다 같다")
    void detail() {
        long eventId = create(now.plus(Duration.ofDays(5)));
        String path = PATH + "/" + eventId;
        given(registrationPort.countActiveSeats(eventId))
                .willReturn(new EventSeatCounts(3, 41, 5, 35));

        ResponseEntity<Map> response = send(HttpMethod.GET, path, ADMIN_ID, null, null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        Map<String, Object> detail = response.getBody();
        assertThat(seats(detail))
                .containsExactly(
                        Map.of(
                                "channel",
                                "ONLINE",
                                "capacity",
                                100,
                                "pending",
                                3,
                                "confirmed",
                                41,
                                "remaining",
                                56),
                        Map.of(
                                "channel",
                                "OFFLINE",
                                "capacity",
                                40,
                                "pending",
                                5,
                                "confirmed",
                                35,
                                "remaining",
                                0));
        assertThat(detail)
                .containsEntry("displayStatus", "RECRUITING")
                .containsEntry("removableChannels", List.of());
        assertThat(questions(detail))
                .isEqualTo(questions(send(HttpMethod.GET, path, ADMIN_ID, null, null).getBody()));

        given(registrationPort.countActiveSeats(eventId))
                .willReturn(new EventSeatCounts(0, 0, 2, 0));
        assertThat(send(HttpMethod.GET, path, ADMIN_ID, null, null).getBody())
                .containsEntry("removableChannels", List.of("ONLINE"));
    }

    @Test
    @DisplayName("상세 — 없는 행사는 404")
    void detailNotFound() {
        assertError(
                send(HttpMethod.GET, PATH + "/" + MISSING_EVENT_ID, ADMIN_ID, null, null),
                HttpStatus.NOT_FOUND,
                "NOT_FOUND");
    }

    // ── 수정 ─────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("수정 — 200 + 버전 1 증가. 질문 키는 유지·추가·삭제되고, 옛 버전으로 다시 저장하면 409")
    void update() {
        Map<String, Object> created = createDetail(now.plus(Duration.ofDays(5)));
        long eventId = longOf(created, "eventId");
        String path = PATH + "/" + eventId;
        List<Map<String, Object>> before = questions(created);
        String keptKey = (String) before.get(1).get("questionId");

        Map<String, Object> body = editable(created);
        Map<String, Object> kept = new LinkedHashMap<>(before.get(1));
        kept.put("label", "관심 주제 (수정)");
        Map<String, Object> added = question("TEXT");
        body.put("questions", List.of(added, kept));
        body.put("title", "제목 수정");
        body.put("format", "ONLINE");
        body.remove("offline");
        body.put("online", Map.of("capacity", 120));

        ResponseEntity<Map> response = send(HttpMethod.PUT, path, ADMIN_ID, body, null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        Map<String, Object> updated = response.getBody();
        assertThat(updated)
                .containsEntry("version", 1)
                .containsEntry("title", "제목 수정")
                .containsEntry("format", "ONLINE")
                .containsEntry("offline", null)
                .containsEntry("status", "PUBLISHED");
        Map<String, Object> online = new LinkedHashMap<>();
        online.put("capacity", 120);
        online.put("url", null);
        assertThat(updated.get("online")).isEqualTo(online);
        // 공개 시각은 수정이 바꾸지 않는다. 메모리 값과 DB 값의 소수점 정밀도가 달라 초까지만 비교한다
        assertThat(seconds(updated.get("publishedAt")))
                .isEqualTo(seconds(created.get("publishedAt")));
        List<Map<String, Object>> after = questions(updated);
        assertThat(after).extracting(q -> q.get("label")).containsExactly("단답 질문", "관심 주제 (수정)");
        assertThat(after.get(1).get("questionId")).isEqualTo(keptKey);
        assertThat(after.get(0).get("questionId"))
                .isNotIn(before.stream().map(q -> q.get("questionId")).toList());
        Map<String, Object> reread = send(HttpMethod.GET, path, ADMIN_ID, null, null).getBody();
        assertThat(questions(reread)).isEqualTo(after);
        assertThat(reread).containsEntry("version", 1);

        assertError(
                send(HttpMethod.PUT, path, ADMIN_ID, body, null),
                HttpStatus.CONFLICT,
                "EVENT_VERSION_CONFLICT");
    }

    @Test
    @DisplayName("수정 — version · confirmation · questions 가 없으면 400. 필드 검증이 404 보다 먼저다")
    void updateRequiredFields() {
        Map<String, Object> created = createDetail(now.plus(Duration.ofDays(5)));
        String path = PATH + "/" + longOf(created, "eventId");
        for (String field : List.of("version", "confirmation", "questions")) {
            Map<String, Object> body = editable(created);
            body.put(field, null);
            ResponseEntity<Map> response = send(HttpMethod.PUT, path, ADMIN_ID, body, null);
            assertError(response, HttpStatus.BAD_REQUEST, "INVALID_INPUT");
            assertThat(message(response)).startsWith(field + ":");
        }

        // 소수 버전은 0 으로 잘려 「같은 버전」으로 통과하지 않는다
        for (Object fractional : List.of(0.9, 0.0)) {
            Map<String, Object> body = editable(created);
            body.put("version", fractional);
            ResponseEntity<Map> response = send(HttpMethod.PUT, path, ADMIN_ID, body, null);
            assertError(response, HttpStatus.BAD_REQUEST, "INVALID_INPUT");
            assertThat(message(response)).startsWith("version:");
        }
        Map<String, Object> fractionalCapacity = editable(created);
        fractionalCapacity.put("online", Map.of("capacity", 100.5));
        ResponseEntity<Map> capacityResponse =
                send(HttpMethod.PUT, path, ADMIN_ID, fractionalCapacity, null);
        assertError(capacityResponse, HttpStatus.BAD_REQUEST, "INVALID_INPUT");
        assertThat(message(capacityResponse)).startsWith("online.capacity:");

        Map<String, Object> noVersion = editable(created);
        noVersion.remove("version");
        String missing = PATH + "/" + MISSING_EVENT_ID;
        assertError(
                send(HttpMethod.PUT, missing, ADMIN_ID, noVersion, null),
                HttpStatus.BAD_REQUEST,
                "INVALID_INPUT");
        assertError(
                send(HttpMethod.PUT, missing, ADMIN_ID, editable(created), null),
                HttpStatus.NOT_FOUND,
                "NOT_FOUND");
        assertThat(versionOf(longOf(created, "eventId"))).isZero();
    }

    @Test
    @DisplayName("수정 — 처리 순서 2~11: 모든 조건을 어긴 요청을 하나씩 고치면 스펙 순서대로 다음 실패가 나오고, 실패는 아무것도 바꾸지 않는다")
    void updateFailureOrder() {
        Map<String, Object> created = createDetail(now.plus(Duration.ofDays(5)));
        long eventId = longOf(created, "eventId");
        String path = PATH + "/" + eventId;
        // 시작 1시간 전 · 이미 끝남 · 취소 · 버전 3. 온라인 확인 대기 3 · 오프라인 확인 대기 5
        Instant startsAt = now.minus(Duration.ofHours(1));
        Instant deadlineAt = now.minus(Duration.ofHours(2));
        jdbcTemplate.update(
                "UPDATE CLUB_EVENT SET STARTS_AT = ?, ENDS_AT = ?, DEADLINE_AT = ?, STATUS = 'CANCELLED', VERSION = 3 WHERE ID = ?",
                Timestamp.from(startsAt),
                Timestamp.from(now.minus(Duration.ofMinutes(1))),
                Timestamp.from(deadlineAt),
                eventId);
        given(registrationPort.countActiveSeats(eventId))
                .willReturn(new EventSeatCounts(3, 0, 5, 0));

        Map<String, Object> body = editable(created);
        body.put("version", 2);
        Map<String, Object> unknown = question("TEXT");
        unknown.put("questionId", "없는-키");
        body.put("questions", List.of(unknown));
        body.put("startsAt", iso(now.plus(Duration.ofHours(1))));
        body.put("endsAt", iso(now.plus(Duration.ofHours(2))));
        body.put("deadlineAt", iso(now.plus(Duration.ofMinutes(30))));
        body.put("confirmation", "AUTO");
        body.put("format", "ONLINE");
        body.remove("offline");
        body.put("online", Map.of("capacity", 2));

        // 2 · 3
        expectConflict(path, body, "EVENT_CANCELLED");
        jdbcTemplate.update("UPDATE CLUB_EVENT SET STATUS = 'PUBLISHED' WHERE ID = ?", eventId);
        expectConflict(path, body, "EVENT_ENDED");
        jdbcTemplate.update(
                "UPDATE CLUB_EVENT SET ENDS_AT = ? WHERE ID = ?",
                Timestamp.from(now.plus(Duration.ofHours(2))),
                eventId);
        // 4
        expectConflict(path, body, "EVENT_VERSION_CONFLICT");
        body.put("version", 3);
        // 5 — 400 이지만 6~9 의 409 보다 먼저
        expectInvalid(path, body, "questions[0].questionId");
        body.put("questions", List.of(question("TEXT")));
        // 6
        expectConflict(path, body, "EVENT_START_LOCKED");
        body.put("startsAt", iso(startsAt));
        body.put("deadlineAt", iso(deadlineAt.minus(Duration.ofHours(1))));
        body.put("endsAt", iso(now.minus(Duration.ofMinutes(1))));
        // 7
        expectConflict(path, body, "EVENT_ALREADY_STARTED");
        body.put("confirmation", "REVIEW");
        // 8
        expectConflict(path, body, "CHANNEL_IN_USE");
        body.put("format", "HYBRID");
        body.put("offline", Map.of("capacity", 5, "location", "강남"));
        // 9
        expectConflict(path, body, "CAPACITY_BELOW_OCCUPIED");
        body.put("online", Map.of("capacity", 3));
        // 10 — 공개 중인 행사의 마감을 지난 시각으로 옮겼다
        expectInvalid(path, body, "deadlineAt");
        body.put("deadlineAt", iso(deadlineAt));
        // 11 — 저장하자마자 끝나는 종료 시각
        expectInvalid(path, body, "endsAt");
        assertThat(versionOf(eventId)).isEqualTo(3);

        body.put("endsAt", iso(now.plus(Duration.ofHours(3))));
        ResponseEntity<Map> saved = send(HttpMethod.PUT, path, ADMIN_ID, body, null);

        assertThat(saved.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(saved.getBody())
                .containsEntry("version", 4)
                .containsEntry("displayStatus", "RECRUITMENT_CLOSED")
                .containsEntry("canEdit", true)
                .containsEntry("canChangeConfirmation", false)
                .containsEntry("canSetFutureStart", false);
        verify(registrationPort, never()).confirmPendingRegistrations(anyLong(), anyLong());
    }

    @Test
    @DisplayName("수정 — 행사 행 쓰기 잠금이 첫 조회다. 신청 수·일괄 확정은 잠금 뒤에 부르고, 잠그지 않는 조회로 행사를 먼저 읽지 않는다 (Q8)")
    void updateLocksBeforeCounting() {
        Map<String, Object> created = createDetail(now.plus(Duration.ofDays(5)));
        long eventId = longOf(created, "eventId");
        Map<String, Object> body = editable(created);
        body.put("confirmation", "AUTO");
        clearInvocations(clubEventRepository, registrationPort);

        assertThat(send(HttpMethod.PUT, PATH + "/" + eventId, ADMIN_ID, body, null).getStatusCode())
                .isEqualTo(HttpStatus.OK);

        InOrder order = inOrder(clubEventRepository, registrationPort);
        order.verify(clubEventRepository).findByIdForUpdate(eventId);
        order.verify(registrationPort).countActiveSeats(eventId);
        order.verify(registrationPort).confirmPendingRegistrations(eventId, ADMIN_ID);
        verify(clubEventRepository, never()).findById(anyLong());
    }

    @Test
    @DisplayName(
            "수정 — REVIEW → AUTO 는 확인 대기를 일괄 확정하고, 바꾼 신청이 있으면 ClubEventRegistrationsConfirmedEvent 를 발행한다")
    void switchToAutoConfirmsPending() {
        Map<String, Object> created = createDetail(now.plus(Duration.ofDays(5)));
        long eventId = longOf(created, "eventId");
        String path = PATH + "/" + eventId;
        given(registrationPort.confirmPendingRegistrations(eventId, ADMIN_ID))
                .willReturn(List.of(11L, 12L));

        Map<String, Object> body = editable(created);
        body.put("confirmation", "AUTO");
        ResponseEntity<Map> response = send(HttpMethod.PUT, path, ADMIN_ID, body, null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).containsEntry("confirmation", "AUTO");
        verify(registrationPort).confirmPendingRegistrations(eventId, ADMIN_ID);
        assertThat(recorder.events)
                .singleElement()
                .satisfies(
                        event -> {
                            assertThat(event.name())
                                    .isEqualTo("club_event.registrations_confirmed");
                            assertThat(event.clubEventId()).isEqualTo(eventId);
                            assertThat(event.registrationIds()).containsExactly(11L, 12L);
                            assertThat(event.actorId()).isEqualTo(String.valueOf(ADMIN_ID));
                        });
    }

    @Test
    @DisplayName("수정 — 확인 대기가 없으면 일괄 확정 이벤트를 내지 않고, AUTO → REVIEW 는 신청을 건드리지 않는다")
    void noEventWhenNothingConfirmed() {
        Map<String, Object> created = createDetail(now.plus(Duration.ofDays(5)));
        long eventId = longOf(created, "eventId");
        String path = PATH + "/" + eventId;

        Map<String, Object> toAuto = editable(created);
        toAuto.put("confirmation", "AUTO");
        assertThat(send(HttpMethod.PUT, path, ADMIN_ID, toAuto, null).getStatusCode())
                .isEqualTo(HttpStatus.OK);
        verify(registrationPort).confirmPendingRegistrations(eventId, ADMIN_ID);
        assertThat(recorder.events).isEmpty();

        Map<String, Object> toReview =
                editable(send(HttpMethod.GET, path, ADMIN_ID, null, null).getBody());
        toReview.put("confirmation", "REVIEW");
        assertThat(send(HttpMethod.PUT, path, ADMIN_ID, toReview, null).getStatusCode())
                .isEqualTo(HttpStatus.OK);
        verify(registrationPort).confirmPendingRegistrations(eventId, ADMIN_ID);
        assertThat(recorder.events).isEmpty();
    }

    @Test
    @DisplayName("수정 — 정원을 유효 신청 수 이상으로 늘리면 정원 마감이 모집 중으로 돌아간다 (Q11)")
    void capacityGrowthReopens() {
        Map<String, Object> body = body();
        body.put("format", "OFFLINE");
        body.remove("online");
        body.put("offline", Map.of("capacity", 2, "location", "강남"));
        Map<String, Object> created =
                send(HttpMethod.POST, PATH, ADMIN_ID, body, newKey()).getBody();
        long eventId = longOf(created, "eventId");
        given(registrationPort.countActiveSeats(eventId))
                .willReturn(new EventSeatCounts(0, 0, 1, 1));
        String path = PATH + "/" + eventId;
        assertThat(send(HttpMethod.GET, path, ADMIN_ID, null, null).getBody())
                .containsEntry("displayStatus", "FULL");

        Map<String, Object> grow = editable(created);
        grow.put("offline", Map.of("capacity", 3, "location", "강남"));

        assertThat(send(HttpMethod.PUT, path, ADMIN_ID, grow, null).getBody())
                .containsEntry("displayStatus", "RECRUITING");
    }

    // ── 도우미 ───────────────────────────────────────────────────────────────

    private void expectConflict(String path, Map<String, Object> body, String errorCode) {
        assertError(
                send(HttpMethod.PUT, path, ADMIN_ID, body, null), HttpStatus.CONFLICT, errorCode);
    }

    private void expectInvalid(String path, Map<String, Object> body, String field) {
        ResponseEntity<Map> response = send(HttpMethod.PUT, path, ADMIN_ID, body, null);
        assertError(response, HttpStatus.BAD_REQUEST, "INVALID_INPUT");
        assertThat(message(response)).startsWith(field + ":");
    }

    /** 시작 5일 뒤 · 종료 3시간 · 마감 하루 전 · 하이브리드 · REVIEW · 질문 2개. */
    private Map<String, Object> body() {
        return body(now.plus(Duration.ofDays(5)));
    }

    private Map<String, Object> body(Instant startsAt) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("title", "연말 네트워킹 밋업");
        body.put("summary", "한 해를 마무리하며 크루끼리 만나요");
        body.put("description", "행사 소개, 참가 조건, 추가 절차");
        body.put("timeZone", "Asia/Seoul");
        body.put("startsAt", iso(startsAt));
        body.put("endsAt", iso(startsAt.plus(Duration.ofHours(3))));
        body.put("deadlineAt", iso(startsAt.minus(Duration.ofDays(1))));
        body.put("format", "HYBRID");
        body.put("offline", Map.of("capacity", 40, "location", "서울 강남구 ○○빌딩 5층"));
        body.put("online", Map.of("capacity", 100, "url", "https://meet.example.com/abc"));
        body.put("confirmation", "REVIEW");
        Map<String, Object> motive = labelled("참여 동기");
        motive.put("type", "TEXTAREA");
        motive.put("required", true);
        Map<String, Object> topics = question("CHECKBOX", "AI", "커리어", "네트워킹");
        topics.put("label", "관심 주제");
        body.put("questions", List.of(motive, topics));
        return body;
    }

    private static Map<String, Object> question(String type, String... options) {
        Map<String, Object> question = new LinkedHashMap<>();
        question.put("questionId", null);
        question.put("label", "단답 질문");
        question.put("type", type);
        question.put("required", false);
        question.put("options", List.of(options));
        return question;
    }

    private static Map<String, Object> labelled(String label) {
        Map<String, Object> question = question("TEXT");
        question.put("label", label);
        return question;
    }

    private static List<Map<String, Object>> repeat(Map<String, Object> item, int times) {
        List<Map<String, Object>> list = new ArrayList<>();
        for (int i = 0; i < times; i++) {
            list.add(item);
        }
        return list;
    }

    /** 화면처럼 상세 응답으로 폼을 채워 모든 필드를 보낸다. */
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
                        "confirmation")) {
            body.put(field, detail.get(field));
        }
        if (detail.get("offline") != null) {
            body.put("offline", detail.get("offline"));
        }
        if (detail.get("online") != null) {
            body.put("online", detail.get("online"));
        }
        List<Map<String, Object>> questions = new ArrayList<>();
        for (Map<String, Object> question : (List<Map<String, Object>>) detail.get("questions")) {
            questions.add(new LinkedHashMap<>(question));
        }
        body.put("questions", questions);
        return body;
    }

    private long create(Instant startsAt) {
        return longOf(createDetail(startsAt), "eventId");
    }

    private Map<String, Object> createDetail(Instant startsAt) {
        ResponseEntity<Map> response =
                send(HttpMethod.POST, PATH, ADMIN_ID, body(startsAt), newKey());
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        return response.getBody();
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
        HttpEntity<Map<String, Object>> entity =
                new HttpEntity<>(method == HttpMethod.GET ? null : body, headers);
        return rest.exchange(URI.create(url), method, entity, Map.class);
    }

    @SuppressWarnings("rawtypes")
    private static void assertError(
            ResponseEntity<Map> response, HttpStatus status, String errorCode) {
        assertThat(response.getStatusCode()).isEqualTo(status);
        assertThat(response.getBody()).containsEntry("errorCode", errorCode);
    }

    @SuppressWarnings("rawtypes")
    private static String message(ResponseEntity<Map> response) {
        return String.valueOf(response.getBody().get("errorMessage"));
    }

    private static Instant seconds(Object iso) {
        return Instant.parse((String) iso).truncatedTo(ChronoUnit.SECONDS);
    }

    private static String newKey() {
        return UUID.randomUUID().toString();
    }

    private static String iso(Instant instant) {
        return instant.toString();
    }

    private static long longOf(Map<?, ?> map, String key) {
        return ((Number) map.get(key)).longValue();
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> seats(Map<String, Object> detail) {
        return (List<Map<String, Object>>) detail.get("seats");
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> questions(Map<String, Object> detail) {
        return (List<Map<String, Object>>) detail.get("questions");
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> items(Map<String, Object> page) {
        return (List<Map<String, Object>>) page.get("items");
    }

    private int eventCount() {
        return jdbcTemplate.queryForObject("SELECT COUNT(*) FROM CLUB_EVENT", Integer.class);
    }

    private long versionOf(long eventId) {
        return jdbcTemplate.queryForObject(
                "SELECT VERSION FROM CLUB_EVENT WHERE ID = ?", Long.class, eventId);
    }

    private void insertAccount(long id, SystemRole role) {
        Timestamp at = Timestamp.from(Instant.now());
        jdbcTemplate.update(
                "INSERT INTO ACCOUNT (ID, EMAIL, NICKNAME, SYSTEM_ROLE, TIME_ZONE,"
                        + " ONBOARDING_COMPLETED_AT, CREATED_AT, UPDATED_AT)"
                        + " VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                id,
                "event-" + id + "@example.com",
                "event_" + id,
                role.name(),
                "Asia/Seoul",
                at,
                at,
                at);
    }
}
