package com.studyclub.api.auth.security;

import static org.assertj.core.api.Assertions.assertThat;

import com.studyclub.api.auth.JwtService;
import jakarta.servlet.http.Cookie;
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
}
