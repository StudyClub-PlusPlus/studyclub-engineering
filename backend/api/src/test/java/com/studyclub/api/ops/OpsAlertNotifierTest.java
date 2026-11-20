package com.studyclub.api.ops;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/**
 * 실제 디스코드로는 보내지 않는다 — 로컬 HTTP 서버가 웹훅 자리를 대신한다. 경로(/info · /warn · /team · /legacy)로 어느 목적지에 갔는지 센다.
 * 등급별 라우팅 계약은 specs/ops-alerts/spec.md §등급과 목적지.
 */
class OpsAlertNotifierTest {

    /** KST 12:00 — 조용시간 밖 */
    private static final Clock DAY =
            Clock.fixed(Instant.parse("2026-11-20T03:00:00Z"), ZoneOffset.UTC);

    /** KST 00:00 — 조용시간(23–10) 안 */
    private static final Clock NIGHT =
            Clock.fixed(Instant.parse("2026-11-20T15:00:00Z"), ZoneOffset.UTC);

    private static final String DEAD = "http://127.0.0.1:9/dead";

    private HttpServer server;
    private final List<String> hits = Collections.synchronizedList(new ArrayList<>());
    private final List<String> bodies = Collections.synchronizedList(new ArrayList<>());

    @BeforeEach
    void start() throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext(
                "/",
                exchange -> {
                    hits.add(exchange.getRequestURI().getPath());
                    bodies.add(
                            new String(
                                    exchange.getRequestBody().readAllBytes(),
                                    StandardCharsets.UTF_8));
                    exchange.sendResponseHeaders(204, -1);
                    exchange.close();
                });
        server.start();
    }

    @AfterEach
    void stop() {
        server.stop(0);
    }

    private String url(String path) {
        return "http://127.0.0.1:" + server.getAddress().getPort() + path;
    }

    private OpsAlertNotifier notifier(String team, String legacy, String env, Clock clock) {
        return new OpsAlertNotifier(url("/info"), url("/warn"), team, legacy, env, clock);
    }

    @Test
    void info_는_INFO_와_팀_두_곳에_간다() {
        notifier(url("/team"), "", "production", DAY)
                .send(OpsAlertNotifier.Level.INFO, "신규 가입", Map.of("닉네임", "길동"));
        assertThat(hits).containsExactlyInAnyOrder("/info", "/team");
    }

    @Test
    void warn_과_error_는_WARN_한_곳에만_간다() {
        OpsAlertNotifier n = notifier(url("/team"), url("/legacy"), "production", DAY);
        n.send(OpsAlertNotifier.Level.WARN, "재시도 소진", Map.of());
        n.send(OpsAlertNotifier.Level.ERROR, "배치 실패", Map.of());
        assertThat(hits).containsExactly("/warn", "/warn");
    }

    @Test
    void 팀_env_가_없으면_팀으로_안_간다_stage() {
        notifier("", "", "stage", DAY).send(OpsAlertNotifier.Level.INFO, "신규 가입", Map.of());
        assertThat(hits).containsExactly("/info");
        assertThat(bodies.get(0)).contains("\"title\":\"[Stage] [StudyClub] 신규 가입\"");
    }

    @Test
    void 팀_env_가_없으면_옛_env_를_팀으로_읽는다() {
        notifier("", url("/legacy"), "production", DAY)
                .send(OpsAlertNotifier.Level.INFO, "신규 가입", Map.of());
        assertThat(hits).containsExactlyInAnyOrder("/info", "/legacy");
    }

    @Test
    void 팀_env_가_있으면_옛_env_는_안_읽는다() {
        notifier(url("/team"), url("/legacy"), "production", DAY)
                .send(OpsAlertNotifier.Level.INFO, "신규 가입", Map.of());
        assertThat(hits).containsExactlyInAnyOrder("/info", "/team");
    }

    @Test
    void 조용시간에는_팀_채널만_버린다() {
        notifier(url("/team"), "", "production", NIGHT)
                .send(OpsAlertNotifier.Level.INFO, "신규 가입", Map.of());
        assertThat(hits).containsExactly("/info");
    }

    @Test
    void env_가_전부_비면_아무것도_안_보낸다() {
        OpsAlertNotifier n = new OpsAlertNotifier("", "", "", "", "production", DAY);
        n.send(OpsAlertNotifier.Level.INFO, "t", Map.of());
        n.send(OpsAlertNotifier.Level.ERROR, "t", Map.of());
        assertThat(hits).isEmpty();
    }

    @Test
    void 한_목적지가_죽어도_다른_목적지는_보내고_던지지_않는다() {
        OpsAlertNotifier n =
                new OpsAlertNotifier(DEAD, url("/warn"), url("/team"), "", "beta", DAY);
        assertThatCode(() -> n.send(OpsAlertNotifier.Level.INFO, "신규 가입", Map.of("a", "b")))
                .doesNotThrowAnyException();
        assertThat(hits).containsExactly("/team");
    }

    @Test
    void 임베드_모양과_마스킹_footer_등급() {
        Map<String, String> fields = new LinkedHashMap<>();
        fields.put("닉네임", "길동");
        fields.put("이메일", OpsAlertNotifier.maskEmail("gildong@example.com"));
        fields.put("긴 값", "x".repeat(2000));
        notifier("", "", "stage", DAY).send(OpsAlertNotifier.Level.WARN, "결제 실패", fields);

        assertThat(bodies).hasSize(1);
        String body = bodies.get(0);
        assertThat(body).contains("\"title\":\"[Stage] [StudyClub] 결제 실패\"");
        assertThat(body).contains("\"color\":" + 0xE67E22);
        assertThat(body).contains("\"footer\":{\"text\":\"warn\"}");
        assertThat(body).contains("gi***@example.com").doesNotContain("gildong@");
        assertThat(body).contains("\"allowed_mentions\":{\"parse\":[]}");
        assertThat(body).doesNotContain("x".repeat(1001));
    }

    @Test
    void 환경_접두어() {
        assertThat(OpsAlertNotifier.prefixOf("production")).isEmpty();
        assertThat(OpsAlertNotifier.prefixOf("stage")).isEqualTo("[Stage] ");
        assertThat(OpsAlertNotifier.prefixOf("beta")).isEqualTo("[Beta] ");
        assertThat(OpsAlertNotifier.prefixOf(null)).isEqualTo("[Local] ");
    }
}
