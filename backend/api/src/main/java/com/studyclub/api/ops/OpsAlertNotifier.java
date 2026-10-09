package com.studyclub.api.ops;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;

/**
 * 운영자 알림 — 디스코드 웹훅에 임베드 한 장을 보낸다. 계약은 specs/ops-alerts/spec.md.
 *
 * <ul>
 *   <li>{@code OPS_DISCORD_WEBHOOK_URL} 이 비어 있으면 아무것도 하지 않는다
 *   <li>요청을 막지도, 실패를 던지지도 않는다 — 백그라운드 전송(3초 타임아웃), 실패는 warn 로그만
 *   <li>트랜잭션 안에서 부르면 커밋 뒤에 보낸다 (롤백된 가입·신청을 알리지 않게)
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

    private final String webhookUrl;
    private final String prefix;
    private final Executor executor;
    private final RestClient restClient;

    @Autowired
    public OpsAlertNotifier(
            @Value("${ops.discord-webhook-url:}") String webhookUrl,
            @Value("${ops.env:local}") String env) {
        this(webhookUrl, env, null);
    }

    /** {@code executor} 가 null 이면 공용 풀. 테스트는 동기 실행기를 넘긴다. */
    OpsAlertNotifier(String webhookUrl, String env, Executor executor) {
        this.webhookUrl = webhookUrl;
        this.prefix = prefixOf(env);
        this.executor = executor;
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

    /** {@code fields} 는 이름 → 값, 순서대로. 값이 비면 "-" 로 보낸다. */
    public void send(Level level, String title, Map<String, String> fields) {
        if (!StringUtils.hasText(webhookUrl)) {
            return;
        }
        Map<String, Object> payload;
        try {
            payload = payload(level, title, fields);
        } catch (RuntimeException e) {
            log.warn("ops-alert: 페이로드를 만들지 못했다 ({})", e.getClass().getSimpleName());
            return;
        }
        Runnable task = () -> post(payload);
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(
                    new TransactionSynchronization() {
                        @Override
                        public void afterCommit() {
                            dispatch(task);
                        }
                    });
        } else {
            dispatch(task);
        }
    }

    private void dispatch(Runnable task) {
        try {
            if (executor == null) {
                CompletableFuture.runAsync(task);
            } else {
                executor.execute(task);
            }
        } catch (RuntimeException e) {
            log.warn("ops-alert: 전송을 예약하지 못했다 ({})", e.getClass().getSimpleName());
        }
    }

    private void post(Map<String, Object> payload) {
        try {
            restClient
                    .post()
                    .uri(webhookUrl)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(payload)
                    .retrieve()
                    .toBodilessEntity();
        } catch (RuntimeException e) {
            // 메시지에 웹훅 URL(=토큰)이 실릴 수 있어 예외 종류만 남긴다
            log.warn("ops-alert: 전송 실패 ({})", e.getClass().getSimpleName());
        }
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
