package com.studyclub.api.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class DiscordOAuthClientTest {

    private static final String GUILD = "1327394882193880100";
    private static final String USER = "1327394882193880001";
    private static final String TOKEN_OK =
            "{\"access_token\":\"tok-123\",\"token_type\":\"Bearer\"}";
    private static final String USER_OK = "{\"id\":\"" + USER + "\",\"username\":\"jiwon_dev\"}";

    private HttpServer server;
    private DiscordOAuthClient client;

    // 경로별로 돌려줄 응답과, 가짜 디스코드가 받은 요청
    private final Map<String, Integer> statuses = new HashMap<>();
    private final Map<String, String> bodies = new HashMap<>();
    private final List<String> receivedPaths = new ArrayList<>();
    private String receivedTokenForm;
    private String receivedAuthorization;

    @BeforeEach
    void setUp() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", this::handle);
        server.start();
        client = configured("http://127.0.0.1:" + server.getAddress().getPort());
        respond("/oauth2/token", 200, TOKEN_OK);
        respond("/users/@me", 200, USER_OK);
        respond("/users/@me/guilds/" + GUILD + "/member", 200, "{}");
    }

    @AfterEach
    void tearDown() {
        server.stop(0);
    }

    private void handle(HttpExchange exchange) throws IOException {
        String path = exchange.getRequestURI().getPath();
        receivedPaths.add(path);
        String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
        if (path.equals("/oauth2/token")) {
            receivedTokenForm = body;
        } else {
            receivedAuthorization = exchange.getRequestHeaders().getFirst("Authorization");
        }
        byte[] bytes = bodies.getOrDefault(path, "{}").getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.sendResponseHeaders(statuses.getOrDefault(path, 404), bytes.length);
        exchange.getResponseBody().write(bytes);
        exchange.close();
    }

    private static DiscordOAuthClient configured(String apiUrl) {
        return new DiscordOAuthClient(
                apiUrl, "client-id", "client-secret", "http://localhost:4700/discord", GUILD);
    }

    private void respond(String path, int status, String body) {
        statuses.put(path, status);
        bodies.put(path, body);
    }

    @Test
    @DisplayName("코드를_토큰으로_바꾸고_사용자와_길드_멤버를_확인한다")
    void 코드를_토큰으로_바꾸고_사용자와_길드_멤버를_확인한다() {
        DiscordOAuthClient.DiscordUser user = client.exchange("auth-code");

        assertThat(user).isEqualTo(new DiscordOAuthClient.DiscordUser(USER, "jiwon_dev"));
        assertThat(receivedPaths)
                .containsExactly(
                        "/oauth2/token", "/users/@me", "/users/@me/guilds/" + GUILD + "/member");
        assertThat(receivedTokenForm)
                .contains("grant_type=authorization_code")
                .contains("code=auth-code")
                .contains("client_id=client-id");
        assertThat(receivedAuthorization).isEqualTo("Bearer tok-123");
    }

    @Test
    @DisplayName("길드_멤버가_아니면_403")
    void 길드_멤버가_아니면_403() {
        respond("/users/@me/guilds/" + GUILD + "/member", 404, "{\"code\":10004}");

        assertThatThrownBy(() -> client.exchange("auth-code"))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.FORBIDDEN);
    }

    @Test
    @DisplayName("토큰_교환이_거절되면_외부_서비스_에러이고_사용자를_조회하지_않는다")
    void 토큰_교환이_거절되면_외부_서비스_에러이고_사용자를_조회하지_않는다() {
        respond("/oauth2/token", 400, "{\"error\":\"invalid_grant\"}");

        assertThatThrownBy(() -> client.exchange("auth-code"))
                .isInstanceOf(BusinessException.class)
                .hasMessageNotContaining("auth-code")
                .extracting("errorCode")
                .isEqualTo(ErrorCode.EXTERNAL_SERVICE_ERROR);
        assertThat(receivedPaths).containsExactly("/oauth2/token");
    }

    @Test
    @DisplayName("사용자_ID_가_snowflake_가_아니면_외부_서비스_에러")
    void 사용자_ID_가_snowflake_가_아니면_외부_서비스_에러() {
        respond("/users/@me", 200, "{\"id\":\"not-a-snowflake\",\"username\":\"jiwon_dev\"}");

        assertThatThrownBy(() -> client.exchange("auth-code"))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.EXTERNAL_SERVICE_ERROR);
    }

    @Test
    @DisplayName("디스코드에_닿지_않으면_외부_서비스_에러")
    void 디스코드에_닿지_않으면_외부_서비스_에러() {
        assertThatThrownBy(() -> configured("http://127.0.0.1:9").exchange("auth-code"))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.EXTERNAL_SERVICE_ERROR);
    }

    @Test
    @DisplayName("설정이_비어_있으면_호출하지_않고_실패한다")
    void 설정이_비어_있으면_호출하지_않고_실패한다() {
        DiscordOAuthClient unconfigured =
                new DiscordOAuthClient(
                        "http://127.0.0.1:" + server.getAddress().getPort(), "", "", "", "");

        assertThatThrownBy(() -> unconfigured.exchange("auth-code"))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.EXTERNAL_SERVICE_ERROR);
        assertThat(receivedPaths).isEmpty();
    }
}
