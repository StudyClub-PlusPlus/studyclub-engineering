package com.studyclub.api.web;

import com.studyclub.domain.study.StudyCategory;
import jakarta.validation.constraints.Size;
import java.time.Instant;

/**
 * PATCH /api/studies/{studyId} 요청 바디. 전송된 필드만 반영한다 (null = 업데이트하지 않음).
 *
 * <p>recruitDeadline: null 과 "미전송"을 구분할 수 없으므로, null 은 "업데이트하지 않음"으로 처리한다. 마감일을 제거(상시 모집으로 전환)하려면
 * 별도 API 가 필요하다.
 */
public record StudyUpdateRequest(
        @Size(max = 60) String title,
        @Size(max = 255) String oneLineSummary,
        String description,
        StudyCategory category,
        Instant recruitDeadline,
        String schedule) {

    public StudyUpdateRequest {
        if (title != null) {
            title = title.trim();
            if (title.length() > 60) {
                throw new IllegalArgumentException("title: 길이 제한을 넘었습니다.");
            }
        }

        if (oneLineSummary != null) {
            oneLineSummary = oneLineSummary.trim();
            if (oneLineSummary.isBlank()) {
                throw new IllegalArgumentException("oneLineSummary: 비어 있으면 저장 불가입니다.");
            }
            if (oneLineSummary.length() > 255) {
                throw new IllegalArgumentException("oneLineSummary: 길이 제한을 넘었습니다.");
            }
        }

        if (description != null && description.length() > 5_000) {
            throw new IllegalArgumentException("description: 길이 제한을 넘었습니다.");
        }

        if (recruitDeadline != null && recruitDeadline.isBefore(Instant.now())) {
            throw new IllegalArgumentException("recruitDeadline: 미래 시간을 입력해 주세요.");
        }

        if (schedule != null && schedule.length() > 500) {
            throw new IllegalArgumentException("schedule: 길이 제한을 넘었습니다.");
        }
    }
}
