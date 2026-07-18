package com.studyclub.api.auth;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import javax.crypto.SecretKey;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/** access(7d)/refresh(30d) JWT 발급·검증. HS256, 키는 secret 의 SHA-256(32바이트 보장). */
@Service
public class JwtService {

    private static final long ACCESS_TTL_MS = 7L * 24 * 60 * 60 * 1000;
    private static final long REFRESH_TTL_MS = 30L * 24 * 60 * 60 * 1000;

    private final SecretKey key;

    public JwtService(@Value("${jwt.secret:local-dev-jwt-secret-change-me}") String secret) {
        this.key = Keys.hmacShaKeyFor(sha256(secret));
    }

    public String issueAccess(String subject, String email) {
        return build(subject, email, ACCESS_TTL_MS);
    }

    public String issueRefresh(String subject, String email) {
        return build(subject, email, REFRESH_TTL_MS);
    }

    public long accessTtlSeconds() {
        return ACCESS_TTL_MS / 1000;
    }

    public long refreshTtlSeconds() {
        return REFRESH_TTL_MS / 1000;
    }

    public Claims parse(String token) {
        return Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
    }

    private String build(String subject, String email, long ttlMs) {
        Date now = new Date();
        return Jwts.builder()
                .subject(subject)
                .claim("email", email)
                .issuedAt(now)
                .expiration(new Date(now.getTime() + ttlMs))
                .signWith(key)
                .compact();
    }

    private static byte[] sha256(String s) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
