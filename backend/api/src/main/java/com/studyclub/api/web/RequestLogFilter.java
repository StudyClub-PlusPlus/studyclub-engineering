package com.studyclub.api.web;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Set;
import java.util.concurrent.ThreadLocalRandom;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * 요청 하나에 식별자를 붙여 그 요청이 남긴 로그를 나중에 꿰어볼 수 있게 한다. MDC 에 심은 값은 구조화 로깅(ECS)이 JSON 최상위 필드로 자동 포함한다.
 *
 * <p>MDC 는 ThreadLocal 이고 톰캣은 스레드를 재사용하므로 {@code finally} 에서 반드시 지운다. query string 과 body 는 PII 라
 * 남기지 않는다. 배경은 specs/observability-stack/spec.md 참조.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RequestLogFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(RequestLogFilter.class);

    static final String HEADER = "X-Request-Id";

    /** 계승한 값이 콘솔 로그 한 줄에 그대로 찍히므로 개행·제어문자를 막는다. */
    private static final Pattern SAFE_REQUEST_ID = Pattern.compile("[A-Za-z0-9-]{1,64}");

    private static final Set<String> SILENT = Set.of("/api/health", "/favicon.ico");

    @Override
    protected void doFilterInternal(
            HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String requestId = resolveRequestId(request);
        MDC.put("requestId", requestId);
        MDC.put("method", request.getMethod());
        MDC.put("uri", request.getRequestURI());
        response.setHeader(HEADER, requestId);
        long startedAt = System.nanoTime();
        try {
            chain.doFilter(request, response);
        } finally {
            if (!SILENT.contains(request.getRequestURI())) {
                long elapsedMs = (System.nanoTime() - startedAt) / 1_000_000;
                log.info(
                        "{} {} {} {}ms",
                        request.getMethod(),
                        request.getRequestURI(),
                        response.getStatus(),
                        elapsedMs);
            }
            MDC.remove("requestId");
            MDC.remove("method");
            MDC.remove("uri");
        }
    }

    /** 앞단이 붙인 값이 있으면 잇고, 없거나 문자집합 밖이면 거부하지 않고 새로 만든다. */
    private static String resolveRequestId(HttpServletRequest request) {
        String incoming = request.getHeader(HEADER);
        if (incoming != null && SAFE_REQUEST_ID.matcher(incoming).matches()) {
            return incoming;
        }
        return String.format("%08x", ThreadLocalRandom.current().nextInt());
    }
}
