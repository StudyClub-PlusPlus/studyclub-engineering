package com.studyclub.api.auth;

import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.server.ResponseStatusException;

/** 구글 OAuth code → access_token 교환 → userinfo 조회. */
@Component
public class GoogleOAuthClient {

    private static final String TOKEN_URL = "https://oauth2.googleapis.com/token";
    private static final String USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

    private final RestClient http = RestClient.create();

    @Value("${google.client-id:}")
    private String clientId;

    @Value("${google.client-secret:}")
    private String clientSecret;

    @Value("${google.redirect-uri:}")
    private String defaultRedirectUri;

    public GoogleUser exchange(String code, String redirectOverride) {
        if (!StringUtils.hasText(clientId) || !StringUtils.hasText(clientSecret)) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "구글 OAuth 클라이언트가 설정되지 않았습니다 (GOOGLE_CLIENT_ID/SECRET).");
        }
        String redirect = StringUtils.hasText(redirectOverride) ? redirectOverride : defaultRedirectUri;

        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("code", code);
        form.add("client_id", clientId);
        form.add("client_secret", clientSecret);
        form.add("redirect_uri", redirect);
        form.add("grant_type", "authorization_code");

        Map<?, ?> token;
        Map<?, ?> info;
        try {
            // 잘못/만료/재사용된 code → 구글이 4xx → 500 대신 401 로 매핑
            token = http.post()
                    .uri(TOKEN_URL)
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(form)
                    .retrieve()
                    .body(Map.class);

            if (token == null || token.get("access_token") == null) {
                throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "구글 토큰 교환에 실패했습니다.");
            }
            String accessToken = String.valueOf(token.get("access_token"));

            info = http.get()
                    .uri(USERINFO_URL)
                    .header("Authorization", "Bearer " + accessToken)
                    .retrieve()
                    .body(Map.class);
        } catch (RestClientException e) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "구글 인증에 실패했습니다 (code 무효/만료).");
        }

        if (info == null || info.get("email") == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "구글 계정 정보를 가져오지 못했습니다.");
        }
        return new GoogleUser(
                asString(info.get("sub")),
                asString(info.get("email")),
                asString(info.get("name")),
                asString(info.get("picture")));
    }

    private static String asString(Object o) {
        return o == null ? null : String.valueOf(o);
    }

    public record GoogleUser(String sub, String email, String name, String picture) {
    }
}
