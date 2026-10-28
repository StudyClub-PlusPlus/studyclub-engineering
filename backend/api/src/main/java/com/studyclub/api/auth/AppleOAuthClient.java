package com.studyclub.api.auth;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.account.Issuer;
import io.jsonwebtoken.Jwts;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.KeyFactory;
import java.security.PrivateKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;

/**
 * 애플 로그인 (specs/auth-apple-login). 앱이 받은 authorization code 를 애플 토큰 엔드포인트에서 교환하고, 응답의 id_token 에서
 * 사람을 읽는다. id_token 은 우리 서버가 TLS 로 애플에게서 직접 받은 것이라 서명 검증 대신 {@code iss}·{@code aud} 만 확인한다 (OIDC
 * Core 3.1.3.7). {@link GoogleOAuthClient}·{@link DiscordOAuthClient} 와 같은 모양이다.
 *
 * <p>client secret 은 고정 문자열이 아니라 .p8 키로 서명한 짧은 JWT 다. 요청마다 새로 만든다. code·토큰은 로그에 남기지 않는다.
 */
@Component
public class AppleOAuthClient {

    private static final Logger log = LoggerFactory.getLogger(AppleOAuthClient.class);
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final String AUDIENCE = "https://appleid.apple.com";

    private final String apiUrl;
    private final String teamId;
    private final String keyId;
    private final String clientId;
    private final String privateKey;
    private final RestClient restClient;

    public AppleOAuthClient(
            @Value("${apple.api-url:https://appleid.apple.com}") String apiUrl,
            @Value("${apple.team-id:}") String teamId,
            @Value("${apple.key-id:}") String keyId,
            @Value("${apple.client-id:}") String clientId,
            @Value("${apple.private-key:}") String privateKey) {
        this.apiUrl = apiUrl;
        this.teamId = teamId;
        this.keyId = keyId;
        this.clientId = clientId;
        this.privateKey = privateKey;
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(3));
        factory.setReadTimeout(Duration.ofSeconds(10));
        this.restClient = RestClient.builder().requestFactory(factory).build();
    }

    public SocialUser exchange(String code) {
        MultiValueMap<String, String> form = form();
        form.add("grant_type", "authorization_code");
        form.add("code", code);

        Map<?, ?> token;
        try {
            token = post("/auth/token", form);
        } catch (RestClientException e) {
            // 잘못·만료·재사용된 code 는 애플이 400 invalid_grant — 구글과 같이 401 로 돌려준다
            throw new BusinessException(ErrorCode.UNAUTHORIZED, "애플 인증에 실패했습니다 (code 무효/만료).");
        }
        if (token == null || !(token.get("id_token") instanceof String idToken)) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED, "애플 토큰 교환에 실패했습니다.");
        }

        Map<?, ?> claims = payload(idToken);
        if (!AUDIENCE.equals(claims.get("iss")) || !clientId.equals(claims.get("aud"))) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED, "애플 id_token 의 발급자·대상이 다릅니다.");
        }
        return new SocialUser(
                Issuer.APPLE,
                asString(claims.get("sub")),
                asString(claims.get("email")),
                // 애플은 boolean 대신 문자열 "true" 를 주기도 한다
                "true".equals(asString(claims.get("email_verified"))),
                null,
                null,
                asString(token.get("refresh_token")));
    }

    /** 탈퇴 — 애플 쪽 연결을 끊는다. 실패해도 탈퇴는 막지 않는다 (사용자는 애플 설정에서 직접 끊을 수 있다). */
    public void revoke(String refreshToken) {
        try {
            MultiValueMap<String, String> form = form();
            form.add("token", refreshToken);
            form.add("token_type_hint", "refresh_token");
            post("/auth/revoke", form);
        } catch (RuntimeException e) {
            log.warn("애플 토큰 revoke 실패 — 탈퇴는 계속한다: {}", e.getClass().getSimpleName());
        }
    }

    private MultiValueMap<String, String> form() {
        if (!StringUtils.hasText(teamId)
                || !StringUtils.hasText(keyId)
                || !StringUtils.hasText(clientId)
                || !StringUtils.hasText(privateKey)) {
            throw new BusinessException(
                    ErrorCode.EXTERNAL_SERVICE_ERROR,
                    "애플 로그인이 설정되지 않았습니다 (APPLE_TEAM_ID/KEY_ID/CLIENT_ID/PRIVATE_KEY).");
        }
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("client_id", clientId);
        form.add("client_secret", clientSecret());
        return form;
    }

    private Map<?, ?> post(String path, MultiValueMap<String, String> form) {
        return restClient
                .post()
                .uri(apiUrl + path)
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .body(form)
                .retrieve()
                .body(Map.class);
    }

    /** 애플 규격 — ES256, kid=키 ID, iss=팀 ID, sub=client ID, aud=애플. 수명은 최대 6개월이지만 요청마다 만들어 5분이면 된다. */
    String clientSecret() {
        Instant now = Instant.now();
        return Jwts.builder()
                .header()
                .keyId(keyId)
                .and()
                .issuer(teamId)
                .subject(clientId)
                .audience()
                .add(AUDIENCE)
                .and()
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(Duration.ofMinutes(5))))
                .signWith(parsePrivateKey(), Jwts.SIG.ES256)
                .compact();
    }

    /** .p8 원문이든 헤더·줄바꿈을 뺀 본문 한 줄이든 받는다. */
    private PrivateKey parsePrivateKey() {
        String body = privateKey.replaceAll("-----[A-Z ]+-----", "").replaceAll("\\s", "");
        try {
            return KeyFactory.getInstance("EC")
                    .generatePrivate(new PKCS8EncodedKeySpec(Base64.getDecoder().decode(body)));
        } catch (GeneralSecurityException | IllegalArgumentException e) {
            throw new BusinessException(
                    ErrorCode.EXTERNAL_SERVICE_ERROR, "애플 로그인 키(APPLE_PRIVATE_KEY)를 읽지 못했습니다.");
        }
    }

    private static Map<?, ?> payload(String jwt) {
        String[] parts = jwt.split("\\.");
        try {
            byte[] json = Base64.getUrlDecoder().decode(parts[1]);
            return JSON.readValue(new String(json, StandardCharsets.UTF_8), Map.class);
        } catch (ArrayIndexOutOfBoundsException | IllegalArgumentException | JacksonException e) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED, "애플 id_token 을 읽지 못했습니다.");
        }
    }

    private static String asString(Object o) {
        return o == null ? null : String.valueOf(o);
    }
}
