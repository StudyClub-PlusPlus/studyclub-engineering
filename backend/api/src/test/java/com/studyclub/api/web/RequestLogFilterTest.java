package com.studyclub.api.web;

import static org.assertj.core.api.Assertions.assertThat;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

/** requestId 가 MDC 에 들어가고, 요청이 끝나면 반드시 지워지고, X-Request-Id 를 계승하는지 지킨다. */
class RequestLogFilterTest {

    private final RequestLogFilter filter = new RequestLogFilter();

    @Test
    @DisplayName("성공 - 요청 처리 중 MDC 에 requestId·method·uri 가 채워진다")
    void populatesMdcDuringRequest() throws Exception {
        var request = new MockHttpServletRequest("POST", "/auth/social-login");
        var response = new MockHttpServletResponse();
        var captured = new String[3];

        FilterChain chain =
                (req, res) -> {
                    captured[0] = MDC.get("requestId");
                    captured[1] = MDC.get("method");
                    captured[2] = MDC.get("uri");
                };

        filter.doFilter(request, response, chain);

        assertThat(captured[0]).isNotBlank();
        assertThat(captured[1]).isEqualTo("POST");
        assertThat(captured[2]).isEqualTo("/auth/social-login");
    }

    @Test
    @DisplayName("성공 - 요청이 끝나면 MDC 가 비워진다 (스레드 재사용 오염 방지)")
    void clearsMdcAfterRequest() throws Exception {
        var request = new MockHttpServletRequest("GET", "/api/health");
        var response = new MockHttpServletResponse();

        filter.doFilter(request, response, (req, res) -> {});

        assertThat(MDC.get("requestId")).isNull();
        assertThat(MDC.get("method")).isNull();
        assertThat(MDC.get("uri")).isNull();
    }

    @Test
    @DisplayName("성공 - 체인이 예외를 던져도 MDC 는 비워진다")
    void clearsMdcEvenWhenChainThrows() {
        var request = new MockHttpServletRequest("GET", "/boom");
        var response = new MockHttpServletResponse();

        try {
            filter.doFilter(
                    request,
                    response,
                    (req, res) -> {
                        throw new IllegalStateException("boom");
                    });
        } catch (Exception ignored) {
        }

        assertThat(MDC.get("requestId")).isNull();
    }

    @Test
    @DisplayName("성공 - 들어온 X-Request-Id 를 계승한다")
    void inheritsIncomingRequestId() throws Exception {
        var request = new MockHttpServletRequest("GET", "/api/health");
        request.addHeader("X-Request-Id", "abcd1234");
        var response = new MockHttpServletResponse();
        var captured = new String[1];

        filter.doFilter(request, response, (req, res) -> captured[0] = MDC.get("requestId"));

        assertThat(captured[0]).isEqualTo("abcd1234");
    }

    @Test
    @DisplayName("성공 - 너무 긴 X-Request-Id 는 계승하지 않고 새 id 로 폴백한다")
    void fallsBackWhenIncomingRequestIdTooLong() throws Exception {
        var request = new MockHttpServletRequest("GET", "/api/health");
        String tooLong = "a".repeat(65); // 허용 길이(64) 초과
        request.addHeader("X-Request-Id", tooLong);
        var response = new MockHttpServletResponse();
        var captured = new String[1];

        filter.doFilter(request, response, (req, res) -> captured[0] = MDC.get("requestId"));

        assertThat(captured[0]).isNotBlank().isNotEqualTo(tooLong);
    }

    @Test
    @DisplayName("성공 - 개행·제어문자가 섞인 X-Request-Id 는 계승하지 않고 새 id 로 폴백한다 (로그 위조 방지)")
    void fallsBackWhenIncomingRequestIdHasControlCharacters() throws Exception {
        var request = new MockHttpServletRequest("GET", "/api/health");
        String malicious = "legit\n2099-01-01 ERROR forged-by-attacker";
        request.addHeader("X-Request-Id", malicious);
        var response = new MockHttpServletResponse();
        var captured = new String[1];

        filter.doFilter(request, response, (req, res) -> captured[0] = MDC.get("requestId"));

        assertThat(captured[0]).isNotBlank().isNotEqualTo(malicious).doesNotContain("\n");
    }

    @Test
    @DisplayName("성공 - 응답 헤더로 requestId 를 돌려준다 (사용자 문의 시 식별자)")
    void returnsRequestIdInResponseHeader() throws Exception {
        var request = new MockHttpServletRequest("GET", "/api/health");
        var response = new MockHttpServletResponse();

        filter.doFilter(request, response, (req, res) -> {});

        assertThat(response.getHeader("X-Request-Id")).isNotBlank();
    }

    @Test
    @DisplayName("성공 - query string 은 MDC 에 남기지 않는다 (PII·OAuth code 유출 방지)")
    void neverRecordsQueryString() throws Exception {
        var request = new MockHttpServletRequest("GET", "/auth/callback");
        request.setQueryString("code=SECRET_OAUTH_CODE&email=a@b.com");
        var response = new MockHttpServletResponse();
        var captured = new String[1];

        filter.doFilter(request, response, (req, res) -> captured[0] = MDC.get("uri"));

        assertThat(captured[0]).isEqualTo("/auth/callback");
        assertThat(captured[0]).doesNotContain("SECRET_OAUTH_CODE").doesNotContain("@");
    }

    private ListAppender<ILoggingEvent> captureLogs() {
        var logger = (Logger) LoggerFactory.getLogger(RequestLogFilter.class);
        var appender = new ListAppender<ILoggingEvent>();
        appender.start();
        logger.addAppender(appender);
        return appender;
    }

    @Test
    @DisplayName("성공 - 요청 하나당 method·uri·status·소요시간을 담은 로그 한 줄을 남긴다")
    void writesOneAccessLogLinePerRequest() throws Exception {
        var appender = captureLogs();
        var request = new MockHttpServletRequest("POST", "/auth/social-login");
        var response = new MockHttpServletResponse();
        response.setStatus(201);

        filter.doFilter(request, response, (req, res) -> {});

        assertThat(appender.list).hasSize(1);
        String line = appender.list.get(0).getFormattedMessage();
        assertThat(line).contains("POST").contains("/auth/social-login").contains("201");
        assertThat(line).containsPattern("\\d+ms");
    }

    @Test
    @DisplayName("성공 - 접근 로그에 query string 이 들어가지 않는다 (PII 유출 방지)")
    void accessLogNeverContainsQueryString() throws Exception {
        var appender = captureLogs();
        var request = new MockHttpServletRequest("GET", "/auth/callback");
        request.setQueryString("code=SECRET_OAUTH_CODE&email=a@b.com");
        var response = new MockHttpServletResponse();

        filter.doFilter(request, response, (req, res) -> {});

        String line = appender.list.get(0).getFormattedMessage();
        assertThat(line).doesNotContain("SECRET_OAUTH_CODE").doesNotContain("a@b.com");
    }

    @Test
    @DisplayName("성공 - 헬스체크는 접근 로그를 남기지 않는다 (노이즈 제거)")
    void skipsHealthCheckNoise() throws Exception {
        var appender = captureLogs();
        var response = new MockHttpServletResponse();

        filter.doFilter(
                new MockHttpServletRequest("GET", "/api/health"), response, (req, res) -> {});

        assertThat(appender.list).isEmpty();
    }
}
