package com.studyclub.api.auth.security;

import com.studyclub.api.auth.JwtService;
import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Arrays;
import java.util.List;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * 액세스 토큰을 파싱해 sub(ACCOUNT.ID) 를 principal 로 하는 인증을 세팅한다.
 *
 * <p>토큰은 <b>두 곳</b>에서 찾는다 — 헤더가 먼저다.
 *
 * <ul>
 *   <li>{@code Authorization: Bearer <access>} — 서버 간 호출·테스트·모바일
 *   <li>{@code sc_access_token} · {@code bo_access_token} 쿠키 — 브라우저가 자동으로 싣는다
 * </ul>
 *
 * <p>쿠키를 읽는 이유: 프론트 토큰은 <b>httpOnly</b> 라 브라우저 JS 가 값을 읽어 헤더로 붙일 수 없다. 쿠키를 받으면 화면이 중계 서버 없이 이 API 를
 * 직접 부를 수 있다. 대신 쿠키 인증이므로 <b>CORS 허용 오리진을 좁게</b> 유지해야 한다 ({@code cors.allowed-origins}).
 */
public class JwtAuthFilter extends OncePerRequestFilter {

    private static final List<String> ACCESS_COOKIES =
            List.of("sc_access_token", "bo_access_token");

    private final JwtService jwtService;

    public JwtAuthFilter(JwtService jwtService) {
        this.jwtService = jwtService;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String token = resolveToken(request);
        if (token != null && SecurityContextHolder.getContext().getAuthentication() == null) {
            try {
                Claims c = jwtService.parse(token);
                Long accountId = Long.valueOf(c.getSubject());
                var auth = new UsernamePasswordAuthenticationToken(accountId, null, List.of());
                SecurityContextHolder.getContext().setAuthentication(auth);
            } catch (RuntimeException ignored) {
                // 유효하지 않은 토큰 → 인증 미설정 (이후 authorize 단계에서 401)
            }
        }
        chain.doFilter(request, response);
    }

    /** 헤더 우선, 없으면 쿠키. 사용자 사이트(sc_)와 백오피스(bo_)가 쿠키 이름으로 갈린다. */
    private String resolveToken(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            return header.substring(7);
        }
        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return null;
        }
        return Arrays.stream(cookies)
                .filter(c -> ACCESS_COOKIES.contains(c.getName()))
                .map(Cookie::getValue)
                .filter(v -> v != null && !v.isBlank())
                .findFirst()
                .orElse(null);
    }
}
