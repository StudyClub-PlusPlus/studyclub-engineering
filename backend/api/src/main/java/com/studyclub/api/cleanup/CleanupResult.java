package com.studyclub.api.cleanup;

/** 개인정보 없이 정리 작업의 처리 결과만 전달한다. */
public record CleanupResult(int deleted, int failed, long held, boolean skipped) {
    public static CleanupResult completed(int deleted, int failed) {
        return new CleanupResult(deleted, failed, 0, false);
    }

    public static CleanupResult unavailable() {
        return new CleanupResult(0, 0, 0, true);
    }
}
