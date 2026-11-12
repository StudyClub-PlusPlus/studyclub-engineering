package com.studyclub.api.discord;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;

class DiscordBotClientTest {

    private static final String API_KEY = "test-api-key";
    private static final String BOT_ID = "1327394882193880000";
    private static final String CAPTAIN = "1327394882193880001";
    private static final String STUDY = "1327394882193883136";
    private static final String ROLE = "1327394882193883140";
    private static final String CHANNEL = "1327394882193883137";
    private static final List<String> USERS = List.of("1327394882193880002", "1327394882193880003");

    private HttpServer server;
    private DiscordBotClient client;
    private ListAppender<ILoggingEvent> logAppender;

    // 가짜 봇이 받은 마지막 요청과 돌려줄 응답
    private String receivedMethod;
    private String receivedPath;
    private String receivedApiKey;
    private String receivedUserId;
    private String receivedIdempotencyKey;
    private String receivedContentType;
    private String receivedBody;
    private int responseStatus;
    private String responseBody;

    @BeforeEach
    void setUp() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext(
                "/",
                exchange -> {
                    receivedMethod = exchange.getRequestMethod();
                    receivedPath = exchange.getRequestURI().getPath();
                    receivedApiKey = exchange.getRequestHeaders().getFirst("X-API-Key");
                    receivedUserId = exchange.getRequestHeaders().getFirst("X-Discord-User-ID");
                    receivedIdempotencyKey =
                            exchange.getRequestHeaders().getFirst("Idempotency-Key");
                    receivedContentType = exchange.getRequestHeaders().getFirst("Content-Type");
                    receivedBody =
                            new String(
                                    exchange.getRequestBody().readAllBytes(),
                                    StandardCharsets.UTF_8);
                    if (responseBody == null) {
                        exchange.sendResponseHeaders(responseStatus, -1);
                    } else {
                        byte[] bytes = responseBody.getBytes(StandardCharsets.UTF_8);
                        exchange.getResponseHeaders().set("Content-Type", "application/json");
                        exchange.sendResponseHeaders(responseStatus, bytes.length);
                        exchange.getResponseBody().write(bytes);
                    }
                    exchange.close();
                });
        server.start();
        client =
                new DiscordBotClient(
                        "http://127.0.0.1:" + server.getAddress().getPort(), API_KEY, BOT_ID);
        logAppender = new ListAppender<>();
        logAppender.start();
        ((Logger) LoggerFactory.getLogger(DiscordBotClient.class)).addAppender(logAppender);
    }

    @AfterEach
    void tearDown() {
        server.stop(0);
        ((Logger) LoggerFactory.getLogger(DiscordBotClient.class)).detachAppender(logAppender);
    }

    private void respond(int status, String body) {
        responseStatus = status;
        responseBody = body;
    }

    @Test
    @DisplayName("API_키에_개행이_섞여도_키가_예외_메시지로_새지_않는다")
    void API_키에_개행이_섞여도_키가_예외_메시지로_새지_않는다() {
        // echo 로 만든 시크릿처럼 끝에 개행이 붙은 키. JDK 는 헤더 값을 통째로 메시지에 싣는다
        DiscordBotClient client =
                new DiscordBotClient("http://127.0.0.1:9", "FAKE_SECRET_MARKER\n", BOT_ID);

        assertThatThrownBy(() -> client.createStudy("알고리즘 스터디", "1327394882193880001"))
                .isInstanceOf(BusinessException.class)
                .hasMessageNotContaining("FAKE_SECRET_MARKER")
                .extracting("errorCode")
                .isEqualTo(ErrorCode.EXTERNAL_SERVICE_ERROR);
    }

    @Test
    @DisplayName("봇_설정이_없으면_호출하지_않고_실패한다")
    void 봇_설정이_없으면_호출하지_않고_실패한다() {
        DiscordBotClient unconfigured = new DiscordBotClient("", "", BOT_ID);

        assertThatThrownBy(() -> unconfigured.sendAlertMessage(CAPTAIN, "알림"))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.EXTERNAL_SERVICE_ERROR);
        assertThat(receivedMethod).isNull();
    }

    @Test
    @DisplayName("시스템_호출_ID_는_설정된_봇_ID_다")
    void 시스템_호출_ID_는_설정된_봇_ID_다() {
        assertThat(client.systemUserId()).isEqualTo(BOT_ID);
    }

    @Test
    @DisplayName("봇_ID_가_비어_있으면_시스템_호출_ID_를_주지_않는다")
    void 봇_ID_가_비어_있으면_시스템_호출_ID_를_주지_않는다() {
        DiscordBotClient noBotId = new DiscordBotClient("http://127.0.0.1:9", API_KEY, "");

        assertThatThrownBy(noBotId::systemUserId)
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.EXTERNAL_SERVICE_ERROR);
    }

    @Test
    @DisplayName("스터디를_만들면_공통_헤더를_싣고_ID_쌍을_받는다")
    void 스터디를_만들면_공통_헤더를_싣고_ID_쌍을_받는다() {
        respond(201, "{\"discordStudyId\":\"" + STUDY + "\",\"discordRoleId\":\"" + ROLE + "\"}");

        DiscordBotClient.CreatedStudy created = client.createStudy("알고리즘 스터디", CAPTAIN);

        assertThat(created).isEqualTo(new DiscordBotClient.CreatedStudy(STUDY, ROLE));
        assertThat(receivedMethod).isEqualTo("POST");
        assertThat(receivedPath).isEqualTo("/api/v1/studies");
        assertThat(receivedApiKey).isEqualTo(API_KEY);
        assertThat(receivedUserId).isEqualTo(CAPTAIN);
        assertThat(receivedIdempotencyKey).isNotBlank();
        assertThat(receivedBody).contains("\"studyName\":\"알고리즘 스터디\"");
        assertThat(logAppender.list)
                .anyMatch(
                        e ->
                                e.getLevel() == Level.INFO
                                        && e.getFormattedMessage().contains("op=create-study")
                                        && e.getFormattedMessage().contains("status=ok"));
        assertThat(logAppender.list)
                .anyMatch(
                        e ->
                                e.getLevel() == Level.INFO
                                        && e.getFormattedMessage().contains("op=create-study")
                                        && e.getFormattedMessage()
                                                .contains("discordStudyId=" + STUDY));
    }

    @Test
    @DisplayName("스터디_이름이_겹치면_409_를_CONFLICT_로_돌려준다")
    void 스터디_이름이_겹치면_409_를_CONFLICT_로_돌려준다() {
        respond(409, "{\"detail\":\"A study with this name already exists\"}");

        assertThatThrownBy(() -> client.createStudy("알고리즘 스터디", CAPTAIN))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.CONFLICT);
    }

    @Test
    @DisplayName("채널_목록은_Idempotency_Key_없이_조회하고_모르는_타입은_건너뛴다")
    void 채널_목록은_Idempotency_Key_없이_조회하고_모르는_타입은_건너뛴다() {
        respond(
                200,
                """
                [
                  {"discordChannelId":"%s","discordChannelName":"일반","discordChannelType":"TEXT"},
                  {"discordChannelId":"1327394882193883139","discordChannelName":"포럼","discordChannelType":"FORUM"},
                  {"discordChannelId":"1327394882193883138","discordChannelName":"스터디룸","discordChannelType":"VOICE"}
                ]
                """
                        .formatted(CHANNEL));

        List<DiscordBotClient.StudyChannel> channels =
                client.getStudyChannels(client.systemUserId(), STUDY);

        assertThat(channels)
                .containsExactly(
                        new DiscordBotClient.StudyChannel(
                                CHANNEL, "일반", DiscordBotClient.ChannelType.TEXT),
                        new DiscordBotClient.StudyChannel(
                                "1327394882193883138", "스터디룸", DiscordBotClient.ChannelType.VOICE));
        assertThat(receivedMethod).isEqualTo("GET");
        assertThat(receivedPath).isEqualTo("/api/v1/studies/" + STUDY + "/channels");
        assertThat(receivedUserId).isEqualTo(BOT_ID);
        assertThat(receivedIdempotencyKey).isNull();
        assertThat(receivedContentType).isNull();
    }

    @Test
    @DisplayName("채널_ID_가_snowflake_가_아니면_응답을_거부한다")
    void 채널_ID_가_snowflake_가_아니면_응답을_거부한다() {
        respond(
                200,
                "[{\"discordChannelId\":\"abc\",\"discordChannelName\":\"일반\",\"discordChannelType\":\"TEXT\"}]");

        assertThatThrownBy(() -> client.getStudyChannels(CAPTAIN, STUDY))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.EXTERNAL_SERVICE_ERROR);
    }

    @Test
    @DisplayName("역할을_붙이면_성공_수와_실패_목록을_받는다")
    void 역할을_붙이면_성공_수와_실패_목록을_받는다() {
        respond(
                200,
                "{\"succeededCount\":1,\"failed\":[{\"discordUserId\":\""
                        + USERS.get(1)
                        + "\",\"reason\":\"NOT_IN_GUILD\"}]}");

        DiscordBotClient.RoleChangeResult result =
                client.assignRole(client.systemUserId(), ROLE, STUDY, USERS);

        assertThat(result.succeededCount()).isEqualTo(1);
        assertThat(result.failed())
                .containsExactly(new DiscordBotClient.FailedUser(USERS.get(1), "NOT_IN_GUILD"));
        assertThat(receivedMethod).isEqualTo("POST");
        assertThat(receivedPath).isEqualTo("/api/v1/roles/" + ROLE + "/users");
        assertThat(receivedIdempotencyKey).isNotBlank();
        assertThat(receivedBody)
                .contains("\"discordStudyId\":\"" + STUDY + "\"")
                .contains(USERS.get(0), USERS.get(1));
    }

    @Test
    @DisplayName("역할을_떼는_DELETE_에도_바디가_실린다")
    void 역할을_떼는_DELETE_에도_바디가_실린다() {
        respond(200, "{\"succeededCount\":2,\"failed\":[]}");

        DiscordBotClient.RoleChangeResult result = client.removeRole(CAPTAIN, ROLE, STUDY, USERS);

        assertThat(result.succeededCount()).isEqualTo(2);
        assertThat(result.failed()).isEmpty();
        assertThat(receivedMethod).isEqualTo("DELETE");
        assertThat(receivedPath).isEqualTo("/api/v1/roles/" + ROLE + "/users");
        assertThat(receivedContentType).startsWith("application/json");
        assertThat(receivedBody)
                .contains("\"discordStudyId\":\"" + STUDY + "\"")
                .contains(USERS.get(0), USERS.get(1));
    }

    @Test
    @DisplayName("navigator_역할은_고정_경로로_붙이고_뗀다")
    void navigator_역할은_고정_경로로_붙이고_뗀다() {
        respond(200, "{\"succeededCount\":2,\"failed\":[]}");

        client.assignNavigatorRole(CAPTAIN, STUDY, USERS);
        assertThat(receivedMethod).isEqualTo("POST");
        assertThat(receivedPath).isEqualTo("/api/v1/roles/navigator/users");

        client.removeNavigatorRole(CAPTAIN, STUDY, USERS);
        assertThat(receivedMethod).isEqualTo("DELETE");
        assertThat(receivedPath).isEqualTo("/api/v1/roles/navigator/users");
        assertThat(receivedBody).contains(USERS.get(0));
    }

    @Test
    @DisplayName("스터디_채널에_멘션과_함께_메시지를_보낸다")
    void 스터디_채널에_멘션과_함께_메시지를_보낸다() {
        respond(204, null);

        client.sendMessage(CAPTAIN, CHANNEL, STUDY, "이번 주 모임은 목요일입니다.", USERS);

        assertThat(receivedMethod).isEqualTo("POST");
        assertThat(receivedPath).isEqualTo("/api/v1/channels/" + CHANNEL + "/msg");
        assertThat(receivedIdempotencyKey).isNotBlank();
        assertThat(receivedBody)
                .contains("\"discordStudyId\":\"" + STUDY + "\"")
                .contains("\"msg\":\"이번 주 모임은 목요일입니다.\"")
                .contains(USERS.get(0), USERS.get(1));
    }

    @Test
    @DisplayName("alert_와_announcement_는_고정_경로로_보낸다")
    void alert_와_announcement_는_고정_경로로_보낸다() {
        respond(204, null);

        client.sendAlertMessage(client.systemUserId(), "스터디가 완료 처리되었습니다.");
        assertThat(receivedPath).isEqualTo("/api/v1/channels/alert/msg");
        assertThat(receivedUserId).isEqualTo(BOT_ID);
        assertThat(receivedBody).isEqualTo("{\"msg\":\"스터디가 완료 처리되었습니다.\"}");

        client.sendAnnouncementMessage(CAPTAIN, "2기 모집을 시작합니다.");
        assertThat(receivedPath).isEqualTo("/api/v1/channels/announcement/msg");
        assertThat(receivedUserId).isEqualTo(CAPTAIN);
    }

    @Test
    @DisplayName("봇이_거절하면_detail_을_싣지_않고_EXTERNAL_SERVICE_ERROR_로_던진다")
    void 봇이_거절하면_detail_을_싣지_않고_EXTERNAL_SERVICE_ERROR_로_던진다() {
        respond(403, "{\"detail\":\"guild 1327394882193889999 captain role missing\"}");

        assertThatThrownBy(() -> client.sendAnnouncementMessage(CAPTAIN, "공지"))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("403")
                .hasMessageNotContaining("1327394882193889999")
                .extracting("errorCode")
                .isEqualTo(ErrorCode.EXTERNAL_SERVICE_ERROR);
        assertThat(logAppender.list)
                .anyMatch(
                        e ->
                                e.getLevel() == Level.WARN
                                        && e.getFormattedMessage()
                                                .contains("op=send-announcement-message")
                                        && e.getFormattedMessage()
                                                .contains("status=failure reason=HTTP-403"));
    }
}
