package com.studyclub.api.auth.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * 서비스 간 인증 — {@code X-API-Key} 가 맞으면 인증을 세팅한다. 사용자 JWT 와 섞이지 않도록 디스코드 체인에서만 쓴다.
 *
 * <p>키가 설정되지 않았으면 <b>아무도 통과시키지 않는다.</b> 빈 키를 "검사 없음" 으로 해석하면 설정 누락이 곧 공개 엔드포인트가 된다.
 */
public class ApiKeyAuthFilter extends OncePerRequestFilter {

    private static final String HEADER = "X-API-Key";

    private final byte[] expected;

    public ApiKeyAuthFilter(String apiKey) {
        this.expected =
                apiKey == null || apiKey.isBlank() ? null : apiKey.getBytes(StandardCharsets.UTF_8);
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String presented = request.getHeader(HEADER);
        if (expected != null && presented != null && matches(presented)) {
            SecurityContextHolder.getContext()
                    .setAuthentication(
                            new UsernamePasswordAuthenticationToken(
                                    "discord-bot", null, List.of()));
        }
        chain.doFilter(request, response);
    }

    /** 길이·내용 모두 상수 시간 비교 — 키를 한 바이트씩 맞춰 보는 걸 막는다. */
    private boolean matches(String presented) {
        return MessageDigest.isEqual(presented.getBytes(StandardCharsets.UTF_8), expected);
    }
}
