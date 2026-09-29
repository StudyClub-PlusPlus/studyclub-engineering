package com.studyclub.api.discord;

import static org.assertj.core.api.Assertions.assertThat;

import com.studyclub.api.auth.JwtService;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.SystemRole;
import com.studyclub.domain.discord.StudyDiscordLinkRepository;
import com.studyclub.domain.study.StudyRepository;
import com.sun.net.httpserver.Headers;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.TestRestTemplate;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureTestRestTemplate;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/**
 * HTTP 표면 — 봇이 무엇을 받는지, 등록 경로가 봇 실패를 삼키는지, 재시도 엔드포인트의 에러. 규칙의 세부는 {@link
 * StudyDiscordLinkServiceTest} 가 본다.
 *
 * <p>봇은 JDK 내장 {@link HttpServer} 로 흉내 낸다 — 새 의존성 없이 실제 HTTP 로 헤더까지 확인한다.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class StudyDiscordLinkIntegrationTest {

    private static final String API_KEY = "discord-link-test-key";
    private static final Long ADMIN_ID = 9101L;
    private static final Long MEMBER_ID = 9102L;
    private static final String ADMIN_DISCORD_ID = "1327394882193889101";
    private static final String CATEGORY_ID = "1327394882193883136";
    private static final String ROLE_ID = "1327394882193883140";

    /** 봇이 실제로 돌려주는 이름 중복 409 (discord/app/api/routes/studies.py). */
    private static final String DUPLICATE_NAME =
            "{\"detail\":\"a study with this name exists or is being created\"}";

    private static final FakeDiscordBot bot = FakeDiscordBot.start();

    @DynamicPropertySource
    static void discordProperties(DynamicPropertyRegistry registry) {
        registry.add("discord.bot-url", bot::url);
        registry.add("discord.api-key", () -> API_KEY);
    }

    @AfterAll
    static void stopBot() {
        bot.server.stop(0);
    }

    @Autowired TestRestTemplate rest;
    @Autowired JwtService jwtService;
    @Autowired JdbcTemplate jdbcTemplate;
    @Autowired AccountRepository accountRepository;
    @Autowired StudyRepository studyRepository;
    @Autowired StudyDiscordLinkRepository studyDiscordLinkRepository;

    @BeforeEach
    void setUp() {
        rest.getRestTemplate().setRequestFactory(new JdkClientHttpRequestFactory());
        studyDiscordLinkRepository.deleteAll();
        bot.reset();
        insertAccount(ADMIN_ID, SystemRole.ADMIN, ADMIN_DISCORD_ID);
        insertAccount(MEMBER_ID, SystemRole.MEMBER, null);
    }

    @Test
    @DisplayName("성공_스터디를_등록하면_봇이_제목으로_스터디를_만들고_연결이_저장된다")
    void 성공_스터디를_등록하면_봇이_제목으로_스터디를_만들고_연결이_저장된다() {
        bot.respond(201, created());

        Long studyId = createStudy("알고리즘 스터디");

        assertThat(studyDiscordLinkRepository.findByDiscordStudyId(CATEGORY_ID))
                .hasValueSatisfying(
                        link -> {
                            assertThat(link.getStudyId()).isEqualTo(studyId);
                            assertThat(link.getDiscordRoleId()).isEqualTo(ROLE_ID);
                        });
        assertThat(bot.requests).hasSize(1);
        FakeDiscordBot.Received received = bot.requests.getFirst();
        assertThat(received.path()).isEqualTo("/api/v1/studies");
        assertThat(received.header("X-API-Key")).isEqualTo(API_KEY);
        assertThat(received.header("X-Discord-User-ID")).isEqualTo(ADMIN_DISCORD_ID);
        assertThat(received.header("Idempotency-Key")).isNotBlank();
        assertThat(received.body()).contains("\"studyName\":\"알고리즘 스터디\"");
    }

    @Test
    @DisplayName("실패_봇이_409_를_줘도_스터디_등록은_201_이고_연결만_비어_있다")
    void 실패_봇이_409_를_줘도_스터디_등록은_201_이고_연결만_비어_있다() {
        bot.respond(409, "{\"detail\":\"a study with this name exists or is being created\"}");

        Long studyId = createStudy("알고리즘 스터디");

        assertThat(studyRepository.existsById(studyId)).isTrue();
        assertThat(studyDiscordLinkRepository.existsByStudyId(studyId)).isFalse();
    }

    @Test
    @DisplayName("실패_봇이_503_이어도_스터디_등록은_201_이고_연결만_비어_있다")
    void 실패_봇이_503_이어도_스터디_등록은_201_이고_연결만_비어_있다() {
        bot.respond(503, "{\"detail\":\"discord bot is not connected yet\"}");

        Long studyId = createStudy("알고리즘 스터디");

        assertThat(studyRepository.existsById(studyId)).isTrue();
        assertThat(studyDiscordLinkRepository.existsByStudyId(studyId)).isFalse();
    }

    @Test
    @DisplayName("성공_재시도는_바꾼_이름으로_봇을_부르고_201_과_연결을_돌려준다")
    void 성공_재시도는_바꾼_이름으로_봇을_부르고_201_과_연결을_돌려준다() {
        bot.respond(409, DUPLICATE_NAME);
        Long studyId = createStudy("알고리즘 스터디");
        bot.reset();
        bot.respond(201, created());

        var response =
                rest.postForEntity(
                        linkPath(studyId),
                        authenticated(ADMIN_ID, Map.of("studyName", "  알고리즘 스터디 2기  ")),
                        Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody())
                .containsEntry("discordStudyId", CATEGORY_ID)
                .containsEntry("discordRoleId", ROLE_ID);
        assertThat(studyDiscordLinkRepository.existsByStudyId(studyId)).isTrue();
        assertThat(bot.requests.getFirst().body()).contains("\"studyName\":\"알고리즘 스터디 2기\"");
    }

    @Test
    @DisplayName("실패_이미_연결된_스터디를_재시도하면_봇을_부르지_않고_409")
    void 실패_이미_연결된_스터디를_재시도하면_봇을_부르지_않고_409() {
        bot.respond(201, created());
        Long studyId = createStudy("알고리즘 스터디");
        bot.reset();

        var response =
                rest.postForEntity(linkPath(studyId), authenticated(ADMIN_ID, null), Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody()).containsEntry("errorCode", "CONFLICT");
        assertThat(bot.requests).isEmpty();
    }

    @Test
    @DisplayName("실패_재시도에서_봇이_409_를_주면_409")
    void 실패_재시도에서_봇이_409_를_주면_409() {
        bot.respond(409, DUPLICATE_NAME);
        Long studyId = createStudy("알고리즘 스터디");

        var response =
                rest.postForEntity(linkPath(studyId), authenticated(ADMIN_ID, null), Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(studyDiscordLinkRepository.existsByStudyId(studyId)).isFalse();
    }

    @Test
    @DisplayName("실패_봇_설정이_없어서_난_409_는_이름_충돌이_아니라_503")
    void 실패_봇_설정이_없어서_난_409_는_이름_충돌이_아니라_503() {
        bot.respond(409, "{\"detail\":\"no DISCORD_GUILD_ID configured\"}");
        Long studyId = createStudy("알고리즘 스터디");

        var response =
                rest.postForEntity(linkPath(studyId), authenticated(ADMIN_ID, null), Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        assertThat(response.getBody()).containsEntry("errorCode", "EXTERNAL_SERVICE_ERROR");
    }

    @Test
    @DisplayName("실패_봇_응답의_ID_가_snowflake_가_아니면_저장하지_않고_503")
    void 실패_봇_응답의_ID_가_snowflake_가_아니면_저장하지_않고_503() {
        bot.respond(409, DUPLICATE_NAME);
        Long studyId = createStudy("알고리즘 스터디");
        bot.respond(201, "{\"discordStudyId\":\"12\",\"discordRoleId\":\"" + ROLE_ID + "\"}");

        var response =
                rest.postForEntity(linkPath(studyId), authenticated(ADMIN_ID, null), Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        assertThat(studyDiscordLinkRepository.existsByStudyId(studyId)).isFalse();
    }

    @Test
    @DisplayName("실패_토큰이_없으면_401")
    void 실패_토큰이_없으면_401() {
        var response = rest.postForEntity(linkPath(1L), null, Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    @DisplayName("실패_ADMIN_이_아니면_403")
    void 실패_ADMIN_이_아니면_403() {
        bot.respond(409, DUPLICATE_NAME);
        Long studyId = createStudy("알고리즘 스터디");
        bot.reset();

        var response =
                rest.postForEntity(linkPath(studyId), authenticated(MEMBER_ID, null), Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(bot.requests).isEmpty();
    }

    @Test
    @DisplayName("실패_없는_스터디면_404")
    void 실패_없는_스터디면_404() {
        var response =
                rest.postForEntity(linkPath(999_999L), authenticated(ADMIN_ID, null), Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    @DisplayName("실패_studyName_이_공백이면_400")
    void 실패_studyName_이_공백이면_400() {
        var response =
                rest.postForEntity(
                        linkPath(1L),
                        authenticated(ADMIN_ID, Map.of("studyName", "   ")),
                        Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    private Long createStudy(String title) {
        var response =
                rest.postForEntity(
                        "/api/studies",
                        authenticated(
                                ADMIN_ID,
                                Map.of(
                                        "title", title,
                                        "oneLineSummary", "한 줄 소개",
                                        "category", "ALGORITHM")),
                        Void.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        String path = response.getHeaders().getLocation().getPath();
        return Long.parseLong(path.substring(path.lastIndexOf('/') + 1));
    }

    private static String linkPath(Long studyId) {
        return "/api/admin/studies/" + studyId + "/discord-link";
    }

    private static String created() {
        return "{\"discordStudyId\":\"" + CATEGORY_ID + "\",\"discordRoleId\":\"" + ROLE_ID + "\"}";
    }

    private HttpEntity<Map<String, Object>> authenticated(
            Long accountId, Map<String, Object> body) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        String email = accountRepository.findById(accountId).orElseThrow().getEmail();
        headers.setBearerAuth(jwtService.issueAccess(String.valueOf(accountId), email));
        return new HttpEntity<>(body, headers);
    }

    private void insertAccount(Long id, SystemRole role, String discordId) {
        if (accountRepository.findById(id).isPresent()) {
            return;
        }
        Timestamp now = Timestamp.from(Instant.now());
        jdbcTemplate.update(
                "INSERT INTO ACCOUNT (ID, EMAIL, NICKNAME, SYSTEM_ROLE, TIME_ZONE, DISCORD_ID,"
                        + " ONBOARDING_COMPLETED_AT, CREATED_AT, UPDATED_AT)"
                        + " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                id,
                "discord-link-" + id + "@example.test",
                "discord_link_" + id,
                role.name(),
                "Asia/Seoul",
                discordId,
                now,
                now,
                now);
    }

    /** 봇 create-study 의 흉내. 정해 둔 응답 하나를 돌려주고 받은 요청을 쌓는다. */
    static final class FakeDiscordBot {

        final HttpServer server;
        final List<Received> requests = new CopyOnWriteArrayList<>();
        private volatile int status = 201;
        private volatile String body = "{}";

        private FakeDiscordBot(HttpServer server) {
            this.server = server;
        }

        static FakeDiscordBot start() {
            try {
                HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
                FakeDiscordBot bot = new FakeDiscordBot(server);
                server.createContext(
                        "/",
                        exchange -> {
                            bot.requests.add(
                                    new Received(
                                            exchange.getRequestURI().getPath(),
                                            exchange.getRequestHeaders(),
                                            new String(
                                                    exchange.getRequestBody().readAllBytes(),
                                                    StandardCharsets.UTF_8)));
                            byte[] out = bot.body.getBytes(StandardCharsets.UTF_8);
                            exchange.getResponseHeaders().add("Content-Type", "application/json");
                            exchange.sendResponseHeaders(bot.status, out.length);
                            exchange.getResponseBody().write(out);
                            exchange.close();
                        });
                server.start();
                return bot;
            } catch (IOException e) {
                throw new IllegalStateException(e);
            }
        }

        String url() {
            return "http://127.0.0.1:" + server.getAddress().getPort();
        }

        void respond(int status, String body) {
            this.status = status;
            this.body = body;
        }

        void reset() {
            requests.clear();
        }

        record Received(String path, Headers headers, String body) {
            String header(String name) {
                return headers.getFirst(name);
            }
        }
    }
}
