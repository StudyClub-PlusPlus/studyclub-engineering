package com.studyclub.api.web;

import static org.assertj.core.api.Assertions.assertThat;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;

/** 에러 로그에 uri 가 남는지, 본문 메시지(PII)가 안 남는지 지킨다. */
class GlobalExceptionHandlerLoggingTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();
    private ListAppender<ILoggingEvent> appender;

    @BeforeEach
    void captureLogs() {
        var logger = (Logger) LoggerFactory.getLogger(GlobalExceptionHandler.class);
        appender = new ListAppender<>();
        appender.start();
        logger.addAppender(appender);
        MDC.put("method", "POST");
        MDC.put("uri", "/auth/social-login");
    }

    @Test
    @DisplayName("성공 - 예상 못 한 500 은 ERROR 로 method·uri 와 함께 남는다")
    void unexpectedErrorLogsMethodAndUri() {
        handler.handleUnexpected(new IllegalStateException("boom"));

        assertThat(appender.list).hasSize(1);
        var event = appender.list.get(0);
        assertThat(event.getLevel()).isEqualTo(Level.ERROR);
        assertThat(event.getFormattedMessage()).contains("POST").contains("/auth/social-login");
        assertThat(event.getThrowableProxy()).as("스택 트레이스가 남아야 한다").isNotNull();
    }

    @Test
    @DisplayName("성공 - 의도한 4xx 는 WARN 으로 errorCode 만 남는다")
    void businessExceptionLogsWarnWithCodeOnly() {
        handler.handleBusiness(
                new BusinessException(ErrorCode.UNAUTHORIZED, "user@example.com 없음"));

        assertThat(appender.list).hasSize(1);
        var event = appender.list.get(0);
        assertThat(event.getLevel()).isEqualTo(Level.WARN);
        assertThat(event.getFormattedMessage()).contains(ErrorCode.UNAUTHORIZED.name());
    }

    @Test
    @DisplayName("성공 - 4xx 로그에 예외 메시지 본문이 새지 않는다 (PII 방지)")
    void businessExceptionNeverLeaksMessageBody() {
        handler.handleBusiness(
                new BusinessException(ErrorCode.UNAUTHORIZED, "user@example.com 없음"));

        assertThat(appender.list.get(0).getFormattedMessage()).doesNotContain("user@example.com");
    }
}
