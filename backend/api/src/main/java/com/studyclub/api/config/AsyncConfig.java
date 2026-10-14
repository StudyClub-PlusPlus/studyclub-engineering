package com.studyclub.api.config;

import java.util.concurrent.Executor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.aop.interceptor.AsyncUncaughtExceptionHandler;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.AsyncConfigurer;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

/**
 * {@code @Async} 구독자(도메인 이벤트 부수효과)용 실행기 — specs/domain-events/spec.md.
 *
 * <p>상한을 둔다: 스레드 2개 + 대기열 100. 넘치면 버리고 warn 로그만 남긴다 — 부수효과가 밀려서 요청 스레드나 메모리를 잡아먹지 않게. 빈으로 등록하지 않는다
 * — {@code Executor} 빈이 생기면 Boot 의 기본 {@code applicationTaskExecutor} 가 물러난다.
 */
@Configuration
@EnableAsync
public class AsyncConfig implements AsyncConfigurer {

    private static final Logger log = LoggerFactory.getLogger(AsyncConfig.class);

    @Override
    public Executor getAsyncExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setThreadNamePrefix("event-");
        executor.setCorePoolSize(2);
        executor.setMaxPoolSize(2);
        executor.setQueueCapacity(100);
        executor.setRejectedExecutionHandler(
                (task, pool) -> log.warn("async: 대기열이 가득 차 이벤트 구독 작업을 버렸다"));
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(5);
        executor.initialize();
        return executor;
    }

    @Override
    public AsyncUncaughtExceptionHandler getAsyncUncaughtExceptionHandler() {
        return (e, method, params) ->
                log.warn("async: {} 실패 ({})", method.getName(), e.getClass().getSimpleName());
    }
}
