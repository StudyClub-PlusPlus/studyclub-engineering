package com.studyclub.api.analytics;

import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;

/**
 * GA4 Measurement Protocol 전송기 — 서버가 확정한 가입·활성화를 GA4 키 이벤트로도 보낸다. 계약은 specs/analytics/spec.md.
 *
 * <ul>
 *   <li>{@code GA4_MEASUREMENT_ID} · {@code GA4_API_SECRET} 중 하나라도 비면 아무것도 하지 않는다
 *   <li>client_id = 브라우저 {@code _ga} 쿠키 값(프론트가 실어 보낸 것). 없거나 모양이 틀리면 {@code srv.<회원 번호>} — 이 경우 유입
 *       귀속이 안 된다
 *   <li>던지지 않는다 — 3초 타임아웃, 실패는 warn 로그만. PII 는 params 에 넣지 않는다
 * </ul>
 */
@Component
public class Ga4Client {

    private static final Logger log = LoggerFactory.getLogger(Ga4Client.class);
    static final String DEFAULT_ENDPOINT = "https://www.google-analytics.com/mp/collect";
    private static final Pattern CLIENT_ID = Pattern.compile("^\\d{1,20}\\.\\d{1,20}$");

    private final String measurementId;
    private final String apiSecret;
    private final String endpoint;
    private final RestClient restClient;

    public Ga4Client(
            @Value("${ga4.measurement-id:}") String measurementId,
            @Value("${ga4.api-secret:}") String apiSecret,
            @Value("${ga4.endpoint:" + DEFAULT_ENDPOINT + "}") String endpoint) {
        this.measurementId = measurementId;
        this.apiSecret = apiSecret;
        this.endpoint = endpoint;
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(3));
        factory.setReadTimeout(Duration.ofSeconds(3));
        this.restClient = RestClient.builder().requestFactory(factory).build();
    }

    public boolean enabled() {
        return StringUtils.hasText(measurementId) && StringUtils.hasText(apiSecret);
    }

    /** {@code gaClientId} 는 null 이어도 된다 — 그때는 합성 client_id. */
    public void send(String name, Long accountId, String gaClientId, Map<String, Object> params) {
        if (!enabled()) {
            return;
        }
        try {
            restClient
                    .post()
                    .uri(endpoint + "?measurement_id={m}&api_secret={s}", measurementId, apiSecret)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(payload(name, accountId, gaClientId, params))
                    .retrieve()
                    .toBodilessEntity();
        } catch (RuntimeException e) {
            // URL 에 api_secret 이 실리므로 예외 메시지는 남기지 않는다
            log.warn("ga4: {} 전송 실패 ({})", name, e.getClass().getSimpleName());
        }
    }

    static Map<String, Object> payload(
            String name, Long accountId, String gaClientId, Map<String, Object> params) {
        Map<String, Object> p = new LinkedHashMap<>();
        if (params != null) {
            p.putAll(params);
        }
        p.put("engagement_time_msec", 1);
        String clientId =
                gaClientId != null && CLIENT_ID.matcher(gaClientId).matches()
                        ? gaClientId
                        : "srv." + accountId;
        return Map.of(
                "client_id", clientId,
                "user_id", String.valueOf(accountId),
                "events", List.of(Map.of("name", name, "params", p)));
    }
}
