package com.studyclub.api.ops;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;

/**
 * 운영자 알림 — 등급(info·warn·error)별로 디스코드 웹훅에 임베드 한 장을 보낸다. 계약은 specs/ops-alerts/spec.md.
 *
 * <p>전송(transport)만 맡는다. 언제 보낼지는 {@link OpsAlertListener} 가 도메인 이벤트를 구독해 정한다 — 서비스에서 직접 부르지 않는다.
 * 리스너가 이미 커밋 뒤·별도 스레드에서 부르므로 여기서는 동기로 보낸다.
 *
 * <ul>
 *   <li>목적지는 {@link #ROUTES} 한 곳 — info → INFO + TEAM, warn·error → WARN. env 가 빈 목적지는 건너뛴다
 *   <li>TEAM 은 {@code OPS_TEAM_WEBHOOK_URL}, 없으면 옛 {@code OPS_DISCORD_WEBHOOK_URL}. stage 는 배포 env
 *       에 둘 다 없다(코드에 환경 분기 없음)
 *   <li>팀 채널은 조용시간(KST 23–10)에 버린다 — ops 큐가 없다. 운영자 모음 채널 둘은 언제든
 *   <li>던지지 않는다 — 목적지마다 따로 보내고 3초 타임아웃, 실패는 warn 로그만. 한 곳 실패가 다른 곳을 막지 않는다
 *   <li>환경 접두어는 {@code APP_ENV} 로 붙인다 — production 은 없음, 그 밖은 [Stage]·[Beta]·[Local]
 * </ul>
 */
@Component
public class OpsAlertNotifier {

    private static final Logger log = LoggerFactory.getLogger(OpsAlertNotifier.class);
    private static final int MAX_FIELDS = 10;
    private static final int MAX_VALUE = 1000;

    public enum Level {
        INFO(0x2ECC71),
        WARN(0xE67E22),
        ERROR(0xE74C3C);

        final int color;

        Level(int color) {
            this.color = color;
        }
    }

    enum Dest {
        INFO,
        WARN,
        TEAM
    }

    /** 등급 → 목적지. 라우팅 표는 여기 한 곳에만 둔다. */
    static final Map<Level, List<Dest>> ROUTES =
            Map.of(
                    Level.INFO, List.of(Dest.INFO, Dest.TEAM),
                    Level.WARN, List.of(Dest.WARN),
                    Level.ERROR, List.of(Dest.WARN));

    private final Map<Dest, String> urls;
    private final String prefix;
    private final Clock clock;
    private final RestClient restClient;

    @Autowired
    public OpsAlertNotifier(
            @Value("${ops.info-webhook-url:}") String infoUrl,
            @Value("${ops.warn-webhook-url:}") String warnUrl,
            @Value("${ops.team-webhook-url:}") String teamUrl,
            @Value("${ops.discord-webhook-url:}") String legacyUrl,
            @Value("${ops.env:local}") String env) {
        this(infoUrl, warnUrl, teamUrl, legacyUrl, env, Clock.systemUTC());
    }

    OpsAlertNotifier(
            String infoUrl,
            String warnUrl,
            String teamUrl,
            String legacyUrl,
            String env,
            Clock clock) {
        this.urls =
                Map.of(
                        Dest.INFO, nz(infoUrl),
                        Dest.WARN, nz(warnUrl),
                        Dest.TEAM, StringUtils.hasText(teamUrl) ? teamUrl : nz(legacyUrl));
        this.prefix = prefixOf(env);
        this.clock = clock;
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(3));
        factory.setReadTimeout(Duration.ofSeconds(3));
        this.restClient = RestClient.builder().requestFactory(factory).build();
    }

    static String prefixOf(String env) {
        String e = env == null ? "" : env.trim().toLowerCase();
        return switch (e) {
            case "production", "prod" -> "";
            case "stage", "staging", "develop", "dev" -> "[Stage] ";
            case "beta" -> "[Beta] ";
            default -> "[Local] ";
        };
    }

    private static String nz(String s) {
        return s == null ? "" : s;
    }

    /** {@code fields} 는 이름 → 값, 순서대로. 값이 비면 "-" 로 보낸다. */
    public void send(Level level, String title, Map<String, String> fields) {
        Map<String, Object> body = null;
        for (Dest dest : ROUTES.get(level)) {
            String url = urls.get(dest);
            if (!StringUtils.hasText(url) || (dest == Dest.TEAM && isQuietKst())) {
                continue;
            }
            if (body == null) {
                body = payload(level, title, fields);
            }
            post(dest, url, body);
        }
    }

    private void post(Dest dest, String url, Map<String, Object> body) {
        try {
            restClient
                    .post()
                    .uri(url)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .toBodilessEntity();
        } catch (RuntimeException e) {
            // 메시지에 웹훅 URL(=토큰)이 실릴 수 있어 예외 종류만 남긴다
            log.warn("ops-alert: {} 전송 실패 ({})", dest, e.getClass().getSimpleName());
        }
    }

    /** KST 23:00–10:00. 팀 채널(사람 폰이 울리는 곳)만 이 시간에 버린다. */
    private boolean isQuietKst() {
        int h = clock.instant().atOffset(ZoneOffset.ofHours(9)).getHour();
        return h >= 23 || h < 10;
    }

    Map<String, Object> payload(Level level, String title, Map<String, String> fields) {
        List<Map<String, Object>> embedFields = new ArrayList<>();
        if (fields != null) {
            for (Map.Entry<String, String> f : fields.entrySet()) {
                if (embedFields.size() >= MAX_FIELDS) {
                    break;
                }
                String value = StringUtils.hasText(f.getValue()) ? f.getValue() : "-";
                if (value.length() > MAX_VALUE) {
                    value = value.substring(0, MAX_VALUE - 1) + "…";
                }
                embedFields.add(Map.of("name", f.getKey(), "value", value, "inline", false));
            }
        }
        Map<String, Object> embed = new LinkedHashMap<>();
        embed.put("title", prefix + "[StudyClub] " + title);
        embed.put("color", level.color);
        embed.put("fields", embedFields);
        embed.put("footer", Map.of("text", level.name().toLowerCase()));
        embed.put("timestamp", Instant.now().toString());
        return Map.of("embeds", List.of(embed), "allowed_mentions", Map.of("parse", List.of()));
    }

    /** {@code abcdef@x.com} → {@code ab***@x.com}. 이메일 원문은 알림에 싣지 않는다. */
    public static String maskEmail(String email) {
        if (email == null || email.isBlank()) {
            return "-";
        }
        int at = email.indexOf('@');
        if (at < 0) {
            return "***";
        }
        String local = email.substring(0, at);
        return local.substring(0, Math.min(2, local.length())) + "***" + email.substring(at);
    }
}
