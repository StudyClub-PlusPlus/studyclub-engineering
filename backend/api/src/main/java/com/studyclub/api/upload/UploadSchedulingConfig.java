package com.studyclub.api.upload;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * 정리 배치용 스케줄링. 알림 모듈이 이미 켜 두지만 그 설정에 기대지 않는다 — 알림 폴링을 끈 환경에서도 업로드 정리는 돌아야 한다.
 *
 * <p>{@code upload.cleanup.enabled=false} 면 꺼진다. 테스트 리소스는 기본값을 false 로 두고 {@code cleanUp()} 을 직접
 * 부른다.
 */
@Configuration
@EnableScheduling
@ConditionalOnProperty(value = "upload.cleanup.enabled", matchIfMissing = true)
public class UploadSchedulingConfig {}
