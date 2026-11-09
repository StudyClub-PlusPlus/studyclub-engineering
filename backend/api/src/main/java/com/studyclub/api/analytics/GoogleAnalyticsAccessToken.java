package com.studyclub.api.analytics;

import io.jsonwebtoken.Jwts;
import java.security.*;
import java.security.spec.PKCS8EncodedKeySpec;
import java.time.*;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.web.client.RestClient;

/** GA 삭제용 서비스 계정. 기존 JWT 라이브러리 사용. 비밀키/토큰은 로그에 남기지 않는다. */
@Component
public class GoogleAnalyticsAccessToken {
    private final String email, privateKey, tokenEndpoint;
    private final RestClient http = AnalyticsDeletionGateway.httpClient();
    private String cached;
    private Instant expiresAt = Instant.EPOCH;

    public GoogleAnalyticsAccessToken(
            @Value("${ga4.deletion.service-account-email:}") String email,
            @Value("${ga4.deletion.private-key:}") String privateKey,
            @Value("${ga4.deletion.token-endpoint:https://oauth2.googleapis.com/token}")
                    String tokenEndpoint) {
        this.email = email;
        this.privateKey = privateKey;
        this.tokenEndpoint = tokenEndpoint;
    }

    public synchronized String get() {
        Instant now = Instant.now();
        if (cached != null && expiresAt.isAfter(now.plusSeconds(60))) return cached;
        if (email.isBlank() || privateKey.isBlank())
            throw new IllegalStateException("DELETION_NOT_CONFIGURED");
        String assertion =
                Jwts.builder()
                        .issuer(email)
                        .audience()
                        .add(tokenEndpoint)
                        .and()
                        .claim("scope", "https://www.googleapis.com/auth/analytics.edit")
                        .issuedAt(Date.from(now))
                        .expiration(Date.from(now.plusSeconds(3600)))
                        .signWith(parseKey(), Jwts.SIG.RS256)
                        .compact();
        var form = new LinkedMultiValueMap<String, String>();
        form.add("grant_type", "urn:ietf:params:oauth:grant-type:jwt-bearer");
        form.add("assertion", assertion);
        Map<?, ?> response =
                http.post()
                        .uri(tokenEndpoint)
                        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                        .body(form)
                        .retrieve()
                        .body(Map.class);
        if (response == null
                || !(response.get("access_token") instanceof String token)
                || token.isBlank()) throw new IllegalStateException("INVALID_TOKEN_RESPONSE");
        cached = token;
        long ttl = response.get("expires_in") instanceof Number n ? n.longValue() : 3600;
        expiresAt = now.plusSeconds(Math.min(ttl, 3600));
        return token;
    }

    private PrivateKey parseKey() {
        try {
            String body =
                    privateKey
                            .replace("\\n", "\n")
                            .replaceAll("-----[A-Z ]+-----", "")
                            .replaceAll("\\s", "");
            return KeyFactory.getInstance("RSA")
                    .generatePrivate(new PKCS8EncodedKeySpec(Base64.getDecoder().decode(body)));
        } catch (GeneralSecurityException | IllegalArgumentException e) {
            throw new IllegalStateException("INVALID_DELETION_KEY");
        }
    }
}
