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
import java.util.Set;
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
 *
 * <p><b>어느 쿠키를 읽나</b> — 사이트({@code sc_})와 백오피스({@code bo_}) 쿠키는 같은 상위 도메인에 심기므로 브라우저는 둘을 함께 보낸다. 먼저
 * 온 것을 쓰면 다른 앱에 로그인한 계정으로 판단된다(2026-10-16 stage: 사이트에서 사진을 올렸는데 백오피스의 온보딩 안 한 계정으로 잡혀 403). 그래서 요청의
 * {@code Origin} 으로 고른다 — 백오피스 오리진이면 {@code bo_} 만, 그 밖의 브라우저 요청이면 {@code sc_} 만. {@code Origin} 이
 * 없는 요청(서버 간 호출)은 헤더를 쓰고, 헤더도 없으면 있는 쿠키 하나를 쓴다.
 *
 * <p><b>환경별 이름</b> — stage 와 운영도 같은 상위 도메인이라 이름이 같으면 서로 덮어쓴다. {@code AUTH_COOKIE_ENV}(stage 만
 * {@code stage})가 있으면 {@code sc_stage_access_token} 처럼 이름에 넣는다. 운영은 비워 기존 이름을 그대로 쓴다.
 */
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final String siteCookie;
    private final String backOfficeCookie;
    private final Set<String> backOfficeOrigins;

    public JwtAuthFilter(JwtService jwtService) {
        this(jwtService, "", Set.of());
    }

    /**
     * @param cookieEnv 쿠키 이름에 넣을 환경 이름. 비면 기존 이름({@code sc_access_token})
     * @param backOfficeOrigins 백오피스 오리진 — 여기서 온 요청은 {@code bo_} 쿠키만 읽는다
     */
    public JwtAuthFilter(JwtService jwtService, String cookieEnv, Set<String> backOfficeOrigins) {
        this.jwtService = jwtService;
        String env = cookieEnv == null || cookieEnv.isBlank() ? "" : cookieEnv.trim() + "_";
        this.siteCookie = "sc_" + env + "access_token";
        this.backOfficeCookie = "bo_" + env + "access_token";
        this.backOfficeOrigins = backOfficeOrigins;
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

    /** 헤더 우선. 쿠키는 {@code Origin} 으로 어느 앱의 것인지 고른다. */
    private String resolveToken(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            return header.substring(7);
        }
        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return null;
        }
        String origin = request.getHeader("Origin");
        List<String> names;
        if (origin == null) {
            names = List.of(siteCookie, backOfficeCookie);
        } else if (backOfficeOrigins.contains(origin)) {
            names = List.of(backOfficeCookie);
        } else {
            names = List.of(siteCookie);
        }
        for (String name : names) {
            String value =
                    Arrays.stream(cookies)
                            .filter(c -> name.equals(c.getName()))
                            .map(Cookie::getValue)
                            .filter(v -> v != null && !v.isBlank())
                            .findFirst()
                            .orElse(null);
            if (value != null) {
                return value;
            }
        }
        return null;
    }
}
