package com.studyclub.api.auth;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Date;
import javax.crypto.SecretKey;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/** access(15m)/refresh(30d) JWT 발급·검증. HS256, 키는 secret 의 SHA-256(32바이트 보장). */
@Service
public class JwtService {

    private static final long ACCESS_TTL_MS = 15L * 60 * 1000;
    private static final long REFRESH_TTL_MS = 30L * 24 * 60 * 60 * 1000;

    private final SecretKey key;

    public JwtService(@Value("${jwt.secret}") String secret) {
        this.key = Keys.hmacShaKeyFor(sha256(secret));
    }

    public String issueAccess(String subject, String email) {
        return build(subject, email, ACCESS_TTL_MS, "access");
    }

    public String issueRefresh(String subject, String email) {
        return build(subject, email, REFRESH_TTL_MS, "refresh");
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

    /** access 토큰만 수락한다. refresh 토큰이 오면 {@link JwtException} 을 던진다. */
    public Claims parseAccess(String token) {
        Claims c = parse(token);
        if (!"access".equals(c.get("type", String.class))) {
            throw new JwtException("Not an access token");
        }
        return c;
    }

    /** refresh 토큰만 수락한다. access 토큰이 오면 {@link JwtException} 을 던진다. */
    public Claims parseRefresh(String token) {
        Claims c = parse(token);
        if (!"refresh".equals(c.get("type", String.class))) {
            throw new JwtException("Not a refresh token");
        }
        return c;
    }

    private String build(String subject, String email, long ttlMs, String type) {
        Date now = new Date();
        return Jwts.builder()
                .subject(subject)
                .claim("email", email)
                .claim("type", type)
                .issuedAt(now)
                .expiration(new Date(now.getTime() + ttlMs))
                .signWith(key)
                .compact();
    }

    /** refresh token 의 SHA-256 해시 — 16진수 소문자 64자. DB 저장·조회 키로 쓴다. */
    public static String tokenHash(String token) {
        byte[] digest = sha256bytes(token.getBytes(StandardCharsets.UTF_8));
        StringBuilder sb = new StringBuilder(64);
        for (byte b : digest) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }

    private static byte[] sha256(String s) {
        return sha256bytes(s.getBytes(StandardCharsets.UTF_8));
    }

    private static byte[] sha256bytes(byte[] input) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(input);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
