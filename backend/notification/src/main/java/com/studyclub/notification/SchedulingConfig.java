package com.studyclub.notification;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * notification 모듈 자체에 스케줄링을 켠다 — api 모듈 쪽 변경 없이도 폴링이 동작하게 하기 위해서다.
 *
 * <p>{@code notification.polling.enabled=false} 면 아예 꺼진다 — 이 모듈과 무관한 기존 통합 테스트들이
 * {@code @SpringBootTest} 로 전체 컨텍스트를 띄울 때(예: {@code AccountOnboardingIntegrationTest} 는 온보딩 완료 시 이
 * 모듈의 리스너가 만드는 PENDING 행을 그대로 남긴다) 스케줄러가 같이 깨어나 실제 SES 호출을 시도하지 않게 하기 위해서다. 테스트
 * 리소스(application.yml)는 기본값을 false 로 둔다.
 */
@Configuration
@EnableScheduling
@ConditionalOnProperty(value = "notification.polling.enabled", matchIfMissing = true)
public class SchedulingConfig {}
