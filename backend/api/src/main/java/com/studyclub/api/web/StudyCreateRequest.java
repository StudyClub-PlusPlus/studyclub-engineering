package com.studyclub.api.web;

import com.studyclub.domain.study.StudyCategory;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;

public record StudyCreateRequest(
        Long studyProgramId,
        @NotBlank @Size(max = 60) String title,
        @NotBlank @Size(max = 255) String oneLineSummary,
        String description,
        @NotNull StudyCategory category,
        String thumbnailUrl,
        Instant recruitDeadline,
        String schedule) {

    public StudyCreateRequest {
        if (title != null && !title.isBlank()) {
            title = title.trim();
            if (title.length() > 60) {
                throw new IllegalArgumentException("title: 길이 제한을 넘었습니다.");
            }
        } else {
            throw new IllegalArgumentException("title은 필수입니다.");
        }

        if (oneLineSummary != null && !oneLineSummary.isBlank()) {
            oneLineSummary = oneLineSummary.trim();
            if (oneLineSummary.length() > 255) {
                throw new IllegalArgumentException("oneLineSummary: 길이 제한을 넘었습니다.");
            }
        } else {
            throw new IllegalArgumentException("oneLineSummary는 필수입니다.");
        }

        if (category == null) {
            throw new IllegalArgumentException("category는 필수입니다.");
        }

        if (description != null && description.length() > 5_000) {
            throw new IllegalArgumentException("description: 길이 제한을 넘었습니다.");
        }

        if (thumbnailUrl != null && thumbnailUrl.length() > 2_048) {
            throw new IllegalArgumentException("thumbnailUrl: 길이 제한을 넘었습니다.");
        }

        if (recruitDeadline != null && recruitDeadline.isBefore(Instant.now())) {
            throw new IllegalArgumentException("recruitDeadline: 미래 시간을 입력해 주세요.");
        }

        if (schedule != null && schedule.length() > 500) {
            throw new IllegalArgumentException("schedule: 길이 제한을 넘었습니다.");
        }
    }
}
