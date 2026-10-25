package com.studyclub.api.analytics;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** 실제 Amplitude 로는 보내지 않는다 — 로컬 HTTP 서버가 엔드포인트 자리를 대신한다. */
class AmplitudeClientTest {

    @Test
    @DisplayName("회원 번호를 user_id 로, 결정적 insert_id 와 공통 속성을 붙여 보낸다")
    void 이벤트_한_건을_보낸다() throws Exception {
        List<String> bodies = new ArrayList<>();
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext(
                "/2/httpapi",
                exchange -> {
                    bodies.add(
                            new String(
                                    exchange.getRequestBody().readAllBytes(),
                                    StandardCharsets.UTF_8));
                    exchange.sendResponseHeaders(200, -1);
                    exchange.close();
                });
        server.start();
        try {
            String url = "http://127.0.0.1:" + server.getAddress().getPort() + "/2/httpapi";
            AmplitudeClient client = new AmplitudeClient("test-key", "stage", url);

            client.send(
                    "User Signed Up",
                    42L,
                    "user_signed_up_account_42",
                    Instant.ofEpochMilli(1000),
                    Map.of("method", "google"));

            assertThat(bodies).hasSize(1);
            String body = bodies.get(0);
            assertThat(body).contains("\"user_id\":\"42\"");
            assertThat(body).contains("\"event_type\":\"User Signed Up\"");
            assertThat(body).contains("\"insert_id\":\"user_signed_up_account_42\"");
            assertThat(body).contains("\"time\":1000");
            assertThat(body).contains("\"service\":\"studyclub\"").contains("\"env\":\"stage\"");
            assertThat(body).contains("\"min_id_length\":1");
        } finally {
            server.stop(0);
        }
    }

    @Test
    @DisplayName("키가 없으면 보내지 않고, 엔드포인트가 죽어 있어도 던지지 않는다")
    void 키가_없거나_실패해도_던지지_않는다() {
        AmplitudeClient off = new AmplitudeClient("", "production", "http://127.0.0.1:1/x");
        assertThat(off.enabled()).isFalse();
        assertThatCode(
                        () -> {
                            off.send(
                                    "Activated",
                                    1L,
                                    "activated_account_1",
                                    Instant.now(),
                                    Map.of());
                            new AmplitudeClient("k", "production", "http://127.0.0.1:1/x")
                                    .send(
                                            "Activated",
                                            1L,
                                            "activated_account_1",
                                            Instant.now(),
                                            Map.of());
                        })
                .doesNotThrowAnyException();
    }
}
