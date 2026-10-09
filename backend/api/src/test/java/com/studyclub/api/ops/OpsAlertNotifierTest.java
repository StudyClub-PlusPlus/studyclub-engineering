package com.studyclub.api.ops;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** 실제 디스코드로는 보내지 않는다 — 로컬 HTTP 서버가 웹훅 자리를 대신한다. */
class OpsAlertNotifierTest {

    @Test
    void 임베드_한_장을_보내고_이메일은_마스킹한다() throws Exception {
        List<String> bodies = new ArrayList<>();
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext(
                "/hook",
                exchange -> {
                    bodies.add(
                            new String(
                                    exchange.getRequestBody().readAllBytes(),
                                    StandardCharsets.UTF_8));
                    exchange.sendResponseHeaders(204, -1);
                    exchange.close();
                });
        server.start();
        try {
            String url = "http://127.0.0.1:" + server.getAddress().getPort() + "/hook";
            OpsAlertNotifier notifier = new OpsAlertNotifier(url, "stage", Runnable::run);

            Map<String, String> fields = new LinkedHashMap<>();
            fields.put("닉네임", "길동");
            fields.put("이메일", OpsAlertNotifier.maskEmail("gildong@example.com"));
            fields.put("긴 값", "x".repeat(2000));
            notifier.send(OpsAlertNotifier.Level.INFO, "신규 가입", fields);

            assertThat(bodies).hasSize(1);
            String body = bodies.get(0);
            assertThat(body).contains("\"title\":\"[Stage] [StudyClub] 신규 가입\"");
            assertThat(body).contains("\"color\":" + 0x2ECC71);
            assertThat(body).contains("gi***@example.com").doesNotContain("gildong@");
            assertThat(body).contains("\"allowed_mentions\":{\"parse\":[]}");
            assertThat(body).doesNotContain("x".repeat(1001));
        } finally {
            server.stop(0);
        }
    }

    @Test
    void 웹훅이_없거나_죽어_있어도_던지지_않는다() {
        assertThatCode(
                        () -> {
                            new OpsAlertNotifier("", "production", Runnable::run)
                                    .send(OpsAlertNotifier.Level.ERROR, "t", Map.of());
                            new OpsAlertNotifier("http://127.0.0.1:9/hook", "beta", Runnable::run)
                                    .send(OpsAlertNotifier.Level.WARN, "t", Map.of("a", "b"));
                        })
                .doesNotThrowAnyException();
    }

    @Test
    void 환경_접두어() {
        assertThat(OpsAlertNotifier.prefixOf("production")).isEmpty();
        assertThat(OpsAlertNotifier.prefixOf("stage")).isEqualTo("[Stage] ");
        assertThat(OpsAlertNotifier.prefixOf("beta")).isEqualTo("[Beta] ");
        assertThat(OpsAlertNotifier.prefixOf(null)).isEqualTo("[Local] ");
    }
}
