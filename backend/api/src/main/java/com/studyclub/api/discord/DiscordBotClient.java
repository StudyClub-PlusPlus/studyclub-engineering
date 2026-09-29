package com.studyclub.api.discord;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import java.time.Duration;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

/**
 * 백엔드 → 디스코드 봇(FastAPI) 호출. 계약은 docs/discord-development-guide/api/create-study.md.
 *
 * <p>API 키는 봇 → 백엔드 방향과 같은 {@code discord.api-key} 다 (봇 계약이 양방향 같은 값으로 정했다). 주소·키 둘 중 하나라도 비어 있으면
 * {@link #isConfigured()} 가 false 이고, 호출하지 않는다.
 */
@Component
public class DiscordBotClient {

    private static final Logger log = LoggerFactory.getLogger(DiscordBotClient.class);
    private static final Pattern SNOWFLAKE = Pattern.compile(DiscordAttendanceRequest.SNOWFLAKE);

    private final String botUrl;
    private final String apiKey;
    private final RestClient restClient;

    public DiscordBotClient(
            @Value("${discord.bot-url:}") String botUrl,
            @Value("${discord.api-key:}") String apiKey) {
        this.botUrl = botUrl;
        this.apiKey = apiKey;
        // 봇은 429 를 내부에서 기다리므로 느려질 뿐 실패하지 않는다 — 읽기 타임아웃을 넉넉히 잡는다
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(3));
        factory.setReadTimeout(Duration.ofSeconds(30));
        this.restClient = RestClient.builder().requestFactory(factory).build();
    }

    public boolean isConfigured() {
        return StringUtils.hasText(botUrl) && StringUtils.hasText(apiKey);
    }

    /**
     * 카테고리·채널·역할을 만든다. 재시도하지 않는다 — 봇은 같은 이름의 두 번째 요청에 409 를 주므로 재시도로는 ID 를 받을 수 없다.
     *
     * @param discordUserId captain 역할을 가진 길드 멤버. 봇이 이 사람으로 권한을 본다
     */
    public CreatedStudy createStudy(String studyName, String discordUserId) {
        if (!isConfigured()) {
            throw new BusinessException(
                    ErrorCode.EXTERNAL_SERVICE_ERROR,
                    "디스코드 봇이 설정되지 않았습니다 (DISCORD_BOT_URL/DISCORD_API_KEY).");
        }
        String idempotencyKey = UUID.randomUUID().toString();
        CreatedStudy created;
        try {
            created =
                    restClient
                            .post()
                            .uri(botUrl + "/api/v1/studies")
                            .contentType(MediaType.APPLICATION_JSON)
                            .header("X-API-Key", apiKey)
                            .header("X-Discord-User-ID", discordUserId)
                            .header("Idempotency-Key", idempotencyKey)
                            .body(Map.of("studyName", studyName))
                            .retrieve()
                            .body(CreatedStudy.class);
        } catch (HttpClientErrorException.Conflict e) {
            log.warn("create-study {}: 봇 409 {}", idempotencyKey, e.getResponseBodyAsString());
            throw new BusinessException(
                    ErrorCode.CONFLICT, "디스코드에 같은 이름의 스터디가 이미 있습니다. studyName 을 바꿔 다시 요청하세요.");
        } catch (RestClientResponseException e) {
            // 봇 detail 에는 길드·역할 ID 같은 봇 내부 사정이 들어 있다. 응답에는 싣지 않고 로그에만 남긴다
            log.warn(
                    "create-study {}: 봇 {} {}",
                    idempotencyKey,
                    e.getStatusCode().value(),
                    e.getResponseBodyAsString());
            throw new BusinessException(
                    ErrorCode.EXTERNAL_SERVICE_ERROR,
                    "디스코드 봇이 스터디 생성을 거절했습니다 (" + e.getStatusCode().value() + ").");
        } catch (RestClientException e) {
            log.warn("create-study {}: 봇 호출 실패 {}", idempotencyKey, e.getMessage());
            throw new BusinessException(ErrorCode.EXTERNAL_SERVICE_ERROR, "디스코드 봇과 통신하지 못했습니다.");
        }

        if (created == null
                || !isSnowflake(created.discordStudyId())
                || !isSnowflake(created.discordRoleId())) {
            log.error("create-study {}: 봇 응답의 ID 가 snowflake 가 아니다 {}", idempotencyKey, created);
            throw new BusinessException(ErrorCode.EXTERNAL_SERVICE_ERROR, "디스코드 봇 응답이 올바르지 않습니다.");
        }
        return created;
    }

    private static boolean isSnowflake(String value) {
        return value != null && SNOWFLAKE.matcher(value).matches();
    }

    public record CreatedStudy(String discordStudyId, String discordRoleId) {}
}
