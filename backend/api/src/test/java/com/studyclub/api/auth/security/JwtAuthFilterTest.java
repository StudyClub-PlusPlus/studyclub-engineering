package com.studyclub.api.auth.security;

import static org.assertj.core.api.Assertions.assertThat;

import com.studyclub.api.auth.JwtService;
import jakarta.servlet.http.Cookie;
import java.util.Set;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;

/** 화면이 API 를 직접 부르므로 인증이 <b>쿠키</b>로도 들어온다. 헤더만 보던 가정이 남으면 브라우저 요청이 전부 401 이 되므로 두 경로를 다 고정해 둔다. */
class JwtAuthFilterTest {

    private final JwtService jwtService = new JwtService("test-secret-for-jwt-auth-filter");
    private final JwtAuthFilter filter = new JwtAuthFilter(jwtService);

    @AfterEach
    void clear() {
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("성공 - Authorization 헤더의 토큰으로 인증된다")
    void authenticatesFromHeader() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader(
                "Authorization", "Bearer " + jwtService.issueAccess("42", "a@example.com"));

        filter.doFilter(request, new MockHttpServletResponse(), new MockFilterChain());

        assertThat(SecurityContextHolder.getContext().getAuthentication().getPrincipal())
                .isEqualTo(42L);
    }

    @Test
    @DisplayName("성공 - 헤더가 없으면 액세스 쿠키에서 찾는다 (브라우저 직접 호출)")
    void authenticatesFromCookie() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setCookies(
                new Cookie("bo_access_token", jwtService.issueAccess("7", "b@example.com")));

        filter.doFilter(request, new MockHttpServletResponse(), new MockFilterChain());

        assertThat(SecurityContextHolder.getContext().getAuthentication().getPrincipal())
                .isEqualTo(7L);
    }

    @Test
    @DisplayName("실패 - 우리 쿠키가 아니면 인증하지 않는다")
    void ignoresOtherCookies() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setCookies(
                new Cookie("some_other_token", jwtService.issueAccess("7", "b@example.com")));

        filter.doFilter(request, new MockHttpServletResponse(), new MockFilterChain());

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }

    @Test
    @DisplayName("실패 - 깨진 토큰이면 인증 없이 지나간다")
    void ignoresInvalidToken() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setCookies(new Cookie("sc_access_token", "not-a-jwt"));

        filter.doFilter(request, new MockHttpServletResponse(), new MockFilterChain());

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }

    // ---- 어느 쿠키를 읽나 — 사이트·백오피스·환경 쿠키가 한 브라우저에 같이 있을 때 -------------------------------

    private static final String BO_ORIGIN = "https://back-office-stage.example.com";

    private final JwtAuthFilter stageFilter =
            new JwtAuthFilter(jwtService, "stage", Set.of(BO_ORIGIN));

    private Object principalOf(JwtAuthFilter f, String origin, Cookie... cookies) throws Exception {
        SecurityContextHolder.clearContext();
        MockHttpServletRequest request = new MockHttpServletRequest();
        if (origin != null) {
            request.addHeader("Origin", origin);
        }
        request.setCookies(cookies);
        f.doFilter(request, new MockHttpServletResponse(), new MockFilterChain());
        var auth = SecurityContextHolder.getContext().getAuthentication();
        return auth == null ? null : auth.getPrincipal();
    }

    private Cookie cookie(String name, String accountId) {
        return new Cookie(name, jwtService.issueAccess(accountId, accountId + "@example.com"));
    }

    @Test
    @DisplayName("사이트에서 온 요청은 백오피스 쿠키가 먼저 와도 사이트 쿠키의 계정이다")
    void sitePicksSiteCookie() throws Exception {
        Object principal =
                principalOf(
                        stageFilter,
                        "https://stage.example.com",
                        cookie("bo_stage_access_token", "1"),
                        cookie("sc_stage_access_token", "6"));

        assertThat(principal).isEqualTo(6L);
    }

    @Test
    @DisplayName("백오피스에서 온 요청은 사이트 쿠키가 먼저 와도 백오피스 쿠키의 계정이다")
    void backOfficePicksBackOfficeCookie() throws Exception {
        Object principal =
                principalOf(
                        stageFilter,
                        BO_ORIGIN,
                        cookie("sc_stage_access_token", "6"),
                        cookie("bo_stage_access_token", "1"));

        assertThat(principal).isEqualTo(1L);
    }

    @Test
    @DisplayName("stage 는 운영 이름의 쿠키를 읽지 않는다 — 같은 상위 도메인이라 운영 쿠키도 실려 온다")
    void stageIgnoresProductionCookie() throws Exception {
        Object principal =
                principalOf(
                        stageFilter, "https://stage.example.com", cookie("sc_access_token", "9"));

        assertThat(principal).isNull();
    }

    @Test
    @DisplayName("사이트 요청에 백오피스 쿠키만 있으면 인증하지 않는다 — 다른 앱의 계정으로 판단하지 않게")
    void siteDoesNotFallBackToBackOfficeCookie() throws Exception {
        Object principal =
                principalOf(
                        stageFilter,
                        "https://stage.example.com",
                        cookie("bo_stage_access_token", "1"));

        assertThat(principal).isNull();
    }
}
