package com.studyclub.api.analytics;

import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;

/**
 * Amplitude HTTP V2 전송기 — 서버가 확정한 사실(가입·활성화)을 보낸다. 계약은 specs/analytics/spec.md.
 *
 * <p>전송만 맡는다. 언제 보낼지는 {@link AnalyticsEventListener} 가 도메인 이벤트를 구독해 정한다. 리스너가 이미 커밋 뒤·별도 스레드에서 부르므로
 * 여기서는 동기로 보낸다.
 *
 * <ul>
 *   <li>{@code AMPLITUDE_API_KEY} 가 비어 있으면 아무것도 하지 않는다
 *   <li>{@code insertId} 는 필수 — 같은 사실을 다시 보내도 Amplitude 가 중복을 지운다(결정적 값만)
 *   <li>user_id 는 프론트와 같은 회원 번호 문자열. 5자 미만이면 400 이라 {@code min_id_length=1} 을 함께 보낸다
 *   <li>던지지 않는다 — 3초 타임아웃, 실패는 warn 로그만
 * </ul>
 */
@Component
public class AmplitudeClient {

    private static final Logger log = LoggerFactory.getLogger(AmplitudeClient.class);
    static final String DEFAULT_ENDPOINT = "https://api2.amplitude.com/2/httpapi";
    static final String SERVICE = "studyclub";
    static final String EVENT_VERSION = "1.0.0";

    private final String apiKey;
    private final String env;
    private final String endpoint;
    private final RestClient restClient;

    public AmplitudeClient(
            @Value("${amplitude.api-key:}") String apiKey,
            @Value("${ops.env:local}") String env,
            @Value("${amplitude.endpoint:" + DEFAULT_ENDPOINT + "}") String endpoint) {
        this.apiKey = apiKey;
        this.env = env;
        this.endpoint = endpoint;
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(3));
        factory.setReadTimeout(Duration.ofSeconds(3));
        this.restClient = RestClient.builder().requestFactory(factory).build();
    }

    public boolean enabled() {
        return StringUtils.hasText(apiKey);
    }

    /** {@code at} = 사실이 생긴 시각(도메인 이벤트의 occurredAt). */
    public void send(
            String eventType,
            Long accountId,
            String insertId,
            Instant at,
            Map<String, Object> properties) {
        if (!enabled()) {
            return;
        }
        try {
            restClient
                    .post()
                    .uri(endpoint)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(payload(eventType, accountId, insertId, properties, at))
                    .retrieve()
                    .toBodilessEntity();
        } catch (RuntimeException e) {
            // 응답 본문·요청에 키가 실릴 수 있어 예외 종류만 남긴다
            log.warn("amplitude: {} 전송 실패 ({})", eventType, e.getClass().getSimpleName());
        }
    }

    Map<String, Object> payload(
            String eventType,
            Long accountId,
            String insertId,
            Map<String, Object> properties,
            Instant at) {
        Map<String, Object> props = new LinkedHashMap<>();
        props.put("service", SERVICE);
        props.put("env", env);
        props.put("event_version", EVENT_VERSION);
        if (properties != null) {
            props.putAll(properties);
        }
        Map<String, Object> event = new LinkedHashMap<>();
        event.put("user_id", String.valueOf(accountId));
        event.put("event_type", eventType);
        event.put("insert_id", insertId);
        event.put("time", at.toEpochMilli());
        event.put("platform", "server");
        event.put("event_properties", props);
        return Map.of(
                "api_key", apiKey,
                "events", List.of(event),
                "options", Map.of("min_id_length", 1));
    }
}
