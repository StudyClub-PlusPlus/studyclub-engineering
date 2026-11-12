package com.studyclub.api.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.account.Issuer;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jws;
import io.jsonwebtoken.Jwts;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.spec.ECGenParameterSpec;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class AppleOAuthClientTest {

    private static final String CLIENT_ID = "life.studyclub";
    private static final String WEB_CLIENT_ID = "life.studyclub.web";

    private HttpServer server;
    private KeyPair keys;
    private String apiUrl;
    private final Map<String, Integer> statuses = new HashMap<>();
    private final Map<String, String> bodies = new HashMap<>();
    private final Map<String, Map<String, String>> receivedForms = new HashMap<>();

    @BeforeEach
    void setUp() throws Exception {
        KeyPairGenerator generator = KeyPairGenerator.getInstance("EC");
        generator.initialize(new ECGenParameterSpec("secp256r1"));
        keys = generator.generateKeyPair();

        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", this::handle);
        server.start();
        apiUrl = "http://127.0.0.1:" + server.getAddress().getPort();
        respondToken(
                "{\"iss\":\"https://appleid.apple.com\",\"aud\":\""
                        + CLIENT_ID
                        + "\",\"sub\":\"apple-sub-1\",\"email\":\"abc@privaterelay.appleid.com\",\"email_verified\":\"true\"}");
        statuses.put("/auth/revoke", 200);
    }

    @AfterEach
    void tearDown() {
        server.stop(0);
    }

    private void handle(HttpExchange exchange) throws IOException {
        String path = exchange.getRequestURI().getPath();
        String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
        Map<String, String> form = new HashMap<>();
        for (String pair : body.split("&")) {
            String[] kv = pair.split("=", 2);
            form.put(kv[0], URLDecoder.decode(kv.length > 1 ? kv[1] : "", StandardCharsets.UTF_8));
        }
        receivedForms.put(path, form);
        byte[] bytes = bodies.getOrDefault(path, "{}").getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.sendResponseHeaders(statuses.getOrDefault(path, 404), bytes.length);
        exchange.getResponseBody().write(bytes);
        exchange.close();
    }

    /** 애플 토큰 응답. id_token 서명은 보지 않으니 헤더·서명 자리는 아무 값이다 */
    private void respondToken(String idTokenPayload) {
        String payload =
                Base64.getUrlEncoder()
                        .withoutPadding()
                        .encodeToString(idTokenPayload.getBytes(StandardCharsets.UTF_8));
        statuses.put("/auth/token", 200);
        bodies.put(
                "/auth/token",
                "{\"id_token\":\"e30." + payload + ".sig\",\"refresh_token\":\"apple-refresh-1\"}");
    }

    private AppleOAuthClient client() {
        String pkcs8 = Base64.getEncoder().encodeToString(keys.getPrivate().getEncoded());
        return new AppleOAuthClient(
                apiUrl, "TEAM123456", "KEY1234567", CLIENT_ID, WEB_CLIENT_ID, pkcs8);
    }

    @Test
    @DisplayName("성공 - code 를 교환해 id_token 의 sub·이메일과 refresh token 을 돌려준다")
    void exchange() {
        SocialUser user = client().exchange("apple-code", null);

        assertThat(user.issuer()).isEqualTo(Issuer.APPLE);
        assertThat(user.sub()).isEqualTo("apple-sub-1");
        assertThat(user.email()).isEqualTo("abc@privaterelay.appleid.com");
        assertThat(user.emailVerified()).isTrue(); // 문자열 "true" 도 검증된 것으로 읽는다
        assertThat(user.refreshToken()).isEqualTo("apple-refresh-1");
        assertThat(receivedForms.get("/auth/token"))
                .containsEntry("grant_type", "authorization_code")
                .containsEntry("code", "apple-code")
                .containsEntry("client_id", CLIENT_ID);
    }

    @Test
    @DisplayName("성공 - client secret 은 .p8 키로 서명한 ES256 JWT (kid=키 ID, iss=팀, sub=번들 ID, aud=애플)")
    void clientSecretIsSignedJwt() {
        client().exchange("apple-code", null);

        String secret = receivedForms.get("/auth/token").get("client_secret");
        Jws<Claims> jws =
                Jwts.parser().verifyWith(keys.getPublic()).build().parseSignedClaims(secret);
        assertThat(jws.getHeader().getKeyId()).isEqualTo("KEY1234567");
        assertThat(jws.getHeader().getAlgorithm()).isEqualTo("ES256");
        assertThat(jws.getPayload().getIssuer()).isEqualTo("TEAM123456");
        assertThat(jws.getPayload().getSubject()).isEqualTo(CLIENT_ID);
        assertThat(jws.getPayload().getAudience()).containsExactly("https://appleid.apple.com");
    }

    @Test
    @DisplayName("실패 - id_token 의 aud 가 우리 번들 ID 가 아니면 401")
    void rejectsOtherAudience() {
        respondToken(
                "{\"iss\":\"https://appleid.apple.com\",\"aud\":\"other.app\",\"sub\":\"x\",\"email\":\"a@b.c\"}");

        assertThatThrownBy(() -> client().exchange("apple-code", null))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).errorCode())
                .isEqualTo(ErrorCode.UNAUTHORIZED);
    }

    @Test
    @DisplayName("실패 - 애플이 code 를 거절하면(400 invalid_grant) 401")
    void rejectedCode() {
        statuses.put("/auth/token", 400);
        bodies.put("/auth/token", "{\"error\":\"invalid_grant\"}");

        assertThatThrownBy(() -> client().exchange("used-code", null))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).errorCode())
                .isEqualTo(ErrorCode.UNAUTHORIZED);
    }

    @Test
    @DisplayName("실패 - 설정이 비어 있으면 503")
    void notConfigured() {
        AppleOAuthClient empty = new AppleOAuthClient(apiUrl, "", "", "", "", "");

        assertThatThrownBy(() -> empty.exchange("apple-code", null))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).errorCode())
                .isEqualTo(ErrorCode.EXTERNAL_SERVICE_ERROR);
    }

    @Test
    @DisplayName("revoke - refresh token 을 보내고, 애플이 실패해도 예외를 던지지 않는다")
    void revoke() {
        client().revoke("apple-refresh-1");
        assertThat(receivedForms.get("/auth/revoke"))
                .containsEntry("token", "apple-refresh-1")
                .containsEntry("token_type_hint", "refresh_token");

        statuses.put("/auth/revoke", 500);
        assertThatCode(() -> client().revoke("apple-refresh-1")).doesNotThrowAnyException();
        assertThatCode(() -> new AppleOAuthClient(apiUrl, "", "", "", "", "").revoke("t"))
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName(
            "성공 - 사이트는 Services ID 와 authorize 때 쓴 redirect_uri 로 교환하고, aud 도 Services ID 로 본다")
    void webExchangeUsesServicesId() {
        respondToken(
                "{\"iss\":\"https://appleid.apple.com\",\"aud\":\""
                        + WEB_CLIENT_ID
                        + "\",\"sub\":\"apple-sub-1\",\"email\":\"a@b.c\",\"email_verified\":true}");

        SocialUser user =
                client().exchange("web-code", "https://studyclub.life/api/auth/apple/callback");

        assertThat(user.sub()).isEqualTo("apple-sub-1");
        assertThat(user.emailVerified()).isTrue(); // boolean true 도 받는다
        assertThat(receivedForms.get("/auth/token"))
                .containsEntry("client_id", WEB_CLIENT_ID)
                .containsEntry("redirect_uri", "https://studyclub.life/api/auth/apple/callback");
        String secret = receivedForms.get("/auth/token").get("client_secret");
        assertThat(
                        Jwts.parser()
                                .verifyWith(keys.getPublic())
                                .build()
                                .parseSignedClaims(secret)
                                .getPayload()
                                .getSubject())
                .isEqualTo(WEB_CLIENT_ID);
    }

    @Test
    @DisplayName("실패 - 앱 토큰(aud=번들 ID)을 사이트 교환으로 받으면 401")
    void webRejectsAppAudience() {
        assertThatThrownBy(
                        () ->
                                client().exchange(
                                                "web-code",
                                                "https://studyclub.life/api/auth/apple/callback"))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).errorCode())
                .isEqualTo(ErrorCode.UNAUTHORIZED);
    }
}
