package com.studyclub.api.auth;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import java.time.Duration;
import java.util.Map;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.util.StringUtils;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

/**
 * 디스코드 OAuth code → access_token 교환 → 사용자 조회 → 길드 멤버 확인 (specs/study-application 「디스코드 계정 연동」).
 * {@link GoogleOAuthClient} 와 같은 모양이다. scope 는 {@code identify guilds.members.read}.
 *
 * <p>code·토큰·디스코드 ID 는 로그에 남기지 않는다. 디스코드가 거절하거나 닿지 않으면 {@link ErrorCode#EXTERNAL_SERVICE_ERROR}, 길드
 * 멤버가 아니면 {@link ErrorCode#FORBIDDEN}.
 */
@Component
public class DiscordOAuthClient {

    private static final Logger log = LoggerFactory.getLogger(DiscordOAuthClient.class);
    private static final Pattern SNOWFLAKE = Pattern.compile("^[0-9]{17,20}$");

    private final String apiUrl;
    private final String clientId;
    private final String clientSecret;
    private final String redirectUri;
    private final String guildId;
    private final RestClient restClient;

    public DiscordOAuthClient(
            @Value("${discord.oauth.api-url:https://discord.com/api}") String apiUrl,
            @Value("${discord.oauth.client-id:}") String clientId,
            @Value("${discord.oauth.client-secret:}") String clientSecret,
            @Value("${discord.oauth.redirect-uri:}") String redirectUri,
            @Value("${discord.guild-id:}") String guildId) {
        this.apiUrl = apiUrl;
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.redirectUri = redirectUri;
        this.guildId = guildId;
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(3));
        factory.setReadTimeout(Duration.ofSeconds(10));
        this.restClient = RestClient.builder().requestFactory(factory).build();
    }

    public DiscordUser exchange(String code) {
        if (!StringUtils.hasText(clientId)
                || !StringUtils.hasText(clientSecret)
                || !StringUtils.hasText(redirectUri)
                || !StringUtils.hasText(guildId)) {
            throw new BusinessException(
                    ErrorCode.EXTERNAL_SERVICE_ERROR,
                    "디스코드 OAuth 가 설정되지 않았습니다 (DISCORD_OAUTH_CLIENT_ID/SECRET/REDIRECT_URI, DISCORD_GUILD_ID).");
        }

        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("grant_type", "authorization_code");
        form.add("code", code);
        form.add("redirect_uri", redirectUri);
        form.add("client_id", clientId);
        form.add("client_secret", clientSecret);

        String step = "token";
        try {
            Map<?, ?> token =
                    restClient
                            .post()
                            .uri(apiUrl + "/oauth2/token")
                            .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                            .body(form)
                            .retrieve()
                            .body(Map.class);
            if (token == null || token.get("access_token") == null) {
                throw failed("토큰 교환");
            }
            String bearer = "Bearer " + token.get("access_token");

            step = "users/@me";
            Map<?, ?> user =
                    restClient
                            .get()
                            .uri(apiUrl + "/users/@me")
                            .header("Authorization", bearer)
                            .retrieve()
                            .body(Map.class);
            String id = user == null ? null : asString(user.get("id"));
            String handle = user == null ? null : asString(user.get("username"));
            if (id == null || !SNOWFLAKE.matcher(id).matches() || !StringUtils.hasText(handle)) {
                throw failed("사용자 조회");
            }

            step = "guild-member";
            try {
                restClient
                        .get()
                        .uri(apiUrl + "/users/@me/guilds/{guildId}/member", guildId)
                        .header("Authorization", bearer)
                        .retrieve()
                        .toBodilessEntity();
            } catch (HttpClientErrorException.NotFound e) {
                // 길드에 없는 사용자에게 디스코드는 404(Unknown Guild)를 준다
                throw new BusinessException(ErrorCode.FORBIDDEN, "스터디클럽 디스코드 서버에 먼저 들어와 주세요.");
            }
            return new DiscordUser(id, handle);
        } catch (RestClientResponseException e) {
            // 응답 바디에는 code 가 되울려 올 수 있어 싣지 않는다
            log.warn("discord oauth {}: {}", step, e.getStatusCode().value());
            throw failed("인증");
        } catch (RestClientException e) {
            log.warn("discord oauth {}: 호출 실패 ({})", step, e.getClass().getSimpleName());
            throw failed("통신");
        }
    }

    private static BusinessException failed(String what) {
        return new BusinessException(
                ErrorCode.EXTERNAL_SERVICE_ERROR, "디스코드 " + what + "에 실패했습니다.");
    }

    private static String asString(Object o) {
        return o == null ? null : String.valueOf(o);
    }

    /**
     * @param handle 디스코드 사용자명({@code username}). 표시 이름이 아니라 계정마다 하나인 값
     */
    public record DiscordUser(String id, String handle) {}
}
