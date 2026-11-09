package com.studyclub.api.analytics;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.studyclub.domain.analytics.*;
import com.sun.net.httpserver.HttpServer;
import io.jsonwebtoken.Jwts;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.security.KeyPairGenerator;
import java.security.interfaces.RSAPublicKey;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

class AnalyticsDeletionGatewayTest {
    HttpServer server;
    String base;
    volatile String response;
    volatile int responseStatus = 200;
    final List<String> bodies = new ArrayList<>(),
            paths = new ArrayList<>(),
            auth = new ArrayList<>();
    final ObjectMapper json = new ObjectMapper();
    AnalyticsDeletionGateway gateway;

    @BeforeEach
    void start() throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext(
                "/",
                exchange -> {
                    bodies.add(
                            new String(
                                    exchange.getRequestBody().readAllBytes(),
                                    StandardCharsets.UTF_8));
                    paths.add(exchange.getRequestURI().toString());
                    auth.add(exchange.getRequestHeaders().getFirst("Authorization"));
                    byte[] data = response.getBytes(StandardCharsets.UTF_8);
                    exchange.getResponseHeaders().set("Content-Type", "application/json");
                    exchange.sendResponseHeaders(responseStatus, data.length);
                    exchange.getResponseBody().write(data);
                    exchange.close();
                });
        server.start();
        base = "http://127.0.0.1:" + server.getAddress().getPort();
        var token = mock(GoogleAnalyticsAccessToken.class);
        when(token.get()).thenReturn("test-access");
        gateway =
                new AnalyticsDeletionGateway(
                        token, "123", base, "test-api", "test-secret", base + "/deletions");
    }

    @AfterEach
    void stop() {
        server.stop(0);
    }

    @Test
    @DisplayName("GA는 속성에 userId와 clientId를 각각 제출하고 접수 시각을 검증한다")
    void googleContract() {
        response = "{\"deletionRequestTime\":\"2026-11-08T00:00:00Z\"}";
        gateway.submitGa4("protected-id", List.of("123.456", "123.456"));
        assertThat(paths).containsOnly("/properties/123:submitUserDeletion");
        assertThat(json.readValue(bodies.get(0), Map.class))
                .isEqualTo(Map.of("userId", "protected-id"));
        assertThat(json.readValue(bodies.get(1), Map.class))
                .isEqualTo(Map.of("clientId", "123.456"));
        assertThat(auth).containsOnly("Bearer test-access");
        response = "{}";
        assertThatThrownBy(() -> gateway.submitGa4("protected-id", List.of()))
                .hasMessage("INVALID_DELETION_RESPONSE");
    }

    @Test
    @DisplayName("Amplitude는 단일 프로젝트에 요청하고 모든 외부 ID가 done일 때만 완료한다")
    void amplitudeContract() {
        response =
                "[{\"day\":\"2026-11-09\",\"status\":\"scheduled\",\"amplitude_ids\":[{\"amplitude_id\":123,\"requested_on_day\":\"2026-11-08\"},{\"amplitude_id\":456,\"requested_on_day\":\"2026-11-08\"}]}]";
        String reference = gateway.submitAmplitude("protected-id");
        Instant requestedAt = Instant.parse("2026-11-08T00:00:00Z");
        Map<?, ?> payload = json.readValue(bodies.getFirst(), Map.class);
        assertThat(payload.get("user_ids")).isEqualTo(List.of("protected-id"));
        assertThat(payload.get("delete_from_org")).isEqualTo(false);
        assertThat(auth.getFirst()).startsWith("Basic ");
        assertThat(gateway.amplitudeDone(reference, requestedAt)).isFalse();
        response =
                "[{\"status\":\"done\",\"amplitude_ids\":[{\"amplitude_id\":123,\"requested_on_day\":\"2026-11-08\"}]}]";
        assertThat(gateway.amplitudeDone(reference, requestedAt)).isFalse();
        response =
                "[{\"status\":\"done\",\"amplitude_ids\":[{\"amplitude_id\":123,\"requested_on_day\":\"2026-11-08\"},{\"amplitude_id\":456,\"requested_on_day\":\"2026-11-08\"}]}]";
        assertThat(gateway.amplitudeDone(reference, requestedAt)).isTrue();
        assertThat(paths.getLast()).contains("start_day=2026-11-07");
        response = response.replace("2026-11-08", "2026-10-01");
        assertThat(gateway.amplitudeDone(reference, requestedAt)).isFalse();
    }

    @Test
    @DisplayName("대상 없음과 권한 실패를 삭제 완료로 오인하지 않는다")
    void failuresNotCompletion() {
        response = "{\"invalid_ids\":{\"user_ids\":[\"protected-id\"]}}";
        assertThatThrownBy(() -> gateway.submitAmplitude("protected-id"))
                .hasMessage("USER_NOT_FOUND");
        responseStatus = 403;
        response = "{}";
        assertThatThrownBy(() -> gateway.submitAmplitude("protected-id"))
                .isInstanceOf(org.springframework.web.client.HttpClientErrorException.class);
    }

    @Test
    @DisplayName("서비스 계정 JWT를 서명하고 OAuth 토큰을 재사용한다")
    void serviceAccountToken() throws Exception {
        var generator = KeyPairGenerator.getInstance("RSA");
        generator.initialize(2048);
        var pair = generator.generateKeyPair();
        String pem =
                "-----BEGIN PRIVATE KEY-----\n"
                        + Base64.getEncoder().encodeToString(pair.getPrivate().getEncoded())
                        + "\n-----END PRIVATE KEY-----";
        response = "{\"access_token\":\"test-token\",\"expires_in\":3600}";
        var token =
                new GoogleAnalyticsAccessToken("analytics-test@example.test", pem, base + "/token");
        assertThat(token.get()).isEqualTo("test-token");
        assertThat(token.get()).isEqualTo("test-token");
        assertThat(bodies).hasSize(1);
        String assertion =
                Arrays.stream(bodies.getFirst().split("&"))
                        .filter(v -> v.startsWith("assertion="))
                        .map(v -> URLDecoder.decode(v.substring(10), StandardCharsets.UTF_8))
                        .findFirst()
                        .orElseThrow();
        var claims =
                Jwts.parser()
                        .verifyWith((RSAPublicKey) pair.getPublic())
                        .build()
                        .parseSignedClaims(assertion)
                        .getPayload();
        assertThat(claims.getIssuer()).isEqualTo("analytics-test@example.test");
        assertThat(claims.get("scope")).isEqualTo("https://www.googleapis.com/auth/analytics.edit");
        assertThat(claims.getAudience()).contains(base + "/token");
    }
}
