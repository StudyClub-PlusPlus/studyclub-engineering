package com.studyclub.api.upload;

import java.time.Instant;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 한 시간마다 {@link UploadService#cleanUp}. 알림 폴링 스케줄러와 같은 모양 — 찜하기 → 읽기 → 건별 처리, 건별 실패는 로그만.
 *
 * <p>서버 다중 실행은 막지 않는다. 찜하기가 조건부 UPDATE 라 같은 행을 두 번 찜하지 못하고, 2단계는 두 번 해도 결과가 같다.
 *
 * <p>조건을 설정 클래스가 아니라 이 빈에 건다 — {@code @Scheduled} 는 어느 모듈이 켠 스케줄링이든 타므로(알림 모듈도 켠다), 빈이 등록되지 않아야
 * {@code upload.cleanup.enabled=false} 가 실제로 꺼진다.
 */
@Component
@ConditionalOnProperty(value = "upload.cleanup.enabled", matchIfMissing = true)
public class StorageCleanupScheduler {

    private final UploadService uploadService;

    public StorageCleanupScheduler(UploadService uploadService) {
        this.uploadService = uploadService;
    }

    @Scheduled(
            fixedDelayString = "${upload.cleanup.fixed-delay-ms:3600000}",
            initialDelayString = "${upload.cleanup.initial-delay-ms:60000}")
    public void run() {
        uploadService.cleanUp(Instant.now());
    }
}
