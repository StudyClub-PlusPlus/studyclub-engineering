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
 * 요청 하나에 식별자를 붙여, 그 요청이 남긴 로그를 나중에 한 줄로 꿰어볼 수 있게 한다.
 *
 * <p>MDC 에 심은 값은 Spring Boot 구조화 로깅(ECS)이 <b>JSON 최상위 필드로 자동 포함</b>한다. 그래서 Loki 에서 {@code
 * requestId} 로 필터하면 그 요청의 전 로그가 모인다.
 *
 * <p><b>MDC 는 ThreadLocal 이다.</b> 톰캣은 스레드를 재사용하므로 {@code finally} 에서 지우지 않으면 다음 요청 로그에 남의 requestId
 * 가 붙는다. 그러면 로그가 틀린 답을 주는 쪽으로 고장난다.
 *
 * <p><b>query string 과 body 는 남기지 않는다.</b> OAuth {@code code} 와 이메일이 거기 실린다 (logging-guide 의 PII
 * 금지).
 *
 * <p>순서는 최우선이다 — 시큐리티 필터가 401 로 끊는 요청도 requestId 를 가져야 한다.
 *
 * <p>들어온 {@code X-Request-Id} 를 계승할 때는 <b>문자집합을 제한</b>한다. 이 값은 그대로 MDC 를 거쳐 콘솔 텍스트 로그 한 줄에 찍힌다 —
 * 개행·제어문자가 섞이면 가짜 로그 줄을 만들 수 있다(ECS JSON 은 이스케이프되지만 콘솔은 아니다). 문자집합 밖이면 <b>요청을 막지 않고</b> 새 id 로 폴백한다
 * — 추적용 식별자 하나 때문에 정상 요청을 400 으로 깰 이유가 없다.
 *
 * <p>요청 하나마다 method·uri·status·소요시간을 담은 접근 로그를 INFO 1줄 남긴다. 에러율·응답시간의 집계는 Prometheus 가 하므로, 이 줄은
 * <b>"어느 요청이 느렸나"를 개별로 좇기 위한 것</b>이다. MDC 를 지우기 전에 남겨야 requestId 가 같이 붙어, 그 줄에서 해당 요청의 다른 로그로 건너갈 수
 * 있다. 헬스체크처럼 주기적으로 때리는 경로({@link #SILENT})는 진짜 요청을 로그에서 묻어버리므로 제외한다.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RequestLogFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(RequestLogFilter.class);

    static final String HEADER = "X-Request-Id";

    /** hex·UUID·base36 계열까지 허용하는 안전한 문자집합. 길이 1~64. */
    private static final Pattern SAFE_REQUEST_ID = Pattern.compile("[A-Za-z0-9-]{1,64}");

    /** 주기적으로 때리는 경로. 남기면 진짜 요청이 묻힌다. */
    private static final Set<String> SILENT = Set.of("/api/health", "/favicon.ico");

    @Override
    protected void doFilterInternal(
            HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String requestId = resolveRequestId(request);
        MDC.put("requestId", requestId);
        MDC.put("method", request.getMethod());
        MDC.put("uri", request.getRequestURI()); // query string 제외 — PII 가 거기 실린다
        response.setHeader(HEADER, requestId);
        long startedAt = System.nanoTime();
        try {
            chain.doFilter(request, response);
        } finally {
            if (!SILENT.contains(request.getRequestURI())) {
                long elapsedMs = (System.nanoTime() - startedAt) / 1_000_000;
                // 파라미터 바인딩 — 문자열 연결 금지 (logging-guide)
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

    /**
     * 앞단(프론트·게이트웨이)이 붙인 것이 있으면 잇고, 없으면 새로 만든다.
     *
     * <p>계승 조건은 길이뿐 아니라 문자집합까지 검사한다 — 안 그러면 개행·제어문자가 그대로 콘솔 로그 한 줄에 찍혀 가짜 로그 줄을 만들 수 있다. 문자집합을 벗어나면
     * 거부(400)가 아니라 새로 생성해서 계속 진행한다.
     */
    private static String resolveRequestId(HttpServletRequest request) {
        String incoming = request.getHeader(HEADER);
        if (incoming != null && SAFE_REQUEST_ID.matcher(incoming).matches()) {
            return incoming;
        }
        // 로그를 눈으로 좇을 것이라 UUID 32자는 길다. 8자면 하루치 안에서 충분히 구분된다.
        return String.format("%08x", ThreadLocalRandom.current().nextInt());
    }
}
