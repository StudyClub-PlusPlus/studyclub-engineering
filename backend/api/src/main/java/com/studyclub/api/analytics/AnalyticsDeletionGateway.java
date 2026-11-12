package com.studyclub.api.analytics;

import java.time.*;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.ObjectMapper;

/** 외부 API만 담당한다. DB 트랜잭션 밖에서 호출한다. */
@Component
public class AnalyticsDeletionGateway {
    private final RestClient http = httpClient();
    private final ObjectMapper json = new ObjectMapper();
    private final GoogleAnalyticsAccessToken token;
    private final String propertyId,
            googleEndpoint,
            amplitudeKey,
            amplitudeSecret,
            amplitudeEndpoint;
    private long lastAmplitudeCall;

    public AnalyticsDeletionGateway(
            GoogleAnalyticsAccessToken token,
            @Value("${ga4.deletion.property-id:}") String propertyId,
            @Value("${ga4.deletion.endpoint:https://analyticsadmin.googleapis.com/v1alpha}")
                    String googleEndpoint,
            @Value("${amplitude.api-key:}") String amplitudeKey,
            @Value("${amplitude.deletion.secret:}") String amplitudeSecret,
            @Value("${amplitude.deletion.endpoint:https://amplitude.com/api/2/deletions/users}")
                    String amplitudeEndpoint) {
        this.token = token;
        this.propertyId = propertyId;
        this.googleEndpoint = googleEndpoint;
        this.amplitudeKey = amplitudeKey;
        this.amplitudeSecret = amplitudeSecret;
        this.amplitudeEndpoint = amplitudeEndpoint;
    }

    static RestClient httpClient() {
        var factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(5));
        factory.setReadTimeout(Duration.ofSeconds(10));
        return RestClient.builder().requestFactory(factory).build();
    }

    /** 일부 실패면 호출자가 미접수 상태를 유지한다. 다음 일일 실행에서 전체를 재요청할 수 있다. */
    public void submitGa4(String userId, List<String> clientIds) {
        if (!propertyId.matches("[0-9]+"))
            throw new IllegalStateException("DELETION_NOT_CONFIGURED");
        if (userId != null) submitGoogleIdentifier("userId", userId);
        for (String clientId : new LinkedHashSet<>(clientIds))
            submitGoogleIdentifier("clientId", clientId);
    }

    private void submitGoogleIdentifier(String field, String id) {
        Map<?, ?> response =
                http.post()
                        .uri(googleEndpoint + "/properties/" + propertyId + ":submitUserDeletion")
                        .headers(h -> h.setBearerAuth(token.get()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .body(Map.of(field, id))
                        .retrieve()
                        .body(Map.class);
        if (response == null || !(response.get("deletionRequestTime") instanceof String time))
            throw new IllegalStateException("INVALID_DELETION_RESPONSE");
        Instant.parse(time);
    }

    /** empty는 요청한 userId가 invalid_ids에 명시된 성공 응답에만 사용한다. */
    public Optional<String> submitAmplitude(String userId) {
        requireAmplitude();
        amplitudeSlot();
        Object response =
                http.post()
                        .uri(amplitudeEndpoint)
                        .headers(h -> h.setBasicAuth(amplitudeKey, amplitudeSecret))
                        .contentType(MediaType.APPLICATION_JSON)
                        .body(
                                Map.of(
                                        "user_ids",
                                        List.of(userId),
                                        "requester",
                                        "studyclub-privacy",
                                        "ignore_invalid_id",
                                        true,
                                        "delete_from_org",
                                        false))
                        .retrieve()
                        .body(Object.class);
        List<String> ids =
                rows(response).stream().flatMap(row -> ids(row).stream()).distinct().toList();
        if (!ids.isEmpty()) return Optional.of(json.writeValueAsString(ids));
        boolean absent =
                rows(response).stream()
                        .anyMatch(
                                row -> {
                                    Object invalid = row.get("invalid_ids");
                                    Object users =
                                            invalid instanceof Map<?, ?> map
                                                    ? map.get("user_ids")
                                                    : invalid;
                                    return users instanceof List<?> list && list.contains(userId);
                                });
        if (absent) return Optional.empty();
        throw new IllegalStateException("INVALID_DELETION_RESPONSE");
    }

    public boolean amplitudeDone(String reference, Instant requestedAt) {
        requireAmplitude();
        List<?> expected = json.readValue(reference, List.class);
        LocalDate day = requestedAt.atZone(ZoneOffset.UTC).toLocalDate();
        amplitudeSlot();
        Object response =
                http.get()
                        .uri(
                                amplitudeEndpoint + "?start_day={start}&end_day={end}",
                                day.minusDays(1),
                                day.plusDays(35))
                        .headers(h -> h.setBasicAuth(amplitudeKey, amplitudeSecret))
                        .retrieve()
                        .body(Object.class);
        Set<String> completed = new HashSet<>();
        for (Map<?, ?> row : rows(response)) {
            if (!"done".equalsIgnoreCase(String.valueOf(row.get("status")))) continue;
            if (!(row.get("amplitude_ids") instanceof List<?> items)) continue;
            for (Object item : items) {
                if (!(item instanceof Map<?, ?> entry)
                        || !(entry.get("requested_on_day") instanceof String date)) continue;
                LocalDate requestedDay = LocalDate.parse(date);
                // UTC 날짜 경계의 통신 시차를 허용하되 오래된 다른 요청을 완료 근거로 삼지 않는다.
                if (!requestedDay.isBefore(day.minusDays(1))
                        && !requestedDay.isAfter(day.plusDays(1)))
                    completed.add(String.valueOf(entry.get("amplitude_id")));
            }
        }
        return !expected.isEmpty()
                && expected.stream().allMatch(id -> completed.contains(String.valueOf(id)));
    }

    private void requireAmplitude() {
        if (amplitudeKey.isBlank() || amplitudeSecret.isBlank())
            throw new IllegalStateException("DELETION_NOT_CONFIGURED");
    }

    /** 프로젝트의 초당 1회 제한. 여러 인스턴스의 429는 미처리 상태로 남아 일일 작업에서 다시 처리된다. */
    private synchronized void amplitudeSlot() {
        long remaining = Duration.ofSeconds(1).toNanos() - (System.nanoTime() - lastAmplitudeCall);
        if (lastAmplitudeCall != 0 && remaining > 0) {
            try {
                Thread.sleep(Duration.ofNanos(remaining));
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new IllegalStateException("DELETION_INTERRUPTED");
            }
        }
        lastAmplitudeCall = System.nanoTime();
    }

    private static List<Map<?, ?>> rows(Object value) {
        List<?> list =
                value instanceof List<?> l
                        ? l
                        : value instanceof Map<?, ?> m ? List.of(m) : List.of();
        List<Map<?, ?>> result = new ArrayList<>();
        for (Object item : list) if (item instanceof Map<?, ?> row) result.add(row);
        return result;
    }

    private static List<String> ids(Map<?, ?> row) {
        Object value = row.get("amplitude_ids");
        if (value == null) return List.of();
        if (!(value instanceof List<?> list))
            throw new IllegalStateException("INVALID_DELETION_RESPONSE");
        List<String> result = new ArrayList<>();
        for (Object item : list) {
            Object id = item instanceof Map<?, ?> m ? m.get("amplitude_id") : item;
            if (id == null || !String.valueOf(id).matches("[0-9]+"))
                throw new IllegalStateException("INVALID_DELETION_RESPONSE");
            result.add(String.valueOf(id));
        }
        return result;
    }
}
